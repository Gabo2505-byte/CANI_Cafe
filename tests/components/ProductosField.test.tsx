// @vitest-environment jsdom
// HU-404: productos de interés del formulario público, con el mismo funcionamiento que el selector del sistema interno
// (filas con variedad, presentación, cantidad y "X"), y la preselección desde el catálogo (HU-402.4).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogProducts } from '../../scripts/seed/catalogData';
import { ConsultaForm } from '../../sitio-publico/src/components/ConsultaForm';
import { ContactenosPage } from '../../sitio-publico/src/pages/ContactenosPage';
import { listPublicProductsIn } from '../../src/products/publicCatalog';
import type { Product } from '../../src/shared/types';

// Cada prueba pinta el formulario completo: con la suite en paralelo pueden pasar de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../sitio-publico/src/firebase', () => ({ db: {} }));
vi.mock('../../src/products/publicCatalog', () => ({ listPublicProductsIn: vi.fn() }));

const catalogo = () => buildCatalogProducts().map((p) => ({ ...p.data, id: p.id }) as Product);
const GEISHA_1KG_MOLIDO = 'prod-09-geisha-1000-molido';
const CATURRA_340_GRANO = 'prod-02-caturra-0340-grano';
const VARIEDADES = ['Villa Sarchí', 'Caturra', 'Catuaí', 'Kenia', 'San Roque', 'Milenio', 'Centroamericano', 'Casiopea', 'Geisha'];
const MENSAJE_CANTIDAD = 'Ingrese una cantidad entre 1 y 9999.';

const variedad = (n: number) => screen.getByLabelText(`Variedad del producto ${n}`) as HTMLSelectElement;
const presentacion = (n: number) => screen.getByLabelText(`Presentación del producto ${n}`) as HTMLSelectElement;
const cantidad = (n: number) => screen.getByLabelText(`Cantidad aproximada del producto ${n}`) as HTMLInputElement;
const quitar = (n: number) => screen.getByRole('button', { name: `Quitar producto ${n}` });
const agregar = () => screen.getByRole('button', { name: 'Agregar producto' });
const textos = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.text);

type User = ReturnType<typeof userEvent.setup>;
async function elegir(user: User, n: number, nombreVariedad: string, productoId: string) {
  await user.selectOptions(variedad(n), nombreVariedad);
  await user.selectOptions(presentacion(n), productoId);
}

function renderForm(props: Parameters<typeof ConsultaForm>[0] = {}) {
  const user = userEvent.setup();
  render(<ConsultaForm productos={catalogo()} {...props} />);
  return user;
}

beforeEach(() => {
  vi.mocked(listPublicProductsIn).mockResolvedValue(catalogo());
});
afterEach(cleanup);

