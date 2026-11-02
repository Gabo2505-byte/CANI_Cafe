// @vitest-environment jsdom
// HU-401 (inicio, encabezado y pie) y HU-402 (catálogo) del sitio público.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogProducts } from '../../scripts/seed/catalogData';
import { PublicLayout } from '../../sitio-publico/src/components/PublicLayout';
import { CatalogoPage } from '../../sitio-publico/src/pages/CatalogoPage';
import { InicioPage } from '../../sitio-publico/src/pages/InicioPage';
import { listPublicProductsIn } from '../../src/products/publicCatalog';
import type { Product } from '../../src/shared/types';

vi.mock('../../sitio-publico/src/firebase', () => ({ db: {} }));
vi.mock('../../src/products/publicCatalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/products/publicCatalog')>()),
  listPublicProductsIn: vi.fn(),
}));

const catalog = () => buildCatalogProducts().map((p) => ({ ...p.data, id: p.id }) as Product);

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{pathname + search}</p>;
}

function renderSitio(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<InicioPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/contactenos" element={<p>Página de contacto</p>} />
        </Route>
      </Routes>
      <Ubicacion />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(listPublicProductsIn).mockResolvedValue(catalog());
});
afterEach(cleanup);

describe('HU-401 encabezado, menú y pie', () => {
  it.each([
    ['/', 'Inicio'],
    ['/catalogo', 'Catálogo'],
    ['/contactenos', 'Contáctenos'],
  ])('en %s: nombre a la izquierda, menú con tres opciones y solo "%s" marcada como la actual', async (ruta, actual) => {
    renderSitio(ruta);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'CANI Café' })).toBeTruthy();
    const menu = within(within(header).getByRole('navigation')).getAllByRole('link');
    expect(menu.map((a) => a.textContent)).toEqual(['Inicio', 'Catálogo', 'Contáctenos']);
    expect(menu.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual([actual]);
    await screen.findByRole('contentinfo');
  });

  it('el nombre está antes que el menú en el encabezado', () => {
    renderSitio('/');
    const header = screen.getByRole('banner');
    const nombre = within(header).getByRole('link', { name: 'CANI Café' });
    const menu = within(header).getByRole('navigation');
    expect(nombre.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['/', '/catalogo', '/contactenos'])('el pie de %s muestra teléfono, correo y ubicación, y nada más', (ruta) => {
    renderSitio(ruta);
    const pie = screen.getByRole('contentinfo');
    expect(pie.textContent).toBe('Teléfono+506 6045 7872Correocmarotob@gmail.comUbicaciónNaranjo, Alajuela, Costa Rica');
    expect(within(pie).getByRole('link', { name: '+506 6045 7872' }).getAttribute('href')).toBe('tel:+50660457872');
    expect(within(pie).getByRole('link', { name: 'cmarotob@gmail.com' }).getAttribute('href')).toBe('mailto:cmarotob@gmail.com');
  });

  it('el sitio no pide usuario ni contraseña', () => {
    renderSitio('/');
    expect(screen.queryByLabelText(/usuario|contraseña/i)).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});

describe('HU-401 página Inicio', () => {
  it('tiene presentación con sus dos botones, "Quiénes somos" y "¿Cómo comprar?", en ese orden', () => {
    renderSitio('/');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 }).textContent).toBe('Café de especialidad de las montañas de Naranjo');
    expect(within(main).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Quiénes somos', '¿Cómo comprar?']);
    expect(within(main).getByRole('link', { name: 'Ver catálogo' }).getAttribute('href')).toBe('/catalogo');
    expect(within(main).getByRole('link', { name: 'Contáctenos' }).getAttribute('href')).toBe('/contactenos');
  });

  it('"Quiénes somos" trae los tres párrafos y la cita como cita, entre el primero y el segundo', () => {
    renderSitio('/');
    const seccion = screen.getByRole('heading', { name: 'Quiénes somos' }).closest('section')!;
    const hijos = Array.from(seccion.querySelector('.pub-prose')!.children).map((e) => e.tagName);
    expect(hijos).toEqual(['P', 'BLOCKQUOTE', 'P', 'P']);
    expect(seccion.querySelector('blockquote')!.textContent).toBe(
      'No solo cultivamos café; cuidamos cada semilla como el inicio de una experiencia sensorial única para los paladares más exigentes.',
    );
    expect(seccion.textContent).toContain('altitudes que oscilan entre los 1,300 y 1,700 metros sobre el nivel del mar.');
  });

  it('"¿Cómo comprar?" explica que los precios dependen del tipo de cliente y la cantidad, y que se piden por el formulario', () => {
    renderSitio('/');
    const texto = screen.getByRole('heading', { name: '¿Cómo comprar?' }).closest('section')!.textContent!;
    expect(texto).toContain('dependen del tipo de cliente y de la cantidad');
    expect(texto).toContain('formulario de Contáctenos');
  });

  it('los botones llevan a Catálogo y a Contáctenos', async () => {
    const user = userEvent.setup();
    renderSitio('/');
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Ver catálogo' }));
    expect(screen.getByTestId('ubicacion').textContent).toBe('/catalogo');
    cleanup();
    renderSitio('/');
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Contáctenos' }));
    expect(screen.getByTestId('ubicacion').textContent).toBe('/contactenos');
  });

  it('el título de la pestaña es "CANI Café | Inicio"', () => {
    renderSitio('/');
    expect(document.title).toBe('CANI Café | Inicio');
  });
});

