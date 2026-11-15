import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '../app/routes';
import { SALES_LABELS } from '../shared/constants/labels';
import { useLocationNotice } from '../shared/hooks/useLocationNotice';
import { SALE_STAGES, SALE_STAGE_LABELS, type Sale, type SaleStage } from '../shared/types';
import { AddButtonLabel } from '../shared/ui/AddButtonLabel';
import { formatColones } from '../shared/utils/money';
import {
  BOARD_DRAG_MESSAGES,
  BOARD_MESSAGES,
  buildBoard,
  canDragSale,
  dropDecision,
  dropZoneState,
  type BoardColumn,
  type BoardSale,
} from './board';
import { ChangeStageDialog } from './ChangeStageDialog';
import { getContactNames } from './contactSearchApi';
import { listAlerts } from './alertsApi';
import { SaleCard, SaleCardContent } from './SaleCard';
import { changeSaleStage, listBoardSales } from './salesApi';
import { SaleReopenDuplicateTitleError, SaleStageConflictError } from './salesRepository';
import { STAGE_CHANGE_MESSAGES, stageChangeNotice, type StageChangeResult } from './stageChange';
import { TimedNotice } from './TimedNotice';

type ReadyState = { status: 'ready'; items: BoardSale[]; alertSaleIds: Set<string>; overdueSaleIds: Set<string> };
type BoardState = { status: 'loading' } | { status: 'error' } | ReadyState;

/** Ventana "Cambiar etapa" abierta al soltar una tarjeta en "Venta ganada" o "Venta perdida". */
interface DropDialog {
  saleId: string;
  from: SaleStage;
  to: SaleStage;
}

/** Tras soltar, el navegador puede mandar un clic al enlace de la tarjeta: ese clic no abre el detalle. */
const CLICK_AFTER_DRAG_MS = 300;

/** Teclado: la barra espaciadora toma la tarjeta (Enter sigue abriendo el detalle); Espacio o Enter la sueltan. */
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };

/** Teclado: las flechas izquierda y derecha llevan la tarjeta al centro de la columna vecina. */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();
  const from = (context.over?.id ?? context.active?.data.current?.stage) as SaleStage | undefined;
  const target = from ? SALE_STAGES[SALE_STAGES.indexOf(from) + step] : undefined;
  const rect = target ? context.droppableRects.get(target) : undefined;
  if (!rect) return currentCoordinates;
  const width = context.collisionRect?.width ?? 0;
  return { x: rect.left + (rect.width - width) / 2, y: currentCoordinates.y };
};

/** Con ratón o dedo cuenta la columna bajo el puntero; con teclado, la columna donde quedó la tarjeta. */
const columnCollision: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

function stageChangeErrorMessage(error: unknown): string {
  if (error instanceof SaleReopenDuplicateTitleError) return STAGE_CHANGE_MESSAGES.reopenDuplicateTitle;
  if (error instanceof SaleStageConflictError) return STAGE_CHANGE_MESSAGES.conflict;
  return STAGE_CHANGE_MESSAGES.saveError;
}

async function loadBoard(now: Date): Promise<ReadyState> {
  // Si fallan los avisos el tablero se muestra igual, sin campanas.
  const alerts = listAlerts(now).catch(() => []);
  const sales = await listBoardSales(now);
  const names = await getContactNames(sales.map((sale) => sale.contactId));
  const pending = await alerts;
  return {
    status: 'ready',
    items: sales.map((sale) => ({ sale, contactName: names.get(sale.contactId) ?? '—' })),
    alertSaleIds: new Set(pending.map((alert) => alert.saleId)),
    overdueSaleIds: new Set(pending.filter((alert) => alert.kind === 'seguimiento_vencido').map((alert) => alert.saleId)),
  };
}

/**
 * Pantalla "Gestión de ventas". HU-301: botón "+ Nueva oportunidad" y confirmación al registrar una.
 * HU-305: tablero de seis columnas, una por etapa, con conteo, suma de montos y tarjetas.
 * HU-314/315: la tarjeta muestra la campana si la venta tiene un aviso pendiente, y la fecha de seguimiento en rojo
 * si tiene el aviso "Seguimiento vencido" (el mismo cálculo de día calendario de Costa Rica de HU-314).
 * Arrastre de tarjetas: mientras se arrastra, las columnas que permite el mapa de transiciones se resaltan y las
 * demás se atenúan y no aceptan la tarjeta. Una etapa abierta cambia directo; "Venta ganada" y "Venta perdida"
 * abren la ventana "Cambiar etapa" con esa etapa elegida (confirmación de HU-313, pregunta y motivo de HU-311).
 */
