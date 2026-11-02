// @vitest-environment jsdom
// HU-404: lista de productos de interés dentro del formulario, con cantidades y preselección desde el catálogo.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogProducts } from '../../scripts/seed/catalogData';
import { ConsultaForm } from '../../sitio-publico/src/components/ConsultaForm';
import { ContactenosPage } from '../../sitio-publico/src/pages/ContactenosPage';
import { listPublicProductsIn } from '../../src/products/publicCatalog';
import type { Product } from '../../src/shared/types';

// Cada prueba pinta las 72 filas de productos: con la suite completa en paralelo pueden pasar de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../sitio-publico/src/firebase', () => ({ db: {} }));
vi.mock('../../src/products/publicCatalog', () => ({ listPublicProductsIn: vi.fn() }));

const catalogo = () => buildCatalogProducts().map((p) => ({ ...p.data, id: p.id }) as Product);
const GEISHA = 'prod-09-geisha-1000-molido';
const SARCHI = 'prod-01-villa-sarchi-0250-grano';

const casilla = (nombre: string, presentacion: string) => screen.getByRole('checkbox', { name: `${nombre} ${presentacion}` });
const cantidad = (nombre: string, presentacion: string) =>
  screen.getByRole('textbox', { name: `Cantidad aproximada de ${nombre}, ${presentacion}` }) as HTMLInputElement;
const MENSAJE_CANTIDAD = 'Ingrese una cantidad entre 1 y 9999.';

function renderForm(props: Parameters<typeof ConsultaForm>[0] = {}) {
  const user = userEvent.setup();
  render(<ConsultaForm productos={catalogo()} {...props} />);
  return user;
}

beforeEach(() => {
  vi.mocked(listPublicProductsIn).mockResolvedValue(catalogo());
});
afterEach(cleanup);

describe('HU-404 criterio 1: todos los productos, uno por fila', () => {
  it('muestra los 72 productos, agrupados por variedad (9 grupos de 8), cada uno con su casilla y su cantidad', () => {
    renderForm();
    const lista = screen.getByRole('region', { name: 'Lista de productos' });
    expect(within(lista).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Villa Sarchí', 'Caturra', 'Catuaí', 'Kenia', 'San Roque', 'Milenio', 'Centroamericano', 'Casiopea', 'Geisha',
    ]);
    expect(within(lista).getAllByRole('checkbox')).toHaveLength(72);
    expect(within(lista).getAllByRole('textbox')).toHaveLength(72);
    for (const grupo of lista.querySelectorAll('.pub-products-group')) {
      expect(grupo.querySelectorAll('.pub-product-row')).toHaveLength(8);
    }
  });

  it('cada fila muestra el nombre y la presentación del producto', () => {
    renderForm();
    const fila = casilla('Geisha', 'Bolsa de 1 kg, molido').closest('.pub-product-row')!;
    expect(fila.querySelector('.pub-product-name')!.textContent).toBe('Geisha');
    expect(fila.querySelector('.pub-product-presentation')!.textContent).toBe('Bolsa de 1 kg, molido');
    expect(cantidad('Geisha', 'Bolsa de 1 kg, molido')).toBeTruthy();
  });

  it('la lista tiene desplazamiento propio y se alcanza con el teclado', () => {
    renderForm();
    const lista = screen.getByRole('region', { name: 'Lista de productos' });
    expect(lista.getAttribute('tabindex')).toBe('0');
    expect(lista.className).toBe('pub-products');
  });

  it('empieza sin ningún producto marcado y con todas las cantidades deshabilitadas y vacías', () => {
    renderForm();
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0);
    const cantidades = within(screen.getByRole('region', { name: 'Lista de productos' })).getAllByRole('textbox') as HTMLInputElement[];
    expect(cantidades.every((c) => c.disabled && c.value === '')).toBe(true);
  });
});

