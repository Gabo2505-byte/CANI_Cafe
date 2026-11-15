// Arrastre de tarjetas en el tablero: qué pasa al soltar una oportunidad de venta en cada columna.
import { describe, expect, it } from 'vitest';
import { BOARD_DRAG_MESSAGES, canDragSale, dropDecision, dropZoneState, type DropDecision } from '../../src/sales/board';
import { ALLOWED_STAGE_TRANSITIONS } from '../../src/sales/stageChange';
import { SALE_STAGES, type SaleStage } from '../../src/shared/types';

const N = 'no_permitido';
const D = 'cambio_directo';
const W = 'ventana_ganada';
const L = 'ventana_perdida';

/** Las 36 combinaciones de origen (fila) y destino (columna), en el orden del tablero. */
const EXPECTED: Record<SaleStage, Record<SaleStage, DropDecision>> = {
  nuevo_interesado: { nuevo_interesado: N, contactado: D, cotizacion_enviada: N, en_negociacion: N, ganada: N, perdida: L },
  contactado: { nuevo_interesado: D, contactado: N, cotizacion_enviada: D, en_negociacion: N, ganada: N, perdida: L },
  cotizacion_enviada: { nuevo_interesado: N, contactado: D, cotizacion_enviada: N, en_negociacion: D, ganada: W, perdida: L },
  en_negociacion: { nuevo_interesado: N, contactado: N, cotizacion_enviada: D, en_negociacion: N, ganada: W, perdida: L },
  ganada: { nuevo_interesado: N, contactado: N, cotizacion_enviada: N, en_negociacion: N, ganada: N, perdida: N },
  // HU-312: reabrir no pide confirmación, así que va directo; nunca a "Venta ganada".
  perdida: { nuevo_interesado: D, contactado: D, cotizacion_enviada: D, en_negociacion: D, ganada: N, perdida: N },
};

const combinations = SALE_STAGES.flatMap((from) => SALE_STAGES.map((to) => [from, to, EXPECTED[from][to]] as const));

describe('dropDecision: soltar una tarjeta en una columna', () => {
  it('la tabla cubre las 36 combinaciones', () => {
    expect(combinations).toHaveLength(36);
    expect(Object.keys(EXPECTED).sort()).toEqual([...SALE_STAGES].sort());
    for (const from of SALE_STAGES) expect(Object.keys(EXPECTED[from]).sort()).toEqual([...SALE_STAGES].sort());
  });

  it.each(combinations)('de %s a %s: %s', (from, to, expected) => {
    expect(dropDecision({ stage: from }, to)).toBe(expected);
  });

  it('solo los 16 cambios del mapa de transiciones son posibles', () => {
    const possible = combinations.filter(([, , decision]) => decision !== N);
    expect(possible).toHaveLength(16);
    for (const [from, to] of possible) expect(ALLOWED_STAGE_TRANSITIONS[from]).toContain(to);
  });

  it('soltar en la columna de origen no hace nada', () => {
    for (const stage of SALE_STAGES) expect(dropDecision({ stage }, stage)).toBe(N);
  });

  it('"Venta ganada" y "Venta perdida" siempre van por la ventana, nunca directo', () => {
    for (const [, to, decision] of combinations) {
      if (to === 'ganada') expect([N, W]).toContain(decision);
      if (to === 'perdida') expect([N, L]).toContain(decision);
    }
  });

  it('una etapa desconocida no se acepta', () => {
    expect(dropDecision({ stage: 'contactado' }, 'otra' as SaleStage)).toBe(N);
  });
});

describe('canDragSale', () => {
  it.each(SALE_STAGES.map((stage) => [stage, stage !== 'ganada'] as const))('%s: %s', (stage, expected) => {
    expect(canDragSale({ stage })).toBe(expected);
  });
});

describe('dropZoneState: cómo se ve cada columna mientras se arrastra', () => {
  it.each(combinations)('de %s, la columna %s', (from, to, decision) => {
    const expected = from === to ? 'origen' : decision === N ? 'bloqueada' : 'permitida';
    expect(dropZoneState(from, to)).toBe(expected);
  });
});

describe('BOARD_DRAG_MESSAGES', () => {
  it('anuncios en español con el título y la etapa', () => {
    expect(BOARD_DRAG_MESSAGES.start('Café para oficina', 'Contactado')).toBe(
      'Se tomó la oportunidad de venta "Café para oficina" de la columna Contactado.',
    );
    expect(BOARD_DRAG_MESSAGES.overAllowed('Venta perdida')).toBe('Sobre la columna Venta perdida. Se puede soltar aquí.');
    expect(BOARD_DRAG_MESSAGES.overBlocked('Venta ganada')).toBe('Sobre la columna Venta ganada. No se puede pasar a esta etapa.');
    expect(BOARD_DRAG_MESSAGES.overOrigin('Contactado')).toBe('Sobre su columna de origen, Contactado.');
    expect(BOARD_DRAG_MESSAGES.dropped('X', 'Contactado')).toBe('Se soltó la oportunidad de venta "X" en la columna Contactado.');
    expect(BOARD_DRAG_MESSAGES.returned('X', 'Contactado')).toBe('La oportunidad de venta "X" volvió a la columna Contactado.');
    expect(BOARD_DRAG_MESSAGES.cancelled('X', 'Contactado')).toBe(
      'Se canceló el movimiento. La oportunidad de venta "X" volvió a la columna Contactado.',
    );
  });
});
