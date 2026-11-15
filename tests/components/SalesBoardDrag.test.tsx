// @vitest-environment jsdom
// Arrastrar tarjetas por el tablero de Gestión de ventas para cambiar su etapa.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import { listAlerts } from '../../src/sales/alertsApi';
import { getContactNames } from '../../src/sales/contactSearchApi';
import { changeSaleStage, listBoardSales } from '../../src/sales/salesApi';
import { SaleReopenDuplicateTitleError, SaleStageConflictError } from '../../src/sales/salesRepository';
import { SALE_STAGES, type Sale, type SaleStage } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/alertsApi', () => ({ listAlerts: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({
  listBoardSales: vi.fn(),
  changeSaleStage: vi.fn(),
  listOpenSaleTitles: vi.fn(),
  createSale: vi.fn(),
}));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn(),
  listActiveContacts: vi.fn(),
  getContactForSale: vi.fn(),
}));
vi.mock('../../src/products/productsApi', () => ({ listActiveProducts: vi.fn(), listProducts: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn().mockResolvedValue(null) }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

let currentLocation: ReturnType<typeof useLocation>;
function LocationProbe() {
  currentLocation = useLocation();
  return null;
}

function renderBoard() {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/posibles-ventas']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const sale = (id: string, stage: SaleStage, overrides: Partial<Sale> = {}): Sale => ({
  id,
  contactId: 'contact-001',
  title: `Venta ${id}`,
  stage,
  estimatedAmount: 100_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: Timestamp.fromDate(new Date('2026-10-01T12:00:00Z')),
  // Reciente, para que las ganadas y perdidas sigan en el tablero (30 días).
  stageChangedAt: Timestamp.fromDate(new Date()),
  lastCommunicationAt: null,
  ...overrides,
});

/*
 * jsdom no calcula posiciones: todas las cajas miden 0. Para que el arrastre sepa sobre qué columna está la tarjeta
 * se le da a cada columna una caja propia (150 px de separación, en el orden del tablero) y a cada tarjeta una caja
 * dentro de su columna.
 */
const COLUMN_STEP = 150;
const COLUMN_WIDTH = 140;
function box(left: number, top: number, width: number, height: number): DOMRect {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect;
}
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement): DOMRect {
    // La copia que sigue al puntero ocupa, al empezar, el mismo lugar que la tarjeta original.
    if (this.closest('.sale-card-overlay') || this.parentElement?.querySelector(':scope > .sale-card-overlay')) {
      const original = document.querySelector<HTMLElement>('.sale-card.is-dragging .sale-card-link');
      return original ? original.getBoundingClientRect() : box(0, 0, 0, 0);
    }
    const column = this.closest<HTMLElement>('.board-column');
    if (!column) return box(0, 0, 0, 0);
    const index = SALE_STAGES.findIndex((stage) => column.classList.contains(`board-column-${stage}`));
    const left = index * COLUMN_STEP;
    if (this === column) return box(left, 0, COLUMN_WIDTH, 700);
    return box(left + 10, 100, COLUMN_WIDTH - 20, 80);
  });
}
const columnCenter = (stage: SaleStage) => SALE_STAGES.indexOf(stage) * COLUMN_STEP + COLUMN_WIDTH / 2;

const column = (label: string) => screen.getByRole('region', { name: label });
const card = (title: string) => screen.getByRole('link', { name: new RegExp(title) });
const columnOf = (title: string) => card(title).closest('section')?.getAttribute('aria-label');
/** El sensor de teclado empieza a escuchar las flechas un instante después de tomar la tarjeta. */
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

async function press(user: ReturnType<typeof userEvent.setup>, ...keys: string[]) {
  for (const key of keys) {
    await user.keyboard(key);
    await tick();
  }
}

/** Toma la tarjeta con la barra espaciadora y la mueve `steps` columnas a la derecha (o izquierda si es negativo). */
async function keyboardDrag(user: ReturnType<typeof userEvent.setup>, title: string, steps: number) {
  card(title).focus();
  await press(user, '[Space]');
  const arrow = steps > 0 ? '[ArrowRight]' : '[ArrowLeft]';
  for (let i = 0; i < Math.abs(steps); i += 1) await press(user, arrow);
}

async function setup(sales: Sale[]) {
  vi.mocked(listBoardSales).mockResolvedValue(sales);
  const user = userEvent.setup();
  renderBoard();
  await screen.findByRole('heading', { name: /^Nuevo interesado · / });
  return user;
}

