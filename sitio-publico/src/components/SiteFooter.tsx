import { DatosContacto } from './DatosContacto';

/** Teléfono, correo y ubicación de CANI Café: aparecen al final de todas las páginas (y no se muestra nada más). */
export function SiteFooter() {
  return (
    <footer className="pub-footer">
      <DatosContacto className="pub-footer-inner" />
    </footer>
  );
}
