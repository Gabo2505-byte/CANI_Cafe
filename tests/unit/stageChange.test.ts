import { describe, expect, it } from 'vitest';
import {
  canChangeStage,
  classificationAfterWin,
  isValidStageChange,
  LOSS_REASON_MAX,
  lossReasonError,
  normalizeLossReason,
  stageChangeNotice,
  stageOptions,
  STAGE_CHANGE_MESSAGES,
  wonAndConvertedMessage,
} from '../../src/sales/stageChange';
import { CONTACT_CLASSIFICATIONS, OPEN_SALE_STAGES, SALE_STAGES, type SaleStage } from '../../src/shared/types';

describe('HU-310 quién puede cambiar de etapa', () => {
  it.each(OPEN_SALE_STAGES)('una oportunidad de venta en "%s" sí', (stage) => {
    expect(canChangeStage({ stage })).toBe(true);
  });
  it('una "ganada" no (es definitiva)', () => {
    expect(canChangeStage({ stage: 'ganada' })).toBe(false);
  });
  it('una "perdida" sí (HU-312: se reabre)', () => {
    expect(canChangeStage({ stage: 'perdida' })).toBe(true);
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

  it('desde una etapa abierta se pueden elegir las otras cinco, hacia adelante y hacia atrás, incluidas ganada y perdida', () => {
    for (const from of OPEN_SALE_STAGES) {
      const selectable = stageOptions(from)
        .filter((o) => o.selectable)
        .map((o) => o.stage);
      expect(selectable).toEqual(SALE_STAGES.filter((s) => s !== from));
    }
  });

  it('la etapa actual no cuenta como un cambio', () => {
    expect(stageOptions('nuevo_interesado').find((o) => o.stage === 'nuevo_interesado')).toMatchObject({
      selectable: false,
      current: true,
    });
  });
});

describe('HU-310/HU-311/HU-313 cambios válidos', () => {
  it('desde cualquier etapa abierta a cualquier otra etapa distinta, incluidas ganada y perdida', () => {
    for (const from of OPEN_SALE_STAGES) {
      for (const to of SALE_STAGES) expect(isValidStageChange(from, to)).toBe(from !== to);
    }
  });

  it('desde ganada no se sale a ninguna etapa', () => {
    for (const to of SALE_STAGES) expect(isValidStageChange('ganada', to)).toBe(false);
  });

  it('HU-312: desde perdida solo a las cuatro abiertas, nunca a ganada ni a la misma', () => {
    const open: readonly SaleStage[] = OPEN_SALE_STAGES;
    for (const to of SALE_STAGES) expect(isValidStageChange('perdida', to)).toBe(open.includes(to));
    expect(isValidStageChange('perdida', 'ganada')).toBe(false);
  });
});

describe('HU-312 reabrir una perdida', () => {
  it('desde "Venta perdida" se pueden elegir las cuatro abiertas; "Venta ganada" aparece pero no se puede elegir', () => {
    const options = stageOptions('perdida');
    expect(options.filter((o) => o.selectable).map((o) => o.stage)).toEqual([...OPEN_SALE_STAGES]);
    expect(options.find((o) => o.stage === 'ganada')).toMatchObject({ selectable: false, current: false });
    expect(options.find((o) => o.stage === 'perdida')).toMatchObject({ selectable: false, current: true });
  });

  it('los textos son los del documento', () => {
    expect(STAGE_CHANGE_MESSAGES.reopened).toBe('Oportunidad de venta reabierta correctamente.');
    expect(STAGE_CHANGE_MESSAGES.reopenDuplicateTitle).toBe(
      'Este contacto ya tiene una oportunidad de venta abierta con este título. Cambie el título antes de reabrirla.',
    );
  });

  it('la franja verde al reabrir es la de HU-312, sea cual sea la etapa abierta elegida', () => {
    const none = { contactBecameClient: false, contactName: null };
    for (const to of OPEN_SALE_STAGES) expect(stageChangeNotice(to, none, 'perdida')).toBe('Oportunidad de venta reabierta correctamente.');
    expect(stageChangeNotice('contactado', none, 'nuevo_interesado')).toBe('Etapa actualizada correctamente.');
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

describe('HU-313 conversión a cliente', () => {
  it('una "Persona interesada" pasa a "Cliente"', () => {
    expect(classificationAfterWin('persona_interesada')).toBe('cliente');
  });

  it('quien ya es cliente sigue siéndolo', () => {
    expect(classificationAfterWin('cliente')).toBe('cliente');
  });

  it('distribuidor y otro no se tocan (el PDF no los menciona)', () => {
    expect(classificationAfterWin('distribuidor')).toBe('distribuidor');
    expect(classificationAfterWin('otro')).toBe('otro');
  });

  it('solo "Persona interesada" cambia de clasificación', () => {
    const changed = CONTACT_CLASSIFICATIONS.filter((c) => classificationAfterWin(c) !== c);
    expect(changed).toEqual(['persona_interesada']);
  });
});

describe('HU-313 textos', () => {
  it('la pregunta es la del documento', () => {
    expect(STAGE_CHANGE_MESSAGES.winQuestion).toBe(
      '¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.',
    );
  });

  it('el mensaje con el nombre del contacto', () => {
    expect(wonAndConvertedMessage('Ana Prueba Mora')).toBe('Venta ganada. Ana Prueba Mora ahora es cliente.');
  });

  it('franja verde de cada cambio', () => {
    const none = { contactBecameClient: false, contactName: null };
    expect(stageChangeNotice('ganada', { contactBecameClient: true, contactName: 'Ana Prueba Mora' })).toBe(
      'Venta ganada. Ana Prueba Mora ahora es cliente.',
    );
    expect(stageChangeNotice('ganada', none)).toBe('Venta ganada correctamente.');
    expect(stageChangeNotice('perdida', none)).toBe('Oportunidad de venta marcada como perdida.');
    expect(stageChangeNotice('contactado', none)).toBe('Etapa actualizada correctamente.');
  });
});