export function SalesBoardPage() {
  const navigate = useNavigate();
  const locationNotice = useLocationNotice();
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  // "Hoy" se fija al abrir la pantalla para que los 30 días no cambien mientras se mira.
  const [now] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<DropDialog | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  // Confirmación de 5 segundos; cada una lleva su `id` para que vuelva a mostrarse aunque el texto se repita.
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const dragEndedAt = useRef(0);
  const keyboardDrag = useRef(false);
  const focusAfterMove = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBoard(now)
      .then((ready) => !cancelled && setState(ready))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [now]);

  // Tras mover una tarjeta con el teclado, el foco vuelve a ella en su nueva columna.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    const link = [...document.querySelectorAll<HTMLElement>('[data-sale-id]')].find((element) => element.dataset.saleId === id);
    if (link) {
      link.focus();
      focusAfterMove.current = null;
    }
  });

  const items = state.status === 'ready' ? state.items : [];
  const columns = useMemo(() => (state.status === 'ready' ? buildBoard(state.items, now) : []), [state, now]);
  const findItem = useCallback((id: UniqueIdentifier) => items.find((item) => item.sale.id === id), [items]);
  const activeItem = activeId ? findItem(activeId) : undefined;

  const showNotice = (message: string) => setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, message }));

  const replaceSale = (sale: Sale) =>
    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, items: prev.items.map((item) => (item.sale.id === sale.id ? { ...item, sale } : item)) }
        : prev,
    );

  const setSaving = (id: string, saving: boolean) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Recalcula las campanas (una venta reabierta vuelve a generar avisos; una ganada o perdida ya no). */
  const refreshAlerts = () => {
    listAlerts(now)
      .then((pending) =>
        setState((prev) =>
          prev.status === 'ready'
            ? {
                ...prev,
                alertSaleIds: new Set(pending.map((alert) => alert.saleId)),
                overdueSaleIds: new Set(pending.filter((alert) => alert.kind === 'seguimiento_vencido').map((alert) => alert.saleId)),
              }
            : prev,
        ),
      )
      .catch(() => undefined);
  };

  /** Etapa abierta permitida: la tarjeta pasa de una vez a la nueva columna; si falla, vuelve a la suya. */
  async function moveDirect(original: Sale, target: SaleStage) {
    const from = original.stage;
    setSaving(original.id, true);
    replaceSale({ ...original, stage: target, stageChangedAt: Timestamp.now() });
    if (keyboardDrag.current) focusAfterMove.current = original.id;
    try {
      const result = await changeSaleStage(original.id, from, target);
      showNotice(stageChangeNotice(target, result, from));
      refreshAlerts();
    } catch (error) {
      replaceSale(original);
      if (keyboardDrag.current) focusAfterMove.current = original.id;
      setDropError(stageChangeErrorMessage(error));
      // Otra pantalla ya la cambió: se vuelve a leer el tablero para mostrar su etapa real.
      if (error instanceof SaleStageConflictError) {
        loadBoard(now)
          .then(setState)
          .catch(() => undefined);
      }
    } finally {
      setSaving(original.id, false);
    }
  }

  function handleDragStart({ active, activatorEvent }: DragStartEvent) {
    setActiveId(String(active.id));
    setDropError(null);
    keyboardDrag.current = activatorEvent instanceof KeyboardEvent;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    dragEndedAt.current = Date.now();
    const item = findItem(active.id);
    if (!item || !over || savingIds.has(item.sale.id)) return;
    const target = over.id as SaleStage;
    switch (dropDecision(item.sale, target)) {
      case 'cambio_directo':
        void moveDirect(item.sale, target);
        break;
      case 'ventana_ganada':
      case 'ventana_perdida':
        setDialog({ saleId: item.sale.id, from: item.sale.stage, to: target });
        break;
      case 'no_permitido':
        break;
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    dragEndedAt.current = Date.now();
  }

  function handleDialogSaved(newStage: SaleStage, result: StageChangeResult, previousStage: SaleStage) {
    const item = dialog ? findItem(dialog.saleId) : undefined;
    if (item) replaceSale({ ...item.sale, stage: newStage, stageChangedAt: Timestamp.now() });
    setDialog(null);
    showNotice(stageChangeNotice(newStage, result, previousStage));
    refreshAlerts();
  }

  function suppressClickAfterDrag(event: MouseEvent) {
    if (Date.now() - dragEndedAt.current < CLICK_AFTER_DRAG_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  const sensors = useSensors(
    // Ratón: el arrastre empieza al moverlo unos píxeles; un clic normal sigue abriendo el detalle.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Táctil: tras una pulsación breve, para no estorbar el desplazamiento horizontal del tablero.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: KEYBOARD_CODES, coordinateGetter: columnCoordinates }),
  );

  const titleOf = (id: UniqueIdentifier) => findItem(id)?.sale.title ?? '';
  const originOf = (id: UniqueIdentifier) => {
    const stage = findItem(id)?.sale.stage;
    return stage ? SALE_STAGE_LABELS[stage] : '';
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => BOARD_DRAG_MESSAGES.start(titleOf(active.id), originOf(active.id)),
    onDragOver: ({ active, over }) => {
      const item = findItem(active.id);
      if (!item || !over) return undefined;
      const target = over.id as SaleStage;
      const label = SALE_STAGE_LABELS[target];
      const zone = dropZoneState(item.sale.stage, target);
      if (zone === 'origen') return BOARD_DRAG_MESSAGES.overOrigin(label);
      return zone === 'permitida' ? BOARD_DRAG_MESSAGES.overAllowed(label) : BOARD_DRAG_MESSAGES.overBlocked(label);
    },
    onDragEnd: ({ active, over }) => {
      const item = findItem(active.id);
      if (!item) return undefined;
      const target = over?.id as SaleStage | undefined;
      if (target && dropDecision(item.sale, target) !== 'no_permitido') {
        return BOARD_DRAG_MESSAGES.dropped(item.sale.title, SALE_STAGE_LABELS[target]);
      }
      return BOARD_DRAG_MESSAGES.returned(item.sale.title, SALE_STAGE_LABELS[item.sale.stage]);
    },
    onDragCancel: ({ active }) => BOARD_DRAG_MESSAGES.cancelled(titleOf(active.id), originOf(active.id)),
  };

  return (
    <main className="page page-wide">
      <TimedNotice message={locationNotice} />
      {notice && <TimedNotice key={notice.id} message={notice.message} />}
      <div className="page-header">
        <h1>{SALES_LABELS.boardTitle}</h1>
        <button type="button" onClick={() => navigate(ROUTES.newSale)}>
          <AddButtonLabel>{SALES_LABELS.newOpportunity}</AddButtonLabel>
        </button>
      </div>

      {state.status === 'loading' && <p>{BOARD_MESSAGES.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {BOARD_MESSAGES.loadError}
        </p>
      )}
      {dropError && (
        <p className="field-error board-drop-error" role="alert">
          {dropError}
        </p>
      )}
      {state.status === 'ready' && (
        <DndContext
          sensors={sensors}
          collisionDetection={columnCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{ announcements, screenReaderInstructions: { draggable: BOARD_DRAG_MESSAGES.instructions } }}
        >
          <div className={activeItem ? 'board is-dragging' : 'board'} onClickCapture={suppressClickAfterDrag}>
            {columns.map((column) => (
              <DroppableColumn key={column.stage} column={column} dragFrom={activeItem?.sale.stage ?? null}>
                {column.sales.length === 0 ? (
                  <p className="board-empty">{BOARD_MESSAGES.empty}</p>
                ) : (
                  <ul className="board-cards">
                    {column.sales.map((item) => (
                      <SaleCard
                        key={item.sale.id}
                        item={item}
                        hasAlert={state.alertSaleIds.has(item.sale.id)}
                        followUpOverdue={state.overdueSaleIds.has(item.sale.id)}
                        dragDisabled={!canDragSale(item.sale)}
                        saving={savingIds.has(item.sale.id)}
                      />
                    ))}
                  </ul>
                )}
              </DroppableColumn>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <div className="sale-card sale-card-overlay">
                <div className="sale-card-link">
                  <SaleCardContent
                    item={activeItem}
                    hasAlert={state.alertSaleIds.has(activeItem.sale.id)}
                    followUpOverdue={state.overdueSaleIds.has(activeItem.sale.id)}
                  />
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {dialog && (
        <ChangeStageDialog
          saleId={dialog.saleId}
          currentStage={dialog.from}
          initialStage={dialog.to}
          onSaved={handleDialogSaved}
          onCancel={() => setDialog(null)}
        />
      )}
    </main>
  );
}

/** Columna del tablero que recibe tarjetas. Mientras se arrastra, se marca como origen, permitida o bloqueada. */
function DroppableColumn({ column, dragFrom, children }: { column: BoardColumn; dragFrom: SaleStage | null; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage });
  const zone = dragFrom ? dropZoneState(dragFrom, column.stage) : null;
  const classes = ['board-column', `board-column-${column.stage}`];
  if (zone) classes.push(`is-drop-${zone}`);
  if (zone === 'permitida' && isOver) classes.push('is-drop-over');
  return (
    <section ref={setNodeRef} className={classes.join(' ')} aria-label={column.label} data-drop={zone ?? undefined}>
      <h2 className="board-column-header">
        {/* El texto sigue siendo "En negociación · 4 · ₡ 820 000"; los span solo lo reparten en dos líneas. */}
        <span className="board-column-title">{column.label}</span>
        {' · '}
        <span className="board-column-summary">
          {column.count} · <span className="board-column-total">{formatColones(column.total)}</span>
        </span>
      </h2>
      {children}
    </section>
  );
}
