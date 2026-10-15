import { describe, expect, it } from 'vitest';
import { formatColones } from '../../src/shared/utils/money';

describe('formatColones', () => {
  it.each([
    [0, '₡ 0'],
    [999, '₡ 999'],
    [1000, '₡ 1 000'],
    [150000, '₡ 150 000'],
    [820000, '₡ 820 000'],
    [999999999, '₡ 999 999 999'],
  ])('%i → %s', (amount, text) => {
    expect(formatColones(amount)).toBe(text);
  });
});