describe('HU-404 criterio 2: la cantidad', () => {
  it('solo se puede escribir si el producto está marcado, y al marcarlo empieza en 1', async () => {
    const user = renderForm();
    const campo = cantidad('Caturra', 'Bolsa de 340 g, grano entero');
    expect(campo.disabled).toBe(true);
    await user.click(casilla('Caturra', 'Bolsa de 340 g, grano entero'));
    expect(campo.disabled).toBe(false);
    expect(campo.value).toBe('1');
  });

  it.each(['1', '9999', '250'])('acepta %s sin error', async (texto) => {
    const user = renderForm();
    await user.click(casilla('Kenia', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Kenia', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    await user.type(campo, texto);
    await user.tab();
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull();
    expect(campo.getAttribute('aria-invalid')).toBeNull();
  });

  it.each(['0', '10000', '1.5', 'abc', '-3', ''])('"%s" muestra "Ingrese una cantidad entre 1 y 9999." al salir del campo', async (texto) => {
    const user = renderForm();
    await user.click(casilla('Kenia', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Kenia', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    if (texto) await user.type(campo, texto);
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull(); // todavía no salió del campo
    await user.tab();
    const error = screen.getByText(MENSAJE_CANTIDAD);
    expect(error.className).toContain('field-error');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('al corregir la cantidad, el error desaparece', async () => {
    const user = renderForm();
    await user.click(casilla('Kenia', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Kenia', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    await user.type(campo, '0');
    await user.tab();
    expect(screen.getByText(MENSAJE_CANTIDAD)).toBeTruthy();
    await user.clear(campo);
    await user.type(campo, '12');
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull();
  });
});

describe('HU-404 criterio 3: varios productos y desmarcar', () => {
  it('se pueden marcar varios, cada uno con su propia cantidad', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' }, onValido });
    await user.click(casilla('Caturra', 'Bolsa de 340 g, grano entero'));
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    await user.click(casilla('Kenia', 'Bolsa de 250 g, molido'));
    await user.clear(cantidad('Caturra', 'Bolsa de 340 g, grano entero'));
    await user.type(cantidad('Caturra', 'Bolsa de 340 g, grano entero'), '12');
    await user.clear(cantidad('Geisha', 'Bolsa de 1 kg, molido'));
    await user.type(cantidad('Geisha', 'Bolsa de 1 kg, molido'), '3');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).toHaveBeenCalledTimes(1);
    expect(onValido.mock.calls[0][0].intereses).toEqual({
      'prod-02-caturra-0340-grano': '12',
      [GEISHA]: '3',
      'prod-04-kenia-0250-molido': '1',
    });
  });

  it('al desmarcar un producto, su cantidad se borra y se deshabilita; al marcarlo otra vez empieza en 1', async () => {
    const user = renderForm();
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Geisha', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    await user.type(campo, '250');
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect(campo.value).toBe('');
    expect(campo.disabled).toBe(true);
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect(campo.value).toBe('1');
  });

  it('desmarcar un producto con la cantidad mal escrita quita también su error', async () => {
    const user = renderForm();
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Geisha', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    await user.type(campo, '0');
    await user.tab();
    expect(screen.getByText(MENSAJE_CANTIDAD)).toBeTruthy();
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect(screen.queryByText(MENSAJE_CANTIDAD)).toBeNull();
  });

  it('desmarcar un producto no cambia la cantidad de los demás', async () => {
    const user = renderForm();
    await user.click(casilla('Caturra', 'Bolsa de 340 g, grano entero'));
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    await user.type(cantidad('Caturra', 'Bolsa de 340 g, grano entero'), '5');
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect(cantidad('Caturra', 'Bolsa de 340 g, grano entero').value).toBe('15');
  });
});

describe('HU-501 con la lista de productos', () => {
  it('"Seleccione al menos un producto." aparece al salir de la lista sin marcar nada, y se va al marcar uno', async () => {
    const user = renderForm();
    await user.click(screen.getByRole('region', { name: 'Lista de productos' }));
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
    await user.tab({ shift: true }); // sale de la lista hacia el teléfono
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
  });

  it('pasar de una casilla a otra dentro de la lista no revisa todavía', async () => {
    const user = renderForm();
    await user.click(screen.getByRole('region', { name: 'Lista de productos' }));
    await user.tab(); // primera casilla, dentro de la lista
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
  });

  it('con una cantidad fuera de rango, "Enviar" no envía, avisa arriba y marca la fila en rojo', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' }, onValido });
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    const campo = cantidad('Geisha', 'Bolsa de 1 kg, molido');
    await user.clear(campo);
    await user.type(campo, '10000');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Revise los campos marcados en rojo.');
    expect(screen.getByText(MENSAJE_CANTIDAD)).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('"Enviar" sin productos marcados muestra "Seleccione al menos un producto."', async () => {
    const user = renderForm({ valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
  });
});

describe('HU-404 estados de la lista', () => {
  it('mientras carga: "Cargando catálogo..."', () => {
    renderForm({ productos: [], estadoProductos: 'cargando' });
    expect(screen.getByText('Cargando catálogo...')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('si falla la carga: "No se pudo cargar el catálogo. Intente de nuevo."', () => {
    renderForm({ productos: [], estadoProductos: 'error' });
    expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar el catálogo. Intente de nuevo.');
  });

  it('sin productos: "Pronto publicaremos nuestros productos."', () => {
    renderForm({ productos: [], estadoProductos: 'listo' });
    expect(screen.getByText('Pronto publicaremos nuestros productos.')).toBeTruthy();
  });

  it('sin lista también se avisa al enviar sin productos', async () => {
    const user = renderForm({ productos: [], estadoProductos: 'error' });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Seleccione al menos un producto.')).toBeTruthy();
  });
});

describe('HU-402 criterio 4: el producto elegido en el catálogo llega marcado', () => {
  const abrir = (ruta: string) =>
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContactenosPage />
      </MemoryRouter>,
    );

  it('con ?producto= se carga el catálogo y ese producto queda marcado, con cantidad 1', async () => {
    abrir(`/contactenos?producto=${GEISHA}`);
    expect(screen.getByText('Cargando catálogo...')).toBeTruthy();
    await waitFor(() => expect((casilla('Geisha', 'Bolsa de 1 kg, molido') as HTMLInputElement).checked).toBe(true));
    expect(cantidad('Geisha', 'Bolsa de 1 kg, molido').value).toBe('1');
    expect(cantidad('Geisha', 'Bolsa de 1 kg, molido').disabled).toBe(false);
    const marcados = screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked);
    expect(marcados).toHaveLength(1);
  });

  it('la fila elegida queda a la vista: se pide desplazar la lista hasta ella (solo la lista)', async () => {
    abrir(`/contactenos?producto=${GEISHA}`);
    await waitFor(() => expect((casilla('Geisha', 'Bolsa de 1 kg, molido') as HTMLInputElement).checked).toBe(true));
    const lista = screen.getByRole('region', { name: 'Lista de productos' });
    expect(lista.scrollTop).not.toBeNaN();
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it('con el producto marcado, el formulario ya no exige elegir uno (solo faltan nombre y correo)', async () => {
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${SARCHI}`);
    await waitFor(() => expect((casilla('Villa Sarchí', 'Bolsa de 250 g, grano entero') as HTMLInputElement).checked).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.queryByText('Seleccione al menos un producto.')).toBeNull();
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2);
  });

  it('un producto que no existe o no está activo se ignora: no se marca nada', async () => {
    abrir('/contactenos?producto=prod-99-no-existe');
    await screen.findByRole('region', { name: 'Lista de productos' });
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0);
  });

  it('sin ?producto= no se marca nada', async () => {
    abrir('/contactenos');
    await screen.findByRole('region', { name: 'Lista de productos' });
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0);
  });

  it('si el catálogo no carga, el formulario sigue disponible y avisa', async () => {
    vi.mocked(listPublicProductsIn).mockRejectedValue(new Error('permission-denied'));
    abrir(`/contactenos?producto=${GEISHA}`);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar el catálogo. Intente de nuevo.');
    expect(screen.getByRole('textbox', { name: 'Nombre completo' })).toBeTruthy();
  });

  it('el usuario puede desmarcar el producto preseleccionado', async () => {
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${GEISHA}`);
    await waitFor(() => expect((casilla('Geisha', 'Bolsa de 1 kg, molido') as HTMLInputElement).checked).toBe(true));
    await user.click(casilla('Geisha', 'Bolsa de 1 kg, molido'));
    expect((casilla('Geisha', 'Bolsa de 1 kg, molido') as HTMLInputElement).checked).toBe(false);
  });
});