describe('HU-404: aspecto y funcionamiento del selector (como el del sistema interno)', () => {
  it('empieza con una fila: variedad, presentación deshabilitada, cantidad con "unidades" y la "X"; y el botón "Agregar producto"', () => {
    renderForm();
    expect(textos(variedad(1))).toEqual(['Seleccione una variedad', ...VARIEDADES]);
    expect(presentacion(1).disabled).toBe(true);
    expect(textos(presentacion(1))).toEqual(['Primero elija una variedad']);
    expect(cantidad(1).value).toBe('');
    expect(cantidad(1).placeholder).toBe('Cantidad');
    const fila = cantidad(1).closest('.pub-product-row') as HTMLElement;
    expect(within(fila).getByText('unidades')).toBeTruthy();
    expect(quitar(1).textContent).toBe('X');
    expect(agregar()).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull(); // sin buscador
  });

  it('al elegir la variedad, la presentación se habilita con sus 8 presentaciones en el orden del catálogo', async () => {
    const user = renderForm();
    await user.selectOptions(variedad(1), 'Caturra');
    expect(presentacion(1).disabled).toBe(false);
    expect(textos(presentacion(1))).toEqual([
      'Seleccione una presentación',
      'Bolsa de 250 g, grano entero',
      'Bolsa de 250 g, molido',
      'Bolsa de 340 g, grano entero',
      'Bolsa de 340 g, molido',
      'Bolsa de 500 g, grano entero',
      'Bolsa de 500 g, molido',
      'Bolsa de 1 kg, grano entero',
      'Bolsa de 1 kg, molido',
    ]);
  });

  it('al elegir la presentación, la cantidad empieza en 1', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Caturra', CATURRA_340_GRANO);
    expect(cantidad(1).value).toBe('1');
  });

  it('si ya se había escrito una cantidad, elegir la presentación no la cambia', async () => {
    const user = renderForm();
    await user.type(cantidad(1), '25');
    await elegir(user, 1, 'Caturra', CATURRA_340_GRANO);
    expect(cantidad(1).value).toBe('25');
  });

  it('al cambiar la variedad se borra la presentación elegida (era de otra variedad)', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Caturra', CATURRA_340_GRANO);
    await user.selectOptions(variedad(1), 'Geisha');
    expect(presentacion(1).value).toBe('');
    expect(presentacion(1).disabled).toBe(false);
  });

  it('"Agregar producto" suma una fila y pasa el foco a su variedad', async () => {
    const user = renderForm();
    await user.click(agregar());
    expect(variedad(2)).toBeTruthy();
    expect(document.activeElement).toBe(variedad(2));
  });

  it('se pueden agregar varios productos, cada uno con su propia cantidad', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' }, onValido });
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await elegir(user, 2, 'Caturra', CATURRA_340_GRANO);
    await user.clear(cantidad(2));
    await user.type(cantidad(2), '12');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).toHaveBeenCalledTimes(1);
    const filas = onValido.mock.calls[0][0].filas as { productoId: string; cantidad: string }[];
    expect(filas.map((f) => [f.productoId, f.cantidad])).toEqual([
      [GEISHA_1KG_MOLIDO, '1'],
      [CATURRA_340_GRANO, '12'],
    ]);
  });

  it('la "X" quita la fila (y su cantidad); las demás no cambian', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await elegir(user, 2, 'Caturra', CATURRA_340_GRANO);
    await user.type(cantidad(2), '5');
    await user.click(quitar(1));
    expect(screen.queryByLabelText('Variedad del producto 2')).toBeNull();
    expect(variedad(1).value).toBe('Caturra');
    expect(cantidad(1).value).toBe('15');
  });
});

