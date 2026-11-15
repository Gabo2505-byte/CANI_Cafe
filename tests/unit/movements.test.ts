// Tabla de movimientos: preparación de las filas (sin Firebase).
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { buildMovementRows, MOVEMENTS_MESSAGES, MOVEMENTS_PAGE_SIZE, type StageHistoryEntry } from '../../src/sales/movements';
import type { SaleStage } from '../../src/shared/types';

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const entry = (
  id: string,
  saleId: string,
  changedAt: string,
  previousStage: SaleStage | null,
  newStage: SaleStage,
  lossReason: string | null = null,
): StageHistoryEntry => ({ id, saleId, changedAt: at(changedAt), previousStage, newStage, lossReason });

const sales = new Map([
  ['s-1', { title: 'Café para cafetería', contactId: 'c-1' }],
  ['s-2', { title: 'Muestras para eventos', contactId: 'c-2' }],
  ['s-3', { title: 'Contacto borrado', contactId: 'c-9' }],
]);
const contacts = new Map<string, string | null>([
  ['c-1', 'Ana Activa'],
  ['c-2', 'Bruno Prueba'],
  ['c-9', null],
]);

describe('tabla de movimientos: filas', () => {
  it('van del cambio más reciente al más antiguo, mezclando ventas, sin modificar la lista original', () => {
    const original = [
      entry('s-1_01', 's-1', '2026-09-01T12:00:00Z', null, 'nuevo_interesado'),
      entry('s-2_02', 's-2', '2026-10-08T12:00:00Z', 'contactado', 'perdida', 'Eligió otro proveedor.'),
      entry('s-1_02', 's-1', '2026-09-10T12:00:00Z', 'nuevo_interesado', 'contactado'),
      entry('s-2_01', 's-2', '2026-09-05T12:00:00Z', null, 'contactado'),
    ];
    expect(buildMovementRows(original, sales, contacts).map((r) => r.id)).toEqual(['s-2_02', 's-1_02', 's-2_01', 's-1_01']);
    expect(original[0].id).toBe('s-1_01');
  });

  it('con la misma fecha conserva el orden en que llegaron (el de la consulta)', () => {
    const rows = buildMovementRows(
      [
        entry('b', 's-1', '2026-09-01T12:00:00Z', null, 'nuevo_interesado'),
        entry('a', 's-2', '2026-09-01T12:00:00Z', null, 'contactado'),
      ],
      sales,
      contacts,
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('la entrada inicial no tiene etapa anterior: muestra "—"', () => {
    const [row] = buildMovementRows([entry('s-1_01', 's-1', '2026-09-01T12:00:00Z', null, 'nuevo_interesado')], sales, contacts);
    expect(row.previousStageLabel).toBe('—');
    expect(row.newStageLabel).toBe('Nuevo interesado');
  });

  it('usa las etiquetas de etapa de la aplicación', () => {
    const [row] = buildMovementRows(
      [entry('x', 's-1', '2026-09-01T12:00:00Z', 'cotizacion_enviada', 'en_negociacion')],
      sales,
      contacts,
    );
    expect(row.previousStageLabel).toBe('Precio o cotización enviada');
    expect(row.newStageLabel).toBe('En negociación');
  });

  it('el motivo solo aparece en los cambios a "Venta perdida"', () => {
    const rows = buildMovementRows(
      [
        entry('p', 's-1', '2026-09-03T12:00:00Z', 'contactado', 'perdida', 'Eligió otro proveedor.'),
        entry('q', 's-1', '2026-09-02T12:00:00Z', 'contactado', 'perdida', null),
        // Un motivo guardado por error en un cambio que no es pérdida no se muestra.
        entry('r', 's-1', '2026-09-01T12:00:00Z', 'perdida', 'contactado', 'No debería verse'),
      ],
      sales,
      contacts,
    );
    expect(rows.map((r) => r.reason)).toEqual(['Eligió otro proveedor.', 'Sin motivo registrado', '']);
  });

  it('cada fila lleva la venta, su título y el nombre del contacto', () => {
    const [row] = buildMovementRows([entry('s-2_01', 's-2', '2026-09-05T12:00:00Z', null, 'contactado')], sales, contacts);
    expect(row).toMatchObject({ saleId: 's-2', saleTitle: 'Muestras para eventos', contactName: 'Bruno Prueba' });
    expect(row.changedAt.toMillis()).toBe(at('2026-09-05T12:00:00Z').toMillis());
  });

  it('si la venta o el contacto ya no existen, muestra "—" (y sin título, la fila no lleva enlace)', () => {
    const rows = buildMovementRows(
      [
        entry('sin-contacto', 's-3', '2026-09-02T12:00:00Z', null, 'contactado'),
        entry('sin-venta', 's-404', '2026-09-01T12:00:00Z', null, 'contactado'),
      ],
      new Map([...sales, ['s-404', null]]),
      contacts,
    );
    expect(rows[0]).toMatchObject({ saleTitle: 'Contacto borrado', contactName: '—' });
    expect(rows[1]).toMatchObject({ saleTitle: null, contactName: '—' });
  });

  it('sin registros no hay filas; la página es de 25', () => {
    expect(buildMovementRows([], sales, contacts)).toEqual([]);
    expect(MOVEMENTS_PAGE_SIZE).toBe(25);
    expect(MOVEMENTS_MESSAGES).toMatchObject({ title: 'Movimientos', loadMore: 'Cargar más' });
  });
});
