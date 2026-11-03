// @vitest-environment jsdom
// HU-405: enviar el formulario de interés y saber si llegó bien.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogProducts } from '../../scripts/seed/catalogData';
import { ConsultaForm } from '../../sitio-publico/src/components/ConsultaForm';
import type { ResultadoEnvio } from '../../sitio-publico/src/formulario/envio';
import { guardarSolicitudIn, nuevoIdSolicitudIn } from '../../sitio-publico/src/formulario/guardarSolicitud';
import { ContactenosPage } from '../../sitio-publico/src/pages/ContactenosPage';
import { listPublicProductsIn } from '../../src/products/publicCatalog';
import type { Product } from '../../src/shared/types';

// Cada prueba pinta las 72 filas de productos: con la suite completa en paralelo pueden pasar de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../sitio-publico/src/firebase', () => ({ db: {} }));
vi.mock('../../src/products/publicCatalog', () => ({ listPublicProductsIn: vi.fn() }));
vi.mock('../../sitio-publico/src/formulario/guardarSolicitud', () => ({
  nuevoIdSolicitudIn: vi.fn(),
  guardarSolicitudIn: vi.fn(),
}));

const GRACIAS = 'Gracias por su interés. CANI Café se comunicará con usted pronto.';
const ERROR = 'No se pudo enviar el formulario. Intente de nuevo.';
const PRIVACIDAD = 'Sus datos se utilizarán únicamente para responder su consulta.';
const GEISHA = 'prod-09-geisha-1000-molido';
const catalogo = () => buildCatalogProducts().map((p) => ({ ...p.data, id: p.id }) as Product);

const nombre = () => screen.getByRole('textbox', { name: 'Nombre completo' }) as HTMLInputElement;
const correo = () => screen.getByRole('textbox', { name: 'Correo electrónico' }) as HTMLInputElement;
const mensaje = () => screen.getByRole('textbox', { name: /^Mensaje/ }) as HTMLTextAreaElement;
const variedad = (n: number) => screen.getByLabelText(`Variedad del producto ${n}`) as HTMLSelectElement;
const presentacion = (n: number) => screen.getByLabelText(`Presentación del producto ${n}`) as HTMLSelectElement;
const cantidad = (n: number) => screen.getByLabelText(`Cantidad aproximada del producto ${n}`) as HTMLInputElement;

/** Promesa que la prueba resuelve cuando quiere (para ver el estado "Enviando..."). */
function diferida() {
  let resolver!: (r: ResultadoEnvio) => void;
  const promesa = new Promise<ResultadoEnvio>((r) => (resolver = r));
  return { promesa, resolver };
}

/** Llena el formulario con datos válidos (pegando el texto: con 72 filas en pantalla, teclear letra por letra es lento). */
async function llenarValido(user: ReturnType<typeof userEvent.setup>) {
  const pegar = async (campo: HTMLElement, texto: string) => {
    await user.click(campo);
    await user.paste(texto);
  };
  await pegar(nombre(), 'Ana Prueba');
  await pegar(correo(), 'ana@example.com');
  await user.selectOptions(variedad(1), 'Geisha');
  await user.selectOptions(presentacion(1), GEISHA);
  await user.clear(cantidad(1));
  await pegar(cantidad(1), '25');
  await pegar(mensaje(), 'Quisiera precios.');
}

function renderForm(onValido: Parameters<typeof ConsultaForm>[0]['onValido'], onOtraConsulta = vi.fn()) {
  const user = userEvent.setup();
  render(<ConsultaForm productos={catalogo()} onValido={onValido} onOtraConsulta={onOtraConsulta} />);
  return { user, onOtraConsulta };
}

beforeEach(() => {
  vi.mocked(listPublicProductsIn).mockResolvedValue(catalogo());
  vi.mocked(nuevoIdSolicitudIn).mockReset();
  vi.mocked(guardarSolicitudIn).mockReset();
});
afterEach(cleanup);

