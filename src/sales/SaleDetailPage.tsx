import { Link } from 'react-router';
import { ROUTES } from '../app/routes';

/** Provisional para que las tarjetas del tablero (HU-305) lleven a algún lado; el detalle real es HU-308. */
export function SaleDetailPage() {
  return (
    <main className="page">
      <h1>Detalle de la posible venta</h1>
      <Link to={ROUTES.salesBoard}>Volver a Posibles ventas</Link>
    </main>
  );
}
