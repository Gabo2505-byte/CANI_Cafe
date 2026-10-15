import { describe, expect, it } from 'vitest';
import {
  parseQuantity,
  toSaleProductInputs,
  validateSaleProductRows,
  type SaleProductRow,
} from '../../src/sales/saleProductRows';

const row = (key: string, productId: string, quantity: string): SaleProductRow => ({ key, productId, quantity });

describe('HU-304 cantidad', () => {
  it.each([['1', 1], ['9999', 9999], [' 25 ', 25], ['007', 7]])('acepta "%s"', (text, value) => {
    expect(parseQuantity(text)).toBe(value);
  });

  it.each(['', '0', '10000', '-3', '1.5', '1,5', 'abc', '12a', '1e3'])('rechaza "%s"', (text) => {
    expect(parseQuantity(text)).toBeNull();
  });
});

describe('HU-304 validación de filas', () => {
  it('sin filas no hay errores: se puede guardar sin productos', () => {
    expect(validateSaleProductRows([])).toEqual({});
  });

  it('filas válidas no tienen errores', () => {
    expect(validateSaleProductRows([row('a', 'p1', '3'), row('b', 'p2', '9999')])).toEqual({});
  });

  it('cantidad fuera de rango o no entera: "Ingrese una cantidad entre 1 y 9999."', () => {
    const errors = validateSaleProductRows([row('a', 'p1', '0'), row('b', 'p2', '10000'), row('c', 'p3', '2.5')]);
    for (const key of ['a', 'b', 'c']) expect(errors[key]).toEqual({ quantity: 'Ingrese una cantidad entre 1 y 9999.' });
  });

  it('fila sin producto: "Seleccione un producto o elimine la fila."', () => {
    expect(validateSaleProductRows([row('a', '', '5')]).a).toEqual({
      product: 'Seleccione un producto o elimine la fila.',
    });
  });

  it('fila totalmente vacía muestra los dos mensajes', () => {
    expect(validateSaleProductRows([row('a', '', '')]).a).toEqual({
      product: 'Seleccione un producto o elimine la fila.',
      quantity: 'Ingrese una cantidad entre 1 y 9999.',
    });
  });

  it('producto repetido: el aviso queda en la fila repetida, no en la primera', () => {
    const errors = validateSaleProductRows([row('a', 'p1', '1'), row('b', 'p2', '1'), row('c', 'p1', '2')]);
    expect(errors).toEqual({ c: { product: 'Este producto ya fue agregado.' } });
  });

  it('convierte las filas válidas en datos para guardar', () => {
    expect(toSaleProductInputs([row('a', 'p1', ' 12 '), row('b', 'p2', '3')])).toEqual([
      { productId: 'p1', quantity: 12 },
      { productId: 'p2', quantity: 3 },
    ]);
  });
});
