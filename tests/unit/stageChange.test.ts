import { describe, expect, it } from 'vitest';
import {
  canChangeStage,
  isValidStageChange,
  LOSS_REASON_MAX,
  lossReasonError,
  normalizeLossReason,
  stageOptions,
} from '../../src/sales/stageChange';
import { OPEN_SALE_STAGES, SALE_STAGES, type SaleStage } from '../../src/shared/types';

describe('HU-310 quién puede cambiar de etapa', () => {
  it.each(OPEN_SALE_STAGES)('una posible venta en "%s" sí', (stage) => {
    expect(canChangeStage({ stage })).toBe(true);
  });
  it.each(['ganada', 'perdida'] as const)('una "%s" no', (stage) => {
    expect(canChangeStage({ stage })).toBe(false);
  });
});

describe('HU-310 opciones de la ventana', () => {
  it('son las seis etapas, en el orden del tablero', () => {
    expect(stageOptions('contactado').map((o) => o.label)).toEqual([
      'Nuevo interesado',
      'Contactado',
      'Precio o cotización enviada',
      'En negociación',
      'Venta ganada',
      'Venta perdida',
    ]);
  });

  it('marca solo la etapa actual', () => {
    for (const stage of OPEN_SALE_STAGES) {
      const current = stageOptions(stage).filter((o) => o.current);
      expect(current.map((o) => o.stage)).toEqual([stage]);
    }
  });

  it('desde una etapa abierta se pueden elegir las otras tres abiertas (hacia adelante y hacia atrás) y "Venta perdida"', () => {
    for (const from of OPEN_SALE_STAGES) {
      const selectable = stageOptions(from)
        .filter((o) => o.selectable)
        .map((o) => o.stage);
      expect(selectable).toEqual([...OPEN_SALE_STAGES.filter((s) => s !== from), 'perdida']);
    }
  });

  it('"Venta ganada" aparece pero todavía no se puede elegir (HU-313); la actual tampoco cuenta como cambio', () => {
    const options = stageOptions('nuevo_interesado');
    expect(options.find((o) => o.stage === 'ganada')).toMatchObject({ selectable: false, current: false });
    expect(options.find((o) => o.stage === 'perdida')).toMatchObject({ selectable: true, current: false });
    expect(options.find((o) => o.stage === 'nuevo_interesado')).toMatchObject({ selectable: false, current: true });
  });
});

describe('HU-310/HU-311 cambios válidos', () => {
  it('toda pareja de etapas abiertas distintas es válida', () => {
    for (const from of OPEN_SALE_STAGES) {
      for (const to of OPEN_SALE_STAGES) expect(isValidStageChange(from, to)).toBe(from !== to);
    }
  });

  it('desde cualquier etapa abierta se puede marcar como perdida', () => {
    for (const from of OPEN_SALE_STAGES) expect(isValidStageChange(from, 'perdida')).toBe(true);
  });

  it('no se puede salir de ganada ni de perdida, ni quedarse en la misma etapa, ni (todavía) ir a ganada', () => {
    const closed: SaleStage[] = ['ganada', 'perdida'];
    for (const from of closed) for (const to of SALE_STAGES) expect(isValidStageChange(from, to)).toBe(false);
    for (const from of OPEN_SALE_STAGES) expect(isValidStageChange(from, 'ganada')).toBe(false);
  });
});

describe('HU-311 motivo de la pérdida', () => {
  it('es opcional: vacío o solo espacios no es un error y se guarda como null', () => {
    for (const text of ['', '   ', '\n']) {
      expect(lossReasonError(text)).toBeNull();
      expect(normalizeLossReason(text)).toBeNull();
    }
  });

  it('se guarda sin espacios a los lados', () => {
    expect(normalizeLossReason('  Eligió otro proveedor.  ')).toBe('Eligió otro proveedor.');
  });

  it('acepta hasta 250 caracteres; con 251 avisa', () => {
    expect(LOSS_REASON_MAX).toBe(250);
    expect(lossReasonError('m'.repeat(250))).toBeNull();
    expect(lossReasonError('m'.repeat(251))).toBe('El motivo acepta como máximo 250 caracteres.');
  });
});
