import { describe, expect, it } from 'vitest';
import { canChangeStage, isValidStageChange, stageOptions } from '../../src/sales/stageChange';
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

  it('desde una etapa abierta se pueden elegir las otras tres abiertas, hacia adelante y hacia atrás', () => {
    for (const from of OPEN_SALE_STAGES) {
      const selectable = stageOptions(from)
        .filter((o) => o.selectable)
        .map((o) => o.stage);
      expect(selectable).toEqual(OPEN_SALE_STAGES.filter((s) => s !== from));
    }
  });

  it('ganada y perdida aparecen pero todavía no se pueden elegir; la actual tampoco cuenta como cambio', () => {
    const options = stageOptions('nuevo_interesado');
    expect(options.find((o) => o.stage === 'ganada')).toMatchObject({ selectable: false, current: false });
    expect(options.find((o) => o.stage === 'perdida')).toMatchObject({ selectable: false, current: false });
    expect(options.find((o) => o.stage === 'nuevo_interesado')).toMatchObject({ selectable: false, current: true });
  });
});

describe('HU-310 cambios válidos', () => {
  it('toda pareja de etapas abiertas distintas es válida', () => {
    for (const from of OPEN_SALE_STAGES) {
      for (const to of OPEN_SALE_STAGES) expect(isValidStageChange(from, to)).toBe(from !== to);
    }
  });

  it('no se puede salir de ganada ni de perdida, ni quedarse en la misma etapa, ni ir (todavía) a ganada o perdida', () => {
    const closed: SaleStage[] = ['ganada', 'perdida'];
    for (const from of closed) for (const to of SALE_STAGES) expect(isValidStageChange(from, to)).toBe(false);
    for (const to of closed) for (const from of OPEN_SALE_STAGES) expect(isValidStageChange(from, to)).toBe(false);
  });
});
