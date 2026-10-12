import { useNavigate } from 'react-router';
import { ROUTES } from '../app/routes';

/** Pantalla "Contactos". HU-201: botón "Nuevo contacto". La lista es HU-204. */
export function ContactsPage() {
  const navigate = useNavigate();

  return (
    <main className="page">
      <div className="page-header">
        <h1>Contactos</h1>
        <button type="button" onClick={() => navigate(ROUTES.newContact)}>
          Nuevo contacto
        </button>
      </div>
    </main>
  );
}