describe('HU-405 criterio 1: texto de privacidad', () => {
  it('encima del botón "Enviar" aparece el texto literal', () => {
    renderForm(vi.fn());
    const texto = screen.getByText(PRIVACIDAD);
    const boton = screen.getByRole('button', { name: 'Enviar' });
    expect(texto.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('HU-405 criterio 2: "Enviando..."', () => {
  it('al dar clic, el botón cambia a "Enviando..." y no se puede presionar otra vez hasta que termine', async () => {
    const envio = diferida();
    const onValido = vi.fn(() => envio.promesa);
    const { user } = renderForm(onValido);
    await llenarValido(user);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const boton = screen.getByRole('button', { name: 'Enviando...' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    await user.click(boton);
    expect(onValido).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('form', { name: 'Envíenos su consulta' }).getAttribute('aria-busy')).toBe('true');
    await act(async () => envio.resolver('ok'));
    expect(screen.queryByRole('button', { name: 'Enviando...' })).toBeNull();
  });

  it('con errores de datos no se envía ni aparece "Enviando..."', async () => {
    const onValido = vi.fn();
    const { user } = renderForm(onValido);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onValido).not.toHaveBeenCalled();
    expect(screen.queryByText('Enviando...')).toBeNull();
    expect(screen.getByText('Revise los campos marcados en rojo.')).toBeTruthy();
  });
});

describe('HU-405 criterio 3: envío correcto', () => {
  it('el formulario se reemplaza por el agradecimiento y el botón "Enviar otra consulta"', async () => {
    const { user } = renderForm(vi.fn(async () => 'ok' as const));
    await llenarValido(user);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const agradecimiento = await screen.findByRole('status');
    expect(within(agradecimiento).getByText(GRACIAS)).toBeTruthy();
    expect(within(agradecimiento).getByRole('button', { name: 'Enviar otra consulta' })).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(agradecimiento);
  });

  it('"Enviar otra consulta" muestra el formulario vacío, con Costa Rica y una sola fila de productos vacía', async () => {
    const { user, onOtraConsulta } = renderForm(vi.fn(async () => 'ok' as const));
    await llenarValido(user);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar otra consulta' }));
    expect(onOtraConsulta).toHaveBeenCalledTimes(1);
    expect(nombre().value).toBe('');
    expect(correo().value).toBe('');
    expect(mensaje().value).toBe('');
    expect(screen.getByRole('button', { name: 'País del teléfono: Costa Rica (+506)' })).toBeTruthy();
    expect(variedad(1).value).toBe('');
    expect(presentacion(1).value).toBe('');
    expect(cantidad(1).value).toBe('');
    expect(screen.queryByLabelText('Variedad del producto 2')).toBeNull();
    expect(screen.queryByText('Revise los campos marcados en rojo.')).toBeNull();
    expect(screen.queryByText('Este campo es obligatorio.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy();
  });
});

describe('HU-405 criterio 4: error de conexión', () => {
  it('aparece "No se pudo enviar el formulario. Intente de nuevo." y los datos escritos no se borran', async () => {
    const { user } = renderForm(vi.fn(async () => 'error' as const));
    await llenarValido(user);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect((await screen.findByRole('alert')).textContent).toBe(ERROR);
    expect(nombre().value).toBe('Ana Prueba');
    expect(correo().value).toBe('ana@example.com');
    expect(variedad(1).value).toBe('Geisha');
    expect(presentacion(1).value).toBe(GEISHA);
    expect(cantidad(1).value).toBe('25');
    expect(mensaje().value).toBe('Quisiera precios.');
    const boton = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
  });

  it('el error va encima del botón, y al reintentar con éxito se muestra el agradecimiento', async () => {
    const onValido = vi.fn().mockResolvedValueOnce('error').mockResolvedValueOnce('ok');
    const { user } = renderForm(onValido);
    await llenarValido(user);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const error = await screen.findByText(ERROR);
    expect(error.compareDocumentPosition(screen.getByRole('button', { name: 'Enviar' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(GRACIAS)).toBeTruthy();
    expect(onValido).toHaveBeenCalledTimes(2);
  });
});

describe('HU-405 en la página Contáctenos (con el guardado simulado)', () => {
  function Ubicacion() {
    const { pathname, search } = useLocation();
    return <p data-testid="ubicacion">{pathname + search}</p>;
  }
  const abrir = (ruta: string) =>
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContactenosPage />
        <Ubicacion />
      </MemoryRouter>,
    );

  it('guarda la solicitud del contrato (correo en minúsculas, productos en orden del catálogo, null en lo vacío)', async () => {
    vi.mocked(nuevoIdSolicitudIn).mockReturnValue('sol-1');
    vi.mocked(guardarSolicitudIn).mockResolvedValue();
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${GEISHA}`);
    await waitFor(() => expect(presentacion(1).value).toBe(GEISHA));
    await user.type(nombre(), ' Ana Prueba ');
    await user.type(correo(), 'Ana@Example.com');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(variedad(2), 'Villa Sarchí');
    await user.selectOptions(presentacion(2), 'prod-01-villa-sarchi-0250-grano');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(GRACIAS)).toBeTruthy();
    expect(guardarSolicitudIn).toHaveBeenCalledWith({}, 'sol-1', {
      fullName: 'Ana Prueba',
      email: 'ana@example.com',
      phoneCountry: null,
      phoneNumber: null,
      interests: [
        { productId: 'prod-01-villa-sarchi-0250-grano', quantity: 1 },
        { productId: GEISHA, quantity: 1 },
      ],
      message: null,
    });
  });

  it('sin conexión muestra el error; el reintento usa el mismo id; "Enviar otra consulta" quita el producto de la dirección', async () => {
    vi.mocked(nuevoIdSolicitudIn).mockReturnValueOnce('sol-1').mockReturnValueOnce('sol-2');
    vi.mocked(guardarSolicitudIn)
      .mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { code: 'unknown' }))
      .mockResolvedValueOnce();
    const user = userEvent.setup();
    abrir(`/contactenos?producto=${GEISHA}`);
    await waitFor(() => expect(presentacion(1).value).toBe(GEISHA));
    await user.type(nombre(), 'Ana Prueba');
    await user.type(correo(), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(ERROR)).toBeTruthy();
    expect(nombre().value).toBe('Ana Prueba');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(GRACIAS)).toBeTruthy();
    expect(vi.mocked(guardarSolicitudIn).mock.calls.map((c) => c[1])).toEqual(['sol-1', 'sol-1']);
    await user.click(screen.getByRole('button', { name: 'Enviar otra consulta' }));
    expect(screen.getByTestId('ubicacion').textContent).toBe('/contactenos');
    expect(variedad(1).value).toBe('');
    expect(screen.queryByLabelText('Variedad del producto 2')).toBeNull();
  });
});
