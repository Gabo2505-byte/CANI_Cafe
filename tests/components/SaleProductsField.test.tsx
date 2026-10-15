// @vitest-environment jsdom
// HU-304: Indicar los productos de una posible venta
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type SaleProductErrors,
  type SaleProductRow,
  toSaleProductInputs,
  validateSaleProductRows,
} from '../../src/sales/saleProductRows';
import { SaleProductsField } from '../../src/sales/SaleProductsField';
import type { Product } from '../../src/shared/types';

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Café en grano', presentation: 'Bolsa de 1 kg', description: '', active: true },
  { id: 'p2', name: 'Café molido', presentation: 'Bolsa de 340 g', description: '', active: true },
];

/** Hace el papel del formulario de HU-301: guarda las filas y valida al pulsar "Guardar". */
function Harness({ onSave }: { onSave: (rows: { productId: string; quantity: number }[]) => void }) {
  const [rows, setRows] = useState<SaleProductRow[]>([]);
  const [errors, setErrors] = useState<SaleProductErrors>({});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateSaleProductRows(rows);
        setErrors(found);
        if (Object.keys(found).length === 0) onSave(toSaleProductInputs(rows));
      }}
    >
      <SaleProductsField products={PRODUCTS} rows={rows} onChange={setRows} errors={errors} />
      <button type="submit">Guardar</button>
    </form>
  );
}

afterEach(cleanup);

async function setup() {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(<Harness onSave={onSave} />);
  return { onSave, user };
}

describe('HU-304 Productos de la posible venta', () => {
  it('empieza sin filas y "Agregar producto" suma una con producto, cantidad y "X"', async () => {
    const { user } = await setup();
    expect(screen.queryByLabelText('Producto 1')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(screen.getByLabelText('Producto 1')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad del producto 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar producto 1' }).textContent).toBe('X');
  });

  it('el producto se elige del catálogo', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    const options = Array.from((screen.getByLabelText('Producto 1') as HTMLSelectElement).options).map((o) => o.text);
    expect(options).toEqual(['Seleccione un producto', 'Café en grano · Bolsa de 1 kg', 'Café molido · Bolsa de 340 g']);
  });

  it('la "X" quita solo su fila', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    await user.selectOptions(screen.getByLabelText('Producto 2'), 'p2');

    await user.click(screen.getByRole('button', { name: 'Quitar producto 1' }));

    expect(screen.queryByLabelText('Producto 2')).toBeNull();
    expect((screen.getByLabelText('Producto 1') as HTMLSelectElement).value).toBe('p2');
  });

  it.each(['0', '10000', '2.5', 'abc', ''])('cantidad "%s": Ingrese una cantidad entre 1 y 9999.', async (quantity) => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    if (quantity) await user.type(screen.getByLabelText('Cantidad del producto 1'), quantity);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe('Ingrese una cantidad entre 1 y 9999.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('fila sin producto: Seleccione un producto o elimine la fila.', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe('Seleccione un producto o elimine la fila.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('producto repetido: Este producto ya fue agregado. (en la segunda fila)', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    await user.selectOptions(screen.getByLabelText('Producto 2'), 'p1');
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '2');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(['Este producto ya fue agregado.']);
    expect(screen.getByLabelText('Producto 2').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Producto 1').getAttribute('aria-invalid')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('se puede guardar sin productos', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it('con filas válidas entrega producto y cantidad como número', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    await user.selectOptions(screen.getByLabelText('Producto 2'), 'p2');
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '12');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '9999');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith([
      { productId: 'p1', quantity: 12 },
      { productId: 'p2', quantity: 9999 },
    ]);
  });
});
