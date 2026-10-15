import { Link } from 'react-router';
import { saleDetailPath } from '../app/routes';
import { formatDateNumericCR } from '../shared/utils/dates';
import { formatColones } from '../shared/utils/money';
import { BOARD_MESSAGES, type BoardSale } from './board';

interface SaleCardProps {
  item: BoardSale;
  /** ¿Tiene un aviso pendiente? Se conecta con los avisos de HU-314 y HU-315. */
  hasAlert?: boolean;
}

/** HU-305: tarjeta de una posible venta. Al dar clic se abre su detalle. */
export function SaleCard({ item, hasAlert = false }: SaleCardProps) {
  const { sale, contactName } = item;
  return (
    <li className="sale-card">
      <Link to={saleDetailPath(sale.id)} className="sale-card-link">
        <span className="sale-card-contact">
          {contactName}
          {hasAlert && (
            <span className="sale-card-bell" role="img" aria-label="Aviso pendiente">
              🔔
            </span>
          )}
        </span>
        <span className="sale-card-title">{sale.title}</span>
        <span className="sale-card-amount">{formatColones(sale.estimatedAmount)}</span>
        <span className="sale-card-follow-up">
          {sale.nextFollowUpAt ? `Seguimiento: ${formatDateNumericCR(sale.nextFollowUpAt)}` : BOARD_MESSAGES.noFollowUp}
        </span>
      </Link>
    </li>
  );
}