describe('HU-501 en el selector: revisión al salir de cada campo y al enviar', () => {
  it('sin ningún producto, al salir del campo de productos: "Seleccione al menos un producto." (un solo aviso)', async () => {
    const user = renderForm();
    await user.selectOptions(variedad(1), 'Kenia');
    await user.click(screen.getByRole('textbox', { name: /^Mensaje/ })); // sale del campo de productos
    expect(screen.getAllByText('Seleccione al menos un producto.')).toHaveLength(1);
    expect(screen.queryByText('Seleccione un producto o elimine la fila.')).toBeNull();
  });

  it('pasar de la variedad a la presentación no revisa todavía la fila', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await user.selectOptions(variedad(2), 'Kenia');
    await user.tab(); // de la variedad a la presentación
    expect(screen.queryByText('Seleccione un producto o elimine la fila.')).toBeNull();
  });

  it('una fila sin presentación junto a otra completa: "Seleccione un producto o elimine la fila." al salir de ella', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await user.selectOptions(variedad(2), 'Kenia');
    await user.click(cantidad(2)); // sale de la variedad y la presentación de la fila 2
    const error = screen.getByText('Seleccione un producto o elimine la fila.');
    expect(presentacion(2).getAttribute('aria-invalid')).toBe('true');
    expect(presentacion(2).getAttribute('aria-describedby')).toBe(error.id);
  });

  it('el mismo producto en dos filas: "Este producto ya fue agregado." en la segunda', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await elegir(user, 2, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(cantidad(2));
    expect(screen.getByText('Este producto ya fue agregado.')).toBeTruthy();
    expect(presentacion(2).getAttribute('aria-invalid')).toBe('true');
    expect(presentacion(1).getAttribute('aria-invalid')).toBeNull();
  });

  it.each(['0', '10000', '1.5', 'abc', ''])('cantidad "%s": "Ingrese una cantidad entre 1 y 9999." al salir', async (texto) => {
    const user = renderForm();
    await elegir(user, 1, 'Kenia', 'prod-04-kenia-1000-molido');
    await user.clear(cantidad(1));
    if (texto) await user.type(cantidad(1), texto);
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull(); // todavía no salió del campo
    await user.tab();
    const error = screen.getByText(MENSAJE_CANTIDAD);
    expect(cantidad(1).getAttribute('aria-invalid')).toBe('true');
    expect(cantidad(1).getAttribute('aria-describedby')).toBe(error.id);
  });

  it.each(['1', '9999', '250'])('cantidad "%s" es válida', async (texto) => {
    const user = renderForm();
    await elegir(user, 1, 'Kenia', 'prod-04-kenia-1000-molido');
    await user.clear(cantidad(1));
    await user.type(cantidad(1), texto);
    await user.tab();
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull();
  });

  it('al corregir la cantidad, el error desaparece', async () => {
    const user = renderForm();
    await elegir(user, 1, 'Kenia', 'prod-04-kenia-1000-molido');
    await user.clear(cantidad(1));
    await user.type(cantidad(1), '0');
    await user.tab();
    expect(screen.getByText(MENSAJE_CANTIDAD)).toBeTruthy();
    await user.clear(cantidad(1));
    await user.type(cantidad(1), '12');
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull();
  });

  it('"Enviar" con una fila repetida no envía y avisa arriba', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' }, onValido });
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await elegir(user, 2, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Revise los campos marcados en rojo.');
    expect(screen.getByText('Este producto ya fue agregado.')).toBeTruthy();
  });

  it('presionar "Enviar" no le quita el foco al campo (así los errores que aparecen no mueven el botón antes del clic)', async () => {
    const user = renderForm();
    await user.selectOptions(variedad(1), 'Kenia');
    variedad(1).focus();
    const boton = screen.getByRole('button', { name: 'Enviar' });
    const presionar = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    boton.dispatchEvent(presionar);
    expect(presionar.defaultPrevented).toBe(true);
    await user.click(boton);
    expect(screen.getByText('Revise los campos marcados en rojo.')).toBeTruthy();
  });

  it('"Enviar" con una fila vacía de más no envía hasta quitarla con la "X"', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' }, onValido });
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    await user.click(agregar());
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).not.toHaveBeenCalled();
    expect(screen.getByText('Seleccione un producto o elimine la fila.')).toBeTruthy();
    await user.click(quitar(2));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).toHaveBeenCalledTimes(1);
  });

  it('"Enviar" sin productos (o tras quitar todas las filas) muestra "Seleccione al menos un producto."', async () => {
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
    await user.click(quitar(1));
    expect(screen.queryByLabelText('Variedad del producto 1')).toBeNull();
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
  });

  it('D-1: "Enviar" sin productos marca en rojo la variedad de la primera fila y la liga al mensaje', async () => {
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' } });
    expect(variedad(1).getAttribute('aria-invalid')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const error = screen.getByText('Seleccione al menos un producto.');
    expect(error.id).not.toBe('');
    expect(variedad(1).getAttribute('aria-invalid')).toBe('true');
    expect(variedad(1).getAttribute('aria-describedby')).toBe(error.id);
    expect(presentacion(1).getAttribute('aria-invalid')).toBeNull();
  });

  it('D-1: solo se marca la primera fila vacía, no las demás', async () => {
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' } });
    await user.click(agregar());
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(variedad(1).getAttribute('aria-invalid')).toBe('true');
    expect(variedad(2).getAttribute('aria-invalid')).toBeNull();
    expect(variedad(2).getAttribute('aria-describedby')).toBeNull();
  });

  it('D-1: al elegir un producto el error desaparece y la variedad deja de estar marcada', async () => {
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(variedad(1).getAttribute('aria-invalid')).toBe('true');
    await elegir(user, 1, 'Geisha', GEISHA_1KG_MOLIDO);
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
    expect(variedad(1).getAttribute('aria-invalid')).toBeNull();
    expect(variedad(1).getAttribute('aria-describedby')).toBeNull();
  });
});

