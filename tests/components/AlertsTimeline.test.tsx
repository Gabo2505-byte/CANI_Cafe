// @vitest-environment jsdom
// Bitácora del contacto: segunda pestaña de la pantalla "Avisos" (la tabla de HU-316 no cambia).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import { listAlerts } from '../../src/sales/alertsApi';
import { buildTimeline, type Timeline } from '../../src/sales/timeline';
import { listTimelineContacts, loadContactTimeline } from '../../src/sales/timelineApi';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/alertsApi', () => ({ listAlerts: vi.fn() }));
vi.mock('../../src/sales/timelineApi', () => ({ listTimelineContacts: vi.fn(), loadContactTimeline: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn().mockResolvedValue(null) }));
vi.mock('../../src/sales/salesApi', () => ({ listBoardSales: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/sales/contactSearchApi', () => ({ getContactNames: vi.fn().mockResolvedValue(new Map()) }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

const cr = (iso: string) => new Date(`${iso}-06:00`);
const at = (iso: string) => Timestamp.fromDate(cr(iso));

const contact = (id: string, fullName: string, email: string | null, phoneNumber: string | null): Contact => ({
  id,
  fullName,
  nameSortKey: fullName.toLowerCase(),
  email,
  phoneCountry: phoneNumber ? 'CR' : null,
  phoneNumber,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: at('2026-09-01T09:00:00'),
});
const ana = contact('contact-001', 'Ana Prueba Mora', 'ana.prueba@example.com', '88123456');
const bruno = contact('contact-002', 'Bruno Ficticio Solís', 'bruno@example.com', '70001111');
const diego = contact('contact-004', 'Diego Ejemplo Rojas', 'diego@example.com', null);

const anaTimeline: Timeline = buildTimeline({
  communications: [
    {
      id: 'comm-006',
      contactId: 'contact-001',
      saleId: null,
      appliesToAllSales: true,
      date: at('2026-10-12T18:20:00'),
      medium: 'formulario_web',
      otherMedium: null,
      note: 'Quiere saber si hacen entregas en Alajuela.',
      source: 'formulario_web',
      userId: null,
      createdAt: at('2026-10-12T18:20:05'),
    },
    {
      id: 'comm-001',
      contactId: 'contact-001',
      saleId: 'sale-004',
      appliesToAllSales: false,
      date: at('2026-09-28T00:00:00'),
      medium: 'llamada',
      otherMedium: null,
      note: 'Primer contacto.',
      source: 'usuario',
      userId: 'seed-admin-001',
      createdAt: at('2026-09-28T09:30:00'),
    },
  ],
  sales: [
    {
      id: 'sale-004',
      contactId: 'contact-001',
      title: 'Muestras Geisha',
      stage: 'perdida',
      estimatedAmount: 1000,
      nextFollowUpAt: null,
      notes: '',
      createdAt: at('2026-09-10T09:30:00'),
      stageChangedAt: at('2026-10-08T15:00:00'),
      lastCommunicationAt: null,
    },
  ],
  history: [
    { id: 'sale-004_01', saleId: 'sale-004', previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-10T09:30:00'), lossReason: null },
    { id: 'sale-004_03', saleId: 'sale-004', previousStage: 'contactado', newStage: 'perdida', changedAt: at('2026-10-08T15:00:00'), lossReason: 'El cliente eligió otro proveedor.' },
  ],
});

let currentLocation = '';
function LocationProbe() {
  const location = useLocation();
  currentLocation = `${location.pathname}${location.search}`;
  return null;
}

function renderAlerts(path = '/avisos') {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(listAlerts).mockResolvedValue([]);
  vi.mocked(listTimelineContacts).mockResolvedValue([ana, bruno, diego]);
  vi.mocked(loadContactTimeline).mockImplementation(async (id) =>
    id === 'contact-001' ? anaTimeline : { events: [], truncated: false },
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const eventsList = () => screen.getByRole('list', { name: 'Eventos de la bitácora' });
const getEvents = () => within(eventsList()).getAllByRole('listitem');
const findEvents = async () => within(await screen.findByRole('list', { name: 'Eventos de la bitácora' })).getAllByRole('listitem');
const search = () => screen.findByRole('searchbox', { name: 'Buscar por nombre, correo o teléfono' });

async function openTimelineFor(user: ReturnType<typeof userEvent.setup>, text: string, name: string) {
  await user.click(screen.getByRole('tab', { name: 'Bitácora' }));
  await user.type(await search(), text);
  await user.click(within(screen.getByRole('list', { name: 'Contactos encontrados' })).getByRole('button', { name: new RegExp(name) }));
  await screen.findByRole('heading', { level: 2, name });
}

describe('pestañas de la pantalla "Avisos"', () => {
  it('al abrir se ven los avisos pendientes (la tabla de siempre) y no se cargan contactos', async () => {
    renderAlerts();
    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Avisos pendientes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Bitácora' }).getAttribute('aria-selected')).toBe('false');
    expect(await screen.findByText('No hay avisos pendientes.')).toBeTruthy();
    expect(listTimelineContacts).not.toHaveBeenCalled();
  });

  it('la pestaña "Bitácora" muestra el buscador y la de avisos vuelve a la tabla', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('tab', { name: 'Bitácora' }));
    expect(await search()).toBeTruthy();
    expect(screen.getByText(/Busque un contacto para ver su bitácora/)).toBeTruthy();
    expect(currentLocation).toBe('/avisos?vista=bitacora');
    await user.click(screen.getByRole('tab', { name: 'Avisos pendientes' }));
    expect(await screen.findByText('No hay avisos pendientes.')).toBeTruthy();
    expect(currentLocation).toBe('/avisos');
  });

  it('se cambia de pestaña con las flechas del teclado', async () => {
    const user = userEvent.setup();
    renderAlerts();
    screen.getByRole('tab', { name: 'Avisos pendientes' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Bitácora' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Bitácora' }));
  });
});

describe('buscar un contacto', () => {
  it('por nombre, sin distinguir mayúsculas ni tildes', async () => {
    const user = userEvent.setup();
    renderAlerts('/avisos?vista=bitacora');
    await user.type(await search(), 'bruno ficticio solis');
    const results = within(screen.getByRole('list', { name: 'Contactos encontrados' })).getAllByRole('button');
    expect(results.map((b) => b.textContent)).toEqual([expect.stringContaining('Bruno Ficticio Solís')]);
  });

  it('por correo y por teléfono (con o sin guion)', async () => {
    const user = userEvent.setup();
    renderAlerts('/avisos?vista=bitacora');
    const box = await search();
    await user.type(box, 'ana.prueba@');
    expect(screen.getByRole('button', { name: /Ana Prueba Mora/ })).toBeTruthy();
    await user.clear(box);
    await user.type(box, '8812-34');
    expect(within(screen.getByRole('list', { name: 'Contactos encontrados' })).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Ana Prueba Mora/ }).textContent).toContain('+506 8812-3456');
  });

  it('sin coincidencias dice "No se encontraron contactos."', async () => {
    const user = userEvent.setup();
    renderAlerts('/avisos?vista=bitacora');
    await user.type(await search(), 'zzz');
    expect(screen.getByText('No se encontraron contactos.')).toBeTruthy();
  });

  it('si no se pueden cargar los contactos lo avisa', async () => {
    vi.mocked(listTimelineContacts).mockRejectedValue(new Error('offline'));
    renderAlerts('/avisos?vista=bitacora');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudieron cargar los contactos. Intente de nuevo.'));
  });
});

describe('línea de tiempo del contacto', () => {
  it('al elegirlo muestra sus eventos del más reciente al más antiguo, sin quién los registró', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await openTimelineFor(user, 'ana', 'Ana Prueba Mora');
    expect(loadContactTimeline).toHaveBeenCalledWith('contact-001');
    expect(currentLocation).toBe('/avisos?vista=bitacora&contacto=contact-001');

    const items = await findEvents();
    const texts = items.map((li) => li.textContent ?? '');
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain('12/10/2026 6:20 p. m.');
    expect(texts[0]).toContain('Comunicación');
    expect(texts[0]).toContain('Origen: formulario web');
    expect(texts[0]).toContain('Oportunidad de venta: Todas sus oportunidades de venta');
    expect(texts[1]).toContain('08/10/2026');
    expect(texts[1]).toContain('Cambio de etapa');
    expect(texts[1]).toContain('Etapa: Contactado → Venta perdida');
    expect(texts[1]).toContain('Motivo de pérdida: El cliente eligió otro proveedor.');
    expect(texts[2]).toContain('28/09/2026');
    expect(texts[2]).toContain('Llamada telefónica');
    expect(texts[2]).toContain('Origen: registro manual');
    expect(texts[2]).toContain('Primer contacto.');
    expect(texts[3]).toContain('Oportunidad creada');
    expect(texts[3]).toContain('Etapa inicial: Nuevo interesado');
    expect(document.body.textContent).not.toContain('Registrado por');
    expect(document.body.textContent).not.toContain('seed-admin-001');
  });

  it('el título de la oportunidad abre su detalle y la ficha del contacto tiene su enlace', async () => {
    const user = userEvent.setup();
    renderAlerts('/avisos?vista=bitacora&contacto=contact-001');
    await screen.findByRole('heading', { level: 2, name: 'Ana Prueba Mora' });
    expect(screen.getByRole('link', { name: 'Ver ficha del contacto' }).getAttribute('href')).toBe('/contactos/contact-001');
    const saleLinks = await screen.findAllByRole('link', { name: 'Muestras Geisha' });
    expect(saleLinks[0].getAttribute('href')).toBe('/posibles-ventas/sale-004');
    await user.click(saleLinks[0]);
    expect(currentLocation).toBe('/posibles-ventas/sale-004');
  });

  it('el filtro "Tipo de evento" deja solo comunicaciones o solo cambios de etapa', async () => {
    const user = userEvent.setup();
    renderAlerts('/avisos?vista=bitacora&contacto=contact-001');
    await findEvents();
    const select = screen.getByRole('combobox', { name: 'Tipo de evento' });
    expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Todos', 'Comunicaciones', 'Cambios de etapa']);

    await user.selectOptions(select, 'comunicaciones');
    expect(getEvents().map((li) => li.textContent)).toEqual([
      expect.stringContaining('Formulario web'),
      expect.stringContaining('Llamada telefónica'),
    ]);
    expect(currentLocation).toBe('/avisos?vista=bitacora&contacto=contact-001&tipo=comunicaciones');

    await user.selectOptions(select, 'etapas');
    const stages = getEvents().map((li) => li.textContent ?? '');
    expect(stages).toHaveLength(2);
    expect(stages.every((t) => t.includes('Etapa'))).toBe(true);

    await user.selectOptions(select, 'todos');
    expect(getEvents()).toHaveLength(4);
    expect(currentLocation).toBe('/avisos?vista=bitacora&contacto=contact-001');
  });

  it('un contacto sin eventos muestra el estado vacío', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await openTimelineFor(user, 'diego', 'Diego Ejemplo Rojas');
    expect(await screen.findByText('Este contacto no tiene comunicaciones ni cambios de etapa registrados.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Eventos de la bitácora' })).toBeNull();
  });

  it('con filtro sin resultados lo dice', async () => {
    // Solo un cambio de etapa: con el filtro "Comunicaciones" no queda nada.
    vi.mocked(loadContactTimeline).mockResolvedValue(
      buildTimeline({
        communications: [],
        sales: [],
        history: [{ id: 'h', saleId: 's', previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-01T09:00:00'), lossReason: null }],
      }),
    );
    renderAlerts('/avisos?vista=bitacora&contacto=contact-002&tipo=comunicaciones');
    expect(await screen.findByText('Este contacto no tiene eventos de este tipo.')).toBeTruthy();
  });

  it('con más eventos que el tope avisa que se muestran los más recientes', async () => {
    vi.mocked(loadContactTimeline).mockResolvedValue({ ...anaTimeline, truncated: true });
    renderAlerts('/avisos?vista=bitacora&contacto=contact-001');
    expect(await screen.findByText('Se muestran los 100 eventos más recientes.')).toBeTruthy();
  });

  it('si falla la carga de la bitácora lo avisa', async () => {
    vi.mocked(loadContactTimeline).mockRejectedValue(new Error('offline'));
    renderAlerts('/avisos?vista=bitacora&contacto=contact-001');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar la bitácora. Intente de nuevo.'));
  });
});
