import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router';
import { saleDetailPath } from '../app/routes';
import { formatDateNumericCR } from '../shared/utils/dates';
import { formatColones } from '../shared/utils/money';
import { BOARD_MESSAGES, type BoardSale } from './board';

interface SaleCardProps {
  item: BoardSale;
  /** ¿Tiene un aviso pendiente? Avisos de HU-314 y HU-315. */
  hasAlert?: boolean;
  /** La fecha de seguimiento ya pasó (aviso "Seguimiento vencido" de HU-314): se muestra en rojo. */
  followUpOverdue?: boolean;
  /** No se puede arrastrar (una venta ganada no tiene destinos). */
  dragDisabled?: boolean;
  /** Se está guardando su cambio de etapa: no se puede arrastrar otra vez hasta que termine. */
  saving?: boolean;
}

/** Contenido de la tarjeta (se repite en la copia que sigue al ratón mientras se arrastra). */
export function SaleCardContent({ item, hasAlert = false, followUpOverdue = false }: Omit<SaleCardProps, 'dragDisabled' | 'saving'>) {
  const { sale, contactName } = item;
  return (
    <>
      <span className="sale-card-contact">
        {contactName}
        {hasAlert && (
          <span className="sale-card-bell" role="img" aria-label="Aviso pendiente">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Zm-2.2 15.5a2.3 2.3 0 0 0 4.4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>
      <span className="sale-card-title">{sale.title}</span>
      <span className="sale-card-amount">{formatColones(sale.estimatedAmount)}</span>
      <span className={followUpOverdue ? 'sale-card-follow-up is-overdue' : 'sale-card-follow-up'}>
        {sale.nextFollowUpAt ? `Seguimiento: ${formatDateNumericCR(sale.nextFollowUpAt)}` : BOARD_MESSAGES.noFollowUp}
      </span>
    </>
  );
}

/**
 * HU-305: tarjeta de una posible venta. Al dar clic se abre su detalle.
 * Arrastre en el tablero: la tarjeta se puede arrastrar a otra columna (con el ratón tras moverlo unos píxeles, en
 * pantallas táctiles tras una pulsación breve y con el teclado con la barra espaciadora). Sigue siendo un enlace.
 */
export function SaleCard({ item, hasAlert = false, followUpOverdue = false, dragDisabled = false, saving = false }: SaleCardProps) {
  const { sale } = item;
  const disabled = dragDisabled || saving;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sale.id, disabled, data: { stage: sale.stage } });
  const classes = ['sale-card'];
  if (!disabled) classes.push('is-draggable');
  if (isDragging) classes.push('is-dragging');
  if (saving) classes.push('is-saving');
  return (
    <li className={classes.join(' ')} aria-busy={saving || undefined}>
      <Link
        ref={setNodeRef}
        to={saleDetailPath(sale.id)}
        className="sale-card-link"
        data-sale-id={sale.id}
        // El enlace del navegador no se arrastra por su cuenta: el arrastre es el del tablero.
        draggable={false}
        aria-describedby={disabled ? undefined : attributes['aria-describedby']}
        {...(disabled ? {} : listeners)}
      >
        <SaleCardContent item={item} hasAlert={hasAlert} followUpOverdue={followUpOverdue} />
      </Link>
    </li>
  );
}