beforeEach(() => {
  fakeLayout();
  vi.mocked(listAlerts).mockResolvedValue([]);
  vi.mocked(getContactNames).mockResolvedValue(new Map([['contact-001', 'Ana Prueba Mora']]));
  vi.mocked(changeSaleStage).mockResolvedValue({ contactBecameClient: false, contactName: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Arrastre de tarjetas: la tarjeta sigue siendo un enlace', () => {
  it('un clic normal abre el detalle', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    await user.click(card('Venta s1'));
    expect(currentLocation.pathname).toBe('/posibles-ventas/s1');
    expect(changeSaleStage).not.toHaveBeenCalled();
  });

  it('Enter sobre la tarjeta abre el detalle (la barra espaciadora es la que la toma)', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    card('Venta s1').focus();
    await user.keyboard('{Enter}');
    expect(currentLocation.pathname).toBe('/posibles-ventas/s1');
  });

  it('las tarjetas arrastrables tienen las instrucciones para lector de pantalla, en español', async () => {
    await setup([sale('s1', 'contactado')]);
    const describedBy = card('Venta s1').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await waitFor(() => expect(document.getElementById(describedBy!)).not.toBeNull());
    expect(document.getElementById(describedBy!)?.textContent).toMatch(/^Para mover esta oportunidad de venta a otra etapa, presione la barra espaciadora/);
  });
});