describe('HU-404 estados del catálogo dentro del formulario', () => {
  it('mientras carga: "Cargando catálogo..." y todavía no hay filas', () => {
    renderForm({ productos: [], estadoProductos: 'cargando' });
    expect(screen.getByText('Cargando catálogo...')).toBeTruthy();
    expect(screen.queryByLabelText('Variedad del producto 1')).toBeNull();
  });

  it('si falla la carga: "No se pudo cargar el catálogo. Intente de nuevo."', () => {
    renderForm({ productos: [], estadoProductos: 'error' });
    expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar el catálogo. Intente de nuevo.');
  });

  it('sin productos: "Pronto publicaremos nuestros productos."', () => {
    renderForm({ productos: [], estadoProductos: 'listo' });
    expect(screen.getByText('Pronto publicaremos nuestros productos.')).toBeTruthy();
  });

  it('sin catálogo también se avisa al enviar sin productos', async () => {
    const user = renderForm({ productos: [], estadoProductos: 'error' });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
  });
});

describe('HU-402 criterio 4: el producto elegido en el catálogo llega como una fila ya llena', () => {
  const abrir = (ruta: string) =>
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContactenosPage />
      </MemoryRouter>,
    );

  it('con ?producto= la única fila llega con su variedad, su presentación y cantidad 1', async () => {
    abrir(`/contactenos?producto=${GEISHA_1KG_MOLIDO}`);
    expect(screen.getByText('Cargando catálogo...')).toBeTruthy();
    await waitFor(() => expect(presentacion(1).value).toBe(GEISHA_1KG_MOLIDO));
    expect(variedad(1).value).toBe('Geisha');
    expect(cantidad(1).value).toBe('1');
    expect(screen.queryByLabelText('Variedad del producto 2')).toBeNull();
  });

  it('con el producto ya elegido, el formulario no pide otro (solo faltan nombre y correo)', async () => {
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${GEISHA_1KG_MOLIDO}`);
    await waitFor(() => expect(presentacion(1).value).toBe(GEISHA_1KG_MOLIDO));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2);
  });

  it('se pueden agregar más productos después del elegido en el catálogo', async () => {
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${GEISHA_1KG_MOLIDO}`);
    await waitFor(() => expect(presentacion(1).value).toBe(GEISHA_1KG_MOLIDO));
    await user.click(agregar());
    expect(variedad(2).value).toBe('');
  });

  it('un producto que no existe o no está activo se ignora: queda la fila vacía', async () => {
    abrir('/contactenos?producto=prod-99-no-existe');
    await screen.findByLabelText('Variedad del producto 1');
    expect(variedad(1).value).toBe('');
    expect(presentacion(1).value).toBe('');
  });

  it('si el catálogo no carga, el formulario sigue disponible y avisa', async () => {
    vi.mocked(listPublicProductsIn).mockRejectedValue(new Error('permission-denied'));
    abrir(`/contactenos?producto=${GEISHA_1KG_MOLIDO}`);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar el catálogo. Intente de nuevo.');
    expect(screen.getByRole('textbox', { name: 'Nombre completo' })).toBeTruthy();
  });
});
