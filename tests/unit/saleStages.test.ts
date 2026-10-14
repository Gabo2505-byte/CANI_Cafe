import { describe, expect, it } from 'vitest';
import { isOpenSaleStage, OPEN_SALE_STAGES, SALE_STAGE_LABELS, SALE_STAGES } from '../../src/shared/types';

describe('etapas de una posible venta', () => {
  it('son seis, en el orden del tablero', () => {
    expect(SALE_STAGES.map((stage) => SALE_STAGE_LABELS[stage])).toEqual([
      'Nuevo interesado',
      'Contactado',
      'Precio o cotización enviada',
      'En negociación',
      'Venta ganada',
      'Venta perdida',
    ]);
  });

  it('solo las cuatro primeras son abiertas', () => {
    expect(OPEN_SALE_STAGES).toEqual(['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion']);
    expect(isOpenSaleStage('en_negociacion')).toBe(true);
    expect(isOpenSaleStage('ganada')).toBe(false);
    expect(isOpenSaleStage('perdida')).toBe(false);
  });
});