describe('Arrastre con teclado', () => {
  it('mientras se arrastra, resalta las columnas permitidas y atenúa las no permitidas', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 0);
    const zones = SALE_STAGES.map((stage) => document.querySelector(`.board-column-${stage}`)?.getAttribute('data-drop'));
    expect(zones).toEqual(['permitida', 'origen', 'permitida', 'bloqueada', 'bloqueada', 'permitida']);
    expect(column('En negociación').className).toContain('is-drop-bloqueada');
    expect(column('Nuevo interesado').className).toContain('is-drop-permitida');
    // La región en vivo muestra el último anuncio: tras "Se tomó…" llega el de la columna en la que está.
    expect(screen.getByText('Sobre su columna de origen, Contactado.')).toBeTruthy();
    await press(user, '[Escape]');
    expect(document.querySelector('[data-drop]')).toBeNull();
  });

  it('a una columna permitida: cambia la etapa, la tarjeta pasa a esa columna y aparece la franja verde', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    expect(column('Precio o cotización enviada').className).toContain('is-drop-over');
    expect(screen.getByText('Sobre la columna Precio o cotización enviada. Se puede soltar aquí.')).toBeTruthy();
    await press(user, '[Space]');
    expect(changeSaleStage).toHaveBeenCalledWith('s1', 'contactado', 'cotizacion_enviada');
    expect(await screen.findByText('Etapa actualizada correctamente.')).toBeTruthy();
    expect(columnOf('Venta s1')).toBe('Precio o cotización enviada');
    expect(screen.getByRole('heading', { name: 'Precio o cotización enviada · 1 · ₡ 100 000' })).toBeTruthy();
    // El foco vuelve a la tarjeta en su nueva columna.
    await waitFor(() => expect(document.activeElement).toBe(card('Venta s1')));
  });

  it('a una columna no permitida: no cambia nada y la tarjeta se queda en la suya', async () => {
    const user = await setup([sale('s1', 'nuevo_interesado')]);
    await keyboardDrag(user, 'Venta s1', 2);
    expect(screen.getByText('Sobre la columna Precio o cotización enviada. No se puede pasar a esta etapa.')).toBeTruthy();
    expect(column('Precio o cotización enviada').className).not.toContain('is-drop-over');
    await press(user, '[Space]');
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Nuevo interesado');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('La oportunidad de venta "Venta s1" volvió a la columna Nuevo interesado.')).toBeTruthy();
  });

  it('soltar en su misma columna no hace nada', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    await press(user, '[ArrowLeft]', '[Enter]');
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Contactado');
    expect(currentLocation.pathname).toBe('/posibles-ventas');
  });

  it('Escape cancela el arrastre', async () => {
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    await press(user, '[Escape]');
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Contactado');
    expect(screen.getByText('Se canceló el movimiento. La oportunidad de venta "Venta s1" volvió a la columna Contactado.')).toBeTruthy();
  });

  it('a "Venta ganada" abre la ventana "Cambiar etapa" con esa etapa elegida y la confirmación de HU-313', async () => {
    vi.mocked(changeSaleStage).mockResolvedValue({ contactBecameClient: true, contactName: 'Ana Prueba Mora' });
    const user = await setup([sale('s1', 'cotizacion_enviada')]);
    await keyboardDrag(user, 'Venta s1', 2);
    await press(user, '[Space]');
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar etapa' });
    expect((within(dialog).getByRole('radio', { name: 'Venta ganada' }) as HTMLInputElement).checked).toBe(true);
    expect(
      within(dialog).getByText('¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.'),
    ).toBeTruthy();
    // Nada cambia hasta aceptar.
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Precio o cotización enviada');
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar' }));
    expect(changeSaleStage).toHaveBeenCalledWith('s1', 'cotizacion_enviada', 'ganada', undefined);
    expect(await screen.findByText('Venta ganada. Ana Prueba Mora ahora es cliente.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(columnOf('Venta s1')).toBe('Venta ganada');
  });

  it('a "Venta perdida" abre la ventana con la pregunta y el motivo; al aceptar guarda el motivo', async () => {
    const user = await setup([sale('s1', 'en_negociacion')]);
    await keyboardDrag(user, 'Venta s1', 2);
    await press(user, '[Space]');
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar etapa' });
    expect((within(dialog).getByRole('radio', { name: 'Venta perdida' }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByText('¿Está seguro de que desea marcar esta venta como perdida?')).toBeTruthy();
    const reason = within(dialog).getByLabelText(/Motivo de la pérdida/);
    expect(document.activeElement).toBe(reason);
    await user.type(reason, 'Compró a otro proveedor');
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar' }));
    expect(changeSaleStage).toHaveBeenCalledWith('s1', 'en_negociacion', 'perdida', 'Compró a otro proveedor');
    expect(await screen.findByText('Oportunidad de venta marcada como perdida.')).toBeTruthy();
    expect(columnOf('Venta s1')).toBe('Venta perdida');
  });

  it('en la ventana, "Cancelar" deja la tarjeta en su etapa', async () => {
    const user = await setup([sale('s1', 'en_negociacion')]);
    await keyboardDrag(user, 'Venta s1', 2);
    await press(user, '[Space]');
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar etapa' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('En negociación');
  });

  it('de "Venta perdida" a una etapa abierta la reabre directo (HU-312)', async () => {
    const user = await setup([sale('s1', 'perdida')]);
    await keyboardDrag(user, 'Venta s1', -2);
    await press(user, '[Space]');
    expect(changeSaleStage).toHaveBeenCalledWith('s1', 'perdida', 'en_negociacion');
    expect(await screen.findByText('Oportunidad de venta reabierta correctamente.')).toBeTruthy();
    expect(columnOf('Venta s1')).toBe('En negociación');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('de "Venta perdida" a "Venta ganada" no se puede', async () => {
    const user = await setup([sale('s1', 'perdida')]);
    await keyboardDrag(user, 'Venta s1', -1);
    expect(column('Venta ganada').getAttribute('data-drop')).toBe('bloqueada');
    await press(user, '[Space]');
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('una tarjeta en "Venta ganada" no se puede arrastrar', async () => {
    const user = await setup([sale('s1', 'ganada')]);
    expect(card('Venta s1').getAttribute('aria-describedby')).toBeNull();
    expect(card('Venta s1').closest('li')?.className).not.toContain('is-draggable');
    await keyboardDrag(user, 'Venta s1', -1);
    await press(user, '[Space]');
    expect(document.querySelector('[data-drop]')).toBeNull();
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Venta ganada');
  });
});

describe('Errores al guardar', () => {
  it('si falla, la tarjeta vuelve a su columna y aparece el mensaje de error', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new Error('sin red'));
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    await press(user, '[Space]');
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cambiar la etapa. Intente de nuevo.');
    expect(columnOf('Venta s1')).toBe('Contactado');
    expect(screen.getByRole('heading', { name: 'Precio o cotización enviada · 0 · ₡ 0' })).toBeTruthy();
    expect(screen.queryByText('Etapa actualizada correctamente.')).toBeNull();
  });

  it('si la etapa cambió en otra pantalla, muestra el mensaje de conflicto y vuelve a leer el tablero', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new SaleStageConflictError());
    const user = await setup([sale('s1', 'contactado')]);
    vi.mocked(listBoardSales).mockResolvedValue([sale('s1', 'nuevo_interesado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    await press(user, '[Space]');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'La etapa de esta oportunidad de venta cambió. Cierre esta ventana y vuelva a intentarlo.',
    );
    expect(listBoardSales).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(columnOf('Venta s1')).toBe('Nuevo interesado'));
  });

  it('al reabrir con un título repetido, muestra el mensaje de HU-312 y la tarjeta vuelve a "Venta perdida"', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new SaleReopenDuplicateTitleError());
    const user = await setup([sale('s1', 'perdida')]);
    await keyboardDrag(user, 'Venta s1', -3);
    await press(user, '[Space]');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este contacto ya tiene una oportunidad de venta abierta con este título. Cambie el título antes de reabrirla.',
    );
    expect(columnOf('Venta s1')).toBe('Venta perdida');
  });

  it('mientras se guarda, la misma tarjeta no se puede arrastrar otra vez', async () => {
    let finish: (value: { contactBecameClient: boolean; contactName: null }) => void = () => undefined;
    vi.mocked(changeSaleStage).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = await setup([sale('s1', 'contactado')]);
    await keyboardDrag(user, 'Venta s1', 1);
    await press(user, '[Space]');
    await waitFor(() => expect(card('Venta s1').closest('li')?.getAttribute('aria-busy')).toBe('true'));
    expect(card('Venta s1').getAttribute('aria-describedby')).toBeNull();
    await keyboardDrag(user, 'Venta s1', 1);
    expect(document.querySelector('[data-drop]')).toBeNull();
    await act(async () => finish({ contactBecameClient: false, contactName: null }));
    expect(changeSaleStage).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(card('Venta s1').closest('li')?.getAttribute('aria-busy')).toBeNull());
  });
});

