import { useId } from 'react';
import { SELLO } from '../contenido';

/**
 * Sello redondo que gira despacio (rediseño): anillos dorados, el texto en arco arriba y abajo, y una hoja de café al
 * centro. Es decorativo (aria-hidden): no agrega información a la página. Sin movimiento si el sistema pide reducirlo.
 */
export function SelloCafe() {
  const uid = useId();
  const arcoArriba = `${uid}-arriba`;
  const arcoAbajo = `${uid}-abajo`;

  return (
    <div className="pub-sello" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Arcos por donde corre el texto, entre los dos anillos */}
          <path id={arcoArriba} d="M 26,100 A 74,74 0 0,1 174,100" fill="none" />
          <path id={arcoAbajo} d="M 18,100 A 82,82 0 0,0 182,100" fill="none" />
        </defs>

        <circle className="pub-sello-fondo" cx="100" cy="100" r="96" />
        <circle className="pub-sello-anillo" cx="100" cy="100" r="96" strokeWidth="3.5" />
        <circle className="pub-sello-anillo" cx="100" cy="100" r="62" strokeWidth="1.5" />

        <text className="pub-sello-texto">
          <textPath href={`#${arcoArriba}`} startOffset="50%" textAnchor="middle">
            {SELLO.arriba}
          </textPath>
        </text>
        <text className="pub-sello-texto">
          <textPath href={`#${arcoAbajo}`} startOffset="50%" textAnchor="middle">
            {SELLO.abajo}
          </textPath>
        </text>

        <circle className="pub-sello-punto" cx="21" cy="100" r="3" />
        <circle className="pub-sello-punto" cx="179" cy="100" r="3" />

        {/* Hoja de café con su nervadura, inclinada */}
        <g transform="rotate(-35 100 100)">
          <path
            className="pub-sello-hoja"
            d="M100 56 C 124 72, 128 112, 100 144 C 72 112, 76 72, 100 56 Z"
          />
          <path
            className="pub-sello-nervio"
            d="M100 62 L100 150 M100 82 L112 74 M100 82 L88 74 M100 100 L115 90 M100 100 L85 90 M100 118 L113 109 M100 118 L87 109"
          />
        </g>
      </svg>
    </div>
  );
}
