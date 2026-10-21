// @vitest-environment jsdom
// HU-304: Indicar los productos de una posible venta (el producto se elige en dos pasos: variedad y presentación)
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

// Fuera de orden a propósito: el componente ordena por id (el id lleva el orden del catálogo del cliente).
const PRODUCTS: Product[] = [
  { id: 'prod-09-geisha-0250-molido', name: 'Geisha', presentation: 'Bolsa de 250 g, molido', description: '', active: true },
  { id: 'prod-02-caturra-1000-grano', name: 'Caturra', presentation: 'Bolsa de 1 kg, grano entero', description: '', active: true },
  { id: 'prod-02-caturra-0340-grano', name: 'Caturra', presentation: 'Bolsa de 340 g, grano entero', description: '', active: true },
  { id: 'prod-01-villa-sarchi-0250-molido', name: 'Villa Sarchí', presentation: 'Bolsa de 250 g, molido', description: '', active: true },
];
const SARCHI = 'prod-01-villa-sarchi-0250-molido';
const CATURRA_340 = 'prod-02-caturra-0340-grano';
const CATURRA_1KG = 'prod-02-caturra-1000-grano';
const GEISHA = 'prod-09-geisha-0250-molido';

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

const variety = (n: number) => screen.getByLabelText(`Variedad del producto ${n}`) as HTMLSelectElement;
const presentation = (n: number) => screen.getByLabelText(`Presentación del producto ${n}`) as HTMLSelectElement;
const optionTexts = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.text);

type User = Awaited<ReturnType<typeof setup>>['user'];
/** Elige la variedad y luego la presentación (por el id del producto) de la fila n. */
async function choose(user: User, n: number, varietyName: string, productId: string) {
  await user.selectOptions(variety(n), varietyName);
  await user.selectOptions(presentation(n), productId);
}

describe('HU-304 Productos de la oportunidad de venta', () => {
  it('empieza sin filas y "Agregar producto" suma una con variedad, presentación, cantidad y "X"', async () => {
    const { user } = await setup();
    expect(screen.queryByLabelText('Variedad del producto 1')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(variety(1)).toBeTruthy();
    expect(presentation(1)).toBeTruthy();
    expect(screen.getByLabelText('Cantidad del producto 1')).toBeTruthy();
    expect(screen.getByText('unidades')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar producto 1' }).textContent).toBe('X');
  });

  it('los controles de la fila van en este orden: Variedad, Presentación, Cantidad, unidades y X', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    const row = variety(1).closest('.sale-product-controls')!;
    const names = [...row.querySelectorAll('select, input, .sale-product-unit, button')].map(
      (el) => el.getAttribute('aria-label') ?? el.textContent,
    );
    expect(names).toEqual([
      'Variedad del producto 1',
      'Presentación del producto 1',
      'Cantidad del producto 1',
      'unidades',
      'Quitar producto 1',
    ]);
  });

  it('las variedades salen en el orden del catálogo (por id), no alfabético', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(optionTexts(variety(1))).toEqual(['Seleccione una variedad', 'Villa Sarchí', 'Caturra', 'Geisha']);
  });

  it('la presentación está deshabilitada hasta elegir la variedad', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(presentation(1).disabled).toBe(true);
    expect(optionTexts(presentation(1))).toEqual(['Primero elija una variedad']);

    await user.selectOptions(variety(1), 'Caturra');
    expect(presentation(1).disabled).toBe(false);
  });

  it('la presentación deshabilitada indica "Primero elija una variedad"; al elegir variedad dice "Seleccione una presentación" y al borrarla vuelve a la instrucción', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(presentation(1).selectedOptions[0].text).toBe('Primero elija una variedad');

    await user.selectOptions(variety(1), 'Caturra');
    expect(presentation(1).disabled).toBe(false);
    expect(presentation(1).selectedOptions[0].text).toBe('Seleccione una presentación');

    await user.selectOptions(variety(1), '');
    expect(presentation(1).disabled).toBe(true);
    expect(presentation(1).selectedOptions[0].text).toBe('Primero elija una variedad');
    expect(screen.getByRole('combobox', { name: 'Presentación del producto 1' })).toBe(presentation(1));
  });

  it('muestra solo las presentaciones de la variedad elegida, en el orden del catálogo', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    await user.selectOptions(variety(1), 'Caturra');
    expect(optionTexts(presentation(1))).toEqual([
      'Seleccione una presentación',
      'Bolsa de 340 g, grano entero',
      'Bolsa de 1 kg, grano entero',
    ]);

    await user.selectOptions(variety(1), 'Geisha');
    expect(optionTexts(presentation(1))).toEqual(['Seleccione una presentación', 'Bolsa de 250 g, molido']);
  });

  it('al cambiar la variedad se borra la presentación', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Caturra', CATURRA_340);
    expect(presentation(1).value).toBe(CATURRA_340);

    await user.selectOptions(variety(1), 'Geisha');

    expect(presentation(1).value).toBe('');
    expect(presentation(1).selectedOptions[0].text).toBe('Seleccione una presentación');
  });

  it('la "X" quita solo su fila', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Caturra', CATURRA_340);
    await choose(user, 2, 'Geisha', GEISHA);

    await user.click(screen.getByRole('button', { name: 'Quitar producto 1' }));

    expect(screen.queryByLabelText('Variedad del producto 2')).toBeNull();
    expect(variety(1).value).toBe('Geisha');
    expect(presentation(1).value).toBe(GEISHA);
  });

  it.each(['0', '10000', '2.5', 'abc', ''])('cantidad "%s": Ingrese una cantidad entre 1 y 9999.', async (quantity) => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Caturra', CATURRA_340);
    if (quantity) await user.type(screen.getByLabelText('Cantidad del producto 1'), quantity);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe('Ingrese una cantidad entre 1 y 9999.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('fila sin variedad: Seleccione un producto o elimine la fila. (marca la variedad)', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe('Seleccione un producto o elimine la fila.');
    expect(variety(1).getAttribute('aria-invalid')).toBe('true');
    expect(presentation(1).getAttribute('aria-invalid')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('fila con variedad pero sin presentación: el mismo mensaje (marca la presentación)', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(variety(1), 'Caturra');
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe('Seleccione un producto o elimine la fila.');
    expect(presentation(1).getAttribute('aria-invalid')).toBe('true');
    expect(variety(1).getAttribute('aria-invalid')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('producto repetido (misma variedad y presentación): Este producto ya fue agregado. (en la segunda fila)', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Caturra', CATURRA_340);
    await choose(user, 2, 'Caturra', CATURRA_340);
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '2');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(['Este producto ya fue agregado.']);
    expect(presentation(2).getAttribute('aria-invalid')).toBe('true');
    expect(presentation(1).getAttribute('aria-invalid')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('la misma variedad con otra presentación sí es válida', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Caturra', CATURRA_340);
    await choose(user, 2, 'Caturra', CATURRA_1KG);
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '20');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '10');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSave).toHaveBeenCalledWith([
      { productId: CATURRA_340, quantity: 20 },
      { productId: CATURRA_1KG, quantity: 10 },
    ]);
  });

  it('se puede guardar sin productos', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it('con filas válidas entrega el producto (variedad + presentación) y la cantidad como número', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await choose(user, 1, 'Villa Sarchí', SARCHI);
    await choose(user, 2, 'Geisha', GEISHA);
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '12');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '9999');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith([
      { productId: SARCHI, quantity: 12 },
      { productId: GEISHA, quantity: 9999 },
    ]);
  });
});
