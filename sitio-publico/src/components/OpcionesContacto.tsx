import type { ReactNode } from 'react';
import { DATOS_CONTACTO, ENLACES_CONTACTO } from '../contenido';

interface Opcion {
  clase: string;
  etiqueta: string;
  valor: string;
  enlace: string;
  /** Destino que se anuncia al lector de pantalla (el ícono lo dice solo visualmente). */
  destino: string;
  icono: ReactNode;
}

const OPCIONES: Opcion[] = [
  {
    clase: 'pub-opcion-whatsapp',
    etiqueta: 'Teléfono',
    valor: DATOS_CONTACTO.telefono,
    enlace: ENLACES_CONTACTO.whatsapp,
    destino: 'WhatsApp',
    icono: (
      <>
        <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.2 7.8c.2-.4.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.5.7c-.1.2-.1.4 0 .5.6 1.1 1.5 2 2.6 2.6.2.1.4.1.5 0l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.4 0 .5-.2 1.4-.9 1.8-.6.4-1.5.5-2.5.2a9 9 0 0 1-5.4-5.2c-.4-1-.2-2 .3-2.8Z" fill="currentColor" />
      </>
    ),
  },
  {
    clase: 'pub-opcion-correo',
    etiqueta: 'Correo',
    valor: DATOS_CONTACTO.correo,
    enlace: ENLACES_CONTACTO.correo,
    destino: 'Gmail',
    icono: (
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm2 .7v9.8h14V7.2l-7 5.3-7-5.3Z" fill="currentColor" />
    ),
  },
  {
    clase: 'pub-opcion-mapa',
    etiqueta: 'Ubicación',
    valor: DATOS_CONTACTO.ubicacion,
    enlace: ENLACES_CONTACTO.mapa,
    destino: 'Google Maps',
    icono: (
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill="currentColor" />
    ),
  },
];

/**
 * Datos de contacto de Contáctenos como tres tarjetas que se presionan (rediseño): teléfono → WhatsApp,
 * correo → Gmail y ubicación → Google Maps. Cada una abre en una pestaña nueva. El pie sigue usando DatosContacto.
 */
export function OpcionesContacto() {
  return (
    <ul className="pub-opciones">
      {OPCIONES.map((opcion) => (
        <li key={opcion.clase}>
          <a
            className={`pub-opcion ${opcion.clase}`}
            href={opcion.enlace}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${opcion.etiqueta}: ${opcion.valor} (abre ${opcion.destino})`}
          >
            <span className="pub-opcion-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                {opcion.icono}
              </svg>
            </span>
            <span className="pub-opcion-texto">
              <span className="pub-opcion-etiqueta">{opcion.etiqueta}</span>
              <span className="pub-opcion-valor">{opcion.valor}</span>
            </span>
            <span className="pub-opcion-flecha" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
