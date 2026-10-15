import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { formatProductLine, lossReasonText, sortHistory } from '../../src/sales/saleDetail';
import type { SaleStage, StageHistory } from '../../src/shared/types';

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const entry = (changedAt: string, previousStage: SaleStage | null, newStage: SaleStage, lossReason: string | null = null): StageHistory => ({
  saleId: 's-1',
  previousStage,
  newStage,
  changedAt: at(changedAt),
  lossReason,
});

describe('HU-308 historial de etapas', () => {
  it('va del cambio más reciente al más antiguo y no modifica la lista original', () => {
    const original = [
      entry('2026-09-18T17:00:00Z', 'nuevo_interesado', 'contactado'),
      entry('2026-10-01T16:00:00Z', 'cotizacion_enviada', 'en_negociacion'),
      entry('2026-09-15T15:00:00Z', null, 'nuevo_interesado'),
    ];
    expect(sortHistory(original).map((e) => e.newStage)).toEqual(['en_negociacion', 'contactado', 'nuevo_interesado']);
    expect(original[0].newStage).toBe('contactado');
  });

  it('el cambio a "Venta perdida" muestra el motivo escrito', () => {
    expect(lossReasonText(entry('2026-10-08T21:00:00Z', 'contactado', 'perdida', 'Eligió otro proveedor.'))).toBe(
      'Eligió otro proveedor.',
    );
  });

  it.each([null, '', '   '])('perdida con motivo %j: "Sin motivo registrado"', (reason) => {
    expect(lossReasonText(entry('2026-10-08T21:00:00Z', 'contactado', 'perdida', reason))).toBe('Sin motivo registrado');
  });

  it('los demás cambios no muestran motivo', () => {
    expect(lossReasonText(entry('2026-10-08T21:00:00Z', 'contactado', 'en_negociacion'))).toBeNull();
    expect(lossReasonText(entry('2026-10-08T21:00:00Z', 'en_negociacion', 'ganada'))).toBeNull();
  });
});

describe('HU-308 productos', () => {
  const product = { productId: 'p1', name: 'Café en grano', presentation: 'Bolsa de 340 g' };
  it('muestra nombre, presentación y cantidad', () => {
    expect(formatProductLine({ ...product, quantity: 20 })).toBe('Café en grano · Bolsa de 340 g — 20 unidades');
  });
  it('una sola unidad en singular', () => {
    expect(formatProductLine({ ...product, quantity: 1 })).toBe('Café en grano · Bolsa de 340 g — 1 unidad');
  });
});
