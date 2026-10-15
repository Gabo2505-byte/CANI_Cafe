import { useNavigate } from 'react-router';
import { ROUTES } from '../app/routes';
import { useLocationNotice } from '../shared/hooks/useLocationNotice';
import { TimedNotice } from './TimedNotice';

/**
 * Pantalla "Posibles ventas". HU-301: botón "Nueva posible venta" arriba a la derecha y
 * confirmación al registrar una. El tablero de seis columnas es HU-305.
 */
export function SalesBoardPage() {
  const navigate = useNavigate();
  const notice = useLocationNotice();
  return (
    <main className="page">
      <TimedNotice message={notice} />
      <div className="page-header">
        <h1>Posibles ventas</h1>
        <button type="button" onClick={() => navigate(ROUTES.newSale)}>
          Nueva posible venta
        </button>
      </div>
    </main>
  );
}
