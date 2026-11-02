import { DATOS_CONTACTO } from '../contenido';

/** Teléfono, correo y ubicación de CANI Café (lista compartida por el pie de las páginas y la columna de Contáctenos). */
export function DatosContacto({ className }: { className: string }) {
  return (
    <dl className={className}>
      <div>
        <dt>Teléfono</dt>
        <dd>
          <a href={`tel:${DATOS_CONTACTO.telefono.replace(/\s/g, '')}`}>{DATOS_CONTACTO.telefono}</a>
        </dd>
      </div>
      <div>
        <dt>Correo</dt>
        <dd>
          <a href={`mailto:${DATOS_CONTACTO.correo}`}>{DATOS_CONTACTO.correo}</a>
        </dd>
      </div>
      <div>
        <dt>Ubicación</dt>
        <dd>{DATOS_CONTACTO.ubicacion}</dd>
      </div>
    </dl>
  );
}
