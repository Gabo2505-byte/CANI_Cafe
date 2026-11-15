import { describe, expect, it } from 'vitest';
import {
  ALLOWED_STAGE_TRANSITIONS,
  canChangeStage,
  classificationAfterWin,
  invalidStageChangeMessage,
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

/** Los 16 cambios permitidos, escritos a mano (independientes del mapa del código). */
const VALID = new Set([
  'nuevo_interesado>contactado',
  'nuevo_interesado>perdida',
  'contactado>cotizacion_enviada',
  'contactado>nuevo_interesado',
  'contactado>perdida',
  'cotizacion_enviada>en_negociacion',
  'cotizacion_enviada>ganada',
  'cotizacion_enviada>contactado',
  'cotizacion_enviada>perdida',
  'en_negociacion>ganada',
  'en_negociacion>cotizacion_enviada',
  'en_negociacion>perdida',
  'perdida>nuevo_interesado',
  'perdida>contactado',
  'perdida>cotizacion_enviada',
  'perdida>en_negociacion',
]);

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

  it('desde cada etapa solo se pueden elegir los destinos del mapa de transiciones, en el orden del tablero', () => {
    for (const from of SALE_STAGES) {
      const selectable = stageOptions(from)
        .filter((o) => o.selectable)
        .map((o) => o.stage);
      expect(selectable).toEqual(SALE_STAGES.filter((to) => VALID.has(`${from}>${to}`)));
    }
  });

  it('la etapa actual no cuenta como un cambio', () => {
    expect(stageOptions('nuevo_interesado').find((o) => o.stage === 'nuevo_interesado')).toMatchObject({
      selectable: false,
      current: true,
    });
  });
});

describe('HU-310/HU-311/HU-313 cambios válidos (mapa de transiciones)', () => {
  // Las 36 combinaciones origen → destino, una por fila: true si el cambio está permitido.
  const TABLE: ReadonlyArray<[SaleStage, SaleStage, boolean]> = [
    ['nuevo_interesado', 'nuevo_interesado', false],
    ['nuevo_interesado', 'contactado', true],
    ['nuevo_interesado', 'cotizacion_enviada', false],
    ['nuevo_interesado', 'en_negociacion', false],
    ['nuevo_interesado', 'ganada', false],
    ['nuevo_interesado', 'perdida', true],

    ['contactado', 'nuevo_interesado', true],
    ['contactado', 'contactado', false],
    ['contactado', 'cotizacion_enviada', true],
    ['contactado', 'en_negociacion', false],
    ['contactado', 'ganada', false],
    ['contactado', 'perdida', true],

    ['cotizacion_enviada', 'nuevo_interesado', false],
    ['cotizacion_enviada', 'contactado', true],
    ['cotizacion_enviada', 'cotizacion_enviada', false],
    ['cotizacion_enviada', 'en_negociacion', true],
    ['cotizacion_enviada', 'ganada', true],
    ['cotizacion_enviada', 'perdida', true],

    ['en_negociacion', 'nuevo_interesado', false],
    ['en_negociacion', 'contactado', false],
    ['en_negociacion', 'cotizacion_enviada', true],
    ['en_negociacion', 'en_negociacion', false],
    ['en_negociacion', 'ganada', true],
    ['en_negociacion', 'perdida', true],

    ['ganada', 'nuevo_interesado', false],
    ['ganada', 'contactado', false],
    ['ganada', 'cotizacion_enviada', false],
    ['ganada', 'en_negociacion', false],
    ['ganada', 'ganada', false],
    ['ganada', 'perdida', false],

    ['perdida', 'nuevo_interesado', true],
    ['perdida', 'contactado', true],
    ['perdida', 'cotizacion_enviada', true],
    ['perdida', 'en_negociacion', true],
    ['perdida', 'ganada', false],
    ['perdida', 'perdida', false],
  ];

  it('la tabla cubre las 36 combinaciones, sin repetir ninguna', () => {
    const keys = new Set(TABLE.map(([from, to]) => `${from}>${to}`));
    expect(keys.size).toBe(36);
    for (const from of SALE_STAGES) for (const to of SALE_STAGES) expect(keys.has(`${from}>${to}`)).toBe(true);
    // Las filas válidas son exactamente los 16 cambios permitidos.
    expect(new Set(TABLE.filter(([, , valid]) => valid).map(([from, to]) => `${from}>${to}`))).toEqual(VALID);
  });

  it.each(TABLE)('%s → %s: %s', (from, to, valid) => {
    expect(isValidStageChange(from, to)).toBe(valid);
  });

  it('el mapa declarado coincide exactamente con la tabla (mismos destinos, ninguno de más)', () => {
    for (const from of SALE_STAGES) {
      const expected = TABLE.filter(([f, , valid]) => f === from && valid).map(([, to]) => to);
      expect([...ALLOWED_STAGE_TRANSITIONS[from]].sort()).toEqual([...expected].sort());
    }
  });

  it('ninguna etapa pasa a sí misma', () => {
    for (const stage of SALE_STAGES) {
      expect(isValidStageChange(stage, stage)).toBe(false);
      expect(ALLOWED_STAGE_TRANSITIONS[stage]).not.toContain(stage);
    }
  });

  it('"Venta ganada" solo se alcanza desde "Precio o cotización enviada" o "En negociación"', () => {
    expect(SALE_STAGES.filter((from) => isValidStageChange(from, 'ganada'))).toEqual(['cotizacion_enviada', 'en_negociacion']);
  });

  it('"Venta perdida" se alcanza desde las cuatro abiertas', () => {
    expect(SALE_STAGES.filter((from) => isValidStageChange(from, 'perdida'))).toEqual([...OPEN_SALE_STAGES]);
  });

  it('una etapa desconocida no es un cambio válido', () => {
    expect(isValidStageChange('contactado', 'otra' as SaleStage)).toBe(false);
    expect(isValidStageChange('otra' as SaleStage, 'contactado')).toBe(false);
  });

  it('el mensaje de un cambio no permitido dice la etapa de origen y la de destino', () => {
    expect(invalidStageChangeMessage('contactado', 'ganada')).toBe(
      'Cambio de etapa no permitido: de "Contactado" (contactado) a "Venta ganada" (ganada).',
    );
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
