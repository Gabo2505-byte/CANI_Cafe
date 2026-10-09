import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { formatDateCR, formatDateTimeCR, toCostaRicaDateKey } from '../../src/shared/utils/dates';

describe('fechas en hora de Costa Rica', () => {
  it('convierte UTC a UTC-6 al formatear', () => {
    const ts = Timestamp.fromDate(new Date('2026-10-08T18:00:00Z'));
    expect(formatDateTimeCR(ts)).toMatch(/12:00/);
  });

  it('usa el día de Costa Rica, no el de UTC, cerca de medianoche', () => {
    // 03:00 UTC del 9 oct = 21:00 del 8 oct en Costa Rica
    const ts = Timestamp.fromDate(new Date('2026-10-09T03:00:00Z'));
    expect(toCostaRicaDateKey(ts)).toBe('2026-10-08');
    expect(formatDateCR(ts)).toMatch(/8/);
    expect(formatDateCR(ts)).not.toMatch(/9/);
  });

  it('acepta Date y objetos con toDate() (Timestamp del Admin SDK)', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(toCostaRicaDateKey(date)).toBe('2026-01-15');
    expect(toCostaRicaDateKey({ toDate: () => date })).toBe('2026-01-15');
  });
});