describe('Arrastre con ratón (con posiciones simuladas)', () => {
  async function mouseDrag(title: string, to: SaleStage) {
    const link = card(title);
    const startX = link.getBoundingClientRect().left + 20;
    fireEvent.mouseDown(link, { button: 0, clientX: startX, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: startX + 10, clientY: 120 });
    await tick();
    fireEvent.mouseMove(document, { clientX: columnCenter(to), clientY: 300 });
    await tick();
  }

  it('moverlo menos de 6 px no empieza el arrastre', async () => {
    await setup([sale('s1', 'contactado')]);
    const link = card('Venta s1');
    fireEvent.mouseDown(link, { button: 0, clientX: 180, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 183, clientY: 121 });
    await tick();
    expect(document.querySelector('[data-drop]')).toBeNull();
    fireEvent.mouseUp(document, { clientX: 183, clientY: 121 });
  });

  it('soltar en una columna permitida cambia la etapa, y el clic que sigue no abre el detalle', async () => {
    await setup([sale('s1', 'contactado')]);
    await mouseDrag('Venta s1', 'cotizacion_enviada');
    expect(column('Precio o cotización enviada').className).toContain('is-drop-over');
    fireEvent.mouseUp(document, { clientX: columnCenter('cotizacion_enviada'), clientY: 300 });
    fireEvent.click(card('Venta s1'));
    expect(changeSaleStage).toHaveBeenCalledWith('s1', 'contactado', 'cotizacion_enviada');
    expect(await screen.findByText('Etapa actualizada correctamente.')).toBeTruthy();
    expect(currentLocation.pathname).toBe('/posibles-ventas');
  });

  it('soltar en una columna no permitida no cambia nada', async () => {
    await setup([sale('s1', 'contactado')]);
    await mouseDrag('Venta s1', 'en_negociacion');
    expect(column('En negociación').className).toContain('is-drop-bloqueada');
    expect(column('En negociación').className).not.toContain('is-drop-over');
    fireEvent.mouseUp(document, { clientX: columnCenter('en_negociacion'), clientY: 300 });
    await tick();
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(columnOf('Venta s1')).toBe('Contactado');
  });

  it('soltar en "Venta perdida" abre la ventana con esa etapa elegida', async () => {
    await setup([sale('s1', 'contactado')]);
    await mouseDrag('Venta s1', 'perdida');
    fireEvent.mouseUp(document, { clientX: columnCenter('perdida'), clientY: 300 });
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar etapa' });
    expect((within(dialog).getByRole('radio', { name: 'Venta perdida' }) as HTMLInputElement).checked).toBe(true);
    expect(changeSaleStage).not.toHaveBeenCalled();
  });
});