describe('HU-402 página Catálogo', () => {
  it('muestra arriba el texto de precios', async () => {
    renderSitio('/catalogo');
    await screen.findAllByRole('listitem');
    expect(screen.getByText('Los precios varían según la cantidad y el tipo de cliente. Solicite información en Contáctenos.')).toBeTruthy();
    expect(document.title).toBe('CANI Café | Catálogo');
  });

  it('muestra 72 tarjetas agrupadas en 9 variedades de 8, con nombre, presentación y descripción de hasta 300 caracteres', async () => {
    renderSitio('/catalogo');
    const grupos = await screen.findAllByRole('region');
    expect(grupos).toHaveLength(9);
    expect(grupos.map((g) => within(g).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Villa Sarchí', 'Caturra', 'Catuaí', 'Kenia', 'San Roque', 'Milenio', 'Centroamericano', 'Casiopea', 'Geisha',
    ]);
    for (const g of grupos) expect(within(g).getAllByRole('listitem')).toHaveLength(8);
    const primera = within(grupos[0]).getAllByRole('listitem')[0];
    expect(within(primera).getByRole('heading', { level: 3 }).textContent).toBe('Villa Sarchí');
    expect(within(primera).getByText('Bolsa de 250 g, grano entero')).toBeTruthy();
    for (const d of document.querySelectorAll('.pub-card-description')) {
      expect(d.textContent!.length).toBeGreaterThan(0);
      expect(d.textContent!.length).toBeLessThanOrEqual(300);
    }
  });

  it('recorta una descripción de más de 300 caracteres', async () => {
    vi.mocked(listPublicProductsIn).mockResolvedValue([
      { id: 'p-1', name: 'Largo', presentation: 'Bolsa', description: 'a'.repeat(400), active: true },
    ]);
    renderSitio('/catalogo');
    await screen.findByRole('heading', { level: 3, name: 'Largo' });
    expect(document.querySelector('.pub-card-description')!.textContent).toHaveLength(300);
  });

  it('ninguna tarjeta muestra precios ni permite comprar', async () => {
    renderSitio('/catalogo');
    await screen.findAllByRole('region');
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(/₡|\$|precio:|comprar|carrito/i);
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(within(main).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('cada tarjeta tiene "Me interesa", que abre Contáctenos con ese producto', async () => {
    const user = userEvent.setup();
    renderSitio('/catalogo');
    const botones = await screen.findAllByRole('link', { name: /^Me interesa/ });
    expect(botones).toHaveLength(72);
    expect(botones.every((b) => b.textContent === 'Me interesa')).toBe(true);
    const geisha = screen.getByRole('link', { name: 'Me interesa: Geisha, Bolsa de 1 kg, molido' });
    expect(geisha.getAttribute('href')).toBe('/contactenos?producto=prod-09-geisha-1000-molido');
    await user.click(geisha);
    expect(screen.getByTestId('ubicacion').textContent).toBe('/contactenos?producto=prod-09-geisha-1000-molido');
  });

  it('sin productos: "Pronto publicaremos nuestros productos."', async () => {
    vi.mocked(listPublicProductsIn).mockResolvedValue([]);
    renderSitio('/catalogo');
    expect(await screen.findByText('Pronto publicaremos nuestros productos.')).toBeTruthy();
    expect(screen.queryAllByRole('listitem').filter((li) => li.classList.contains('pub-card'))).toHaveLength(0);
  });

  it('si falla la carga, avisa y no muestra el mensaje de catálogo vacío', async () => {
    vi.mocked(listPublicProductsIn).mockRejectedValue(new Error('permission-denied'));
    renderSitio('/catalogo');
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar el catálogo. Intente de nuevo.');
    expect(screen.queryByText('Pronto publicaremos nuestros productos.')).toBeNull();
  });
});
