// @vitest-environment jsdom
// HU-205: Buscar y filtrar contactos
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { getContact, listAllContacts } from '../../src/contacts/contactsApi';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({
  loadContactRecords: vi.fn().mockResolvedValue({ communications: [], sales: [], products: [] }),
}));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  listAllContacts: vi.fn(),
}));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

let currentLocation: ReturnType<typeof useLocation>;
function LocationProbe() {
  currentLocation = useLocation();
  return null;
}

function renderAt(path = '/contactos') {
  render(
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

const contact = (id: string, fullName: string, overrides: Partial<Contact> = {}): Contact => ({
  id,
  fullName,
  nameSortKey: fullName.toLowerCase(),
  email: null,
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
  ...overrides,
});

// En orden alfabético, como llegan de Firestore.
const CONTACTS: Contact[] = [
  contact('a', 'Ana Marín', { email: 'ana@example.com' }),
  contact('b', 'Bruno Solís', { phoneCountry: 'CR', phoneNumber: '88123456', classification: 'cliente' }),
  contact('c', 'Carla Mora', { classification: 'distribuidor' }),
  contact('m', 'María Rodríguez', { email: 'maria.rodriguez@example.com', classification: 'cliente' }),
  contact('p', 'Pedro Ramírez', { phoneCountry: 'CR', phoneNumber: '70001111' }),
];

function serve(all: Contact[]) {
  vi.mocked(listAllContacts).mockResolvedValue(all);
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Buscar por nombre, correo o teléfono' });
const classificationSelect = () => screen.getByRole('combobox', { name: 'Clasificación' }) as HTMLSelectElement;
const names = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => row.firstElementChild?.textContent);
const count = () => screen.getByRole('status').textContent;

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(null);
  vi.mocked(listAllContacts).mockReset();
  serve(CONTACTS);
});
afterEach(cleanup);

describe('HU-205 Buscar y filtrar contactos', () => {
  it('criterio 1 y 3: arriba de la tabla, el buscador y a su derecha "Clasificación" (en "Todos" al abrir)', async () => {
    renderAt();
    const table = await screen.findByRole('table');
    const search = searchBox();
    expect(search.getAttribute('placeholder')).toBe('Buscar por nombre, correo o teléfono');
    const select = classificationSelect();
    expect([...select.options].map((o) => o.textContent)).toEqual(['Todos', 'Persona interesada', 'Cliente']);
    expect(select.selectedOptions[0].textContent).toBe('Todos');
    // Orden en la página: buscador → clasificación → tabla.
    expect(search.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // La lista completa se trae una sola vez al abrir la pantalla (ver la decisión en contactSearch.ts).
    expect(listAllContacts).toHaveBeenCalledTimes(1);
  });

  it('criterio 1 y 2: la tabla cambia mientras se escribe; "mar" muestra "María Rodríguez"', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), 'm');
    await screen.findByText('Se encontraron 4 contactos.');
    expect(names()).toEqual(['Ana Marín', 'Carla Mora', 'María Rodríguez', 'Pedro Ramírez']);
    await user.type(searchBox(), 'ar');
    expect(names()).toEqual(['Ana Marín', 'María Rodríguez']);
    await user.type(searchBox(), 'ia');
    expect(names()).toEqual(['María Rodríguez']);
    expect(count()).toBe('Se encontró 1 contacto.');
    // Se descargan una sola vez, no en cada letra.
    expect(listAllContacts).toHaveBeenCalledTimes(1);
  });

  it('criterio 2: "8812" muestra el contacto con el teléfono 8812-3456', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), '8812');
    await screen.findByText('Se encontró 1 contacto.');
    expect(names()).toEqual(['Bruno Solís']);
    expect(screen.getByText('+506 8812-3456')).toBeTruthy();
  });

  it('busca también por correo y sin tildes ni mayúsculas', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), 'RODRIGUEZ@');
    await screen.findByText('Se encontró 1 contacto.');
    expect(names()).toEqual(['María Rodríguez']);
  });

  it('criterio 3: la clasificación sola filtra la tabla', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.selectOptions(classificationSelect(), 'Cliente');
    await screen.findByText('Se encontraron 2 contactos.');
    expect(names()).toEqual(['Bruno Solís', 'María Rodríguez']);
    await user.selectOptions(classificationSelect(), 'Persona interesada');
    expect(names()).toEqual(['Ana Marín', 'Pedro Ramírez']);
    await user.selectOptions(classificationSelect(), 'Todos');
    await screen.findByText('Se encontraron 5 contactos.');
  });

  it('criterio 4: buscador y clasificación a la vez → solo los que cumplen ambos', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), 'mar');
    await user.selectOptions(classificationSelect(), 'Persona interesada');
    await screen.findByText('Se encontró 1 contacto.');
    expect(names()).toEqual(['Ana Marín']);
    await user.selectOptions(classificationSelect(), 'Cliente');
    expect(names()).toEqual(['María Rodríguez']);
  });

  it('criterio 5: sin buscar, indica el total: "Se encontraron 5 contactos."', async () => {
    renderAt();
    await screen.findByRole('table');
    expect(await screen.findByText('Se encontraron 5 contactos.')).toBeTruthy();
  });

  it('criterio 5: sin resultados, "No se encontraron contactos." y no se muestra la tabla', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), 'zzz');
    await screen.findByText('No se encontraron contactos.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Paginación de contactos' })).toBeNull();
    // Borrar la búsqueda vuelve a la lista completa.
    await user.clear(searchBox());
    await screen.findByRole('table');
    expect(await screen.findByText('Se encontraron 5 contactos.')).toBeTruthy();
  });

  it('la búsqueda y la clasificación quedan en la URL (para "Volver a contactos") y vuelven a la página 1', async () => {
    const many = Array.from({ length: 45 }, (_, i) => contact(`x${i}`, `Marta ${String(i).padStart(2, '0')}`));
    serve(many);
    const user = userEvent.setup();
    renderAt('/contactos?pagina=2');
    await screen.findByText('Página 2 de 3');
    await user.type(searchBox(), 'marta 1');
    await user.selectOptions(classificationSelect(), 'Persona interesada');
    await screen.findByText('Se encontraron 10 contactos.');
    const params = new URLSearchParams(currentLocation.search);
    expect(params.get('buscar')).toBe('marta 1');
    expect(params.get('clasificacion')).toBe('persona_interesada');
    expect(params.get('pagina')).toBeNull();
    expect(screen.getByText('Página 1 de 1')).toBeTruthy();
  });

  it('al abrir la lista con la búsqueda en la URL, el buscador y la tabla la respetan', async () => {
    renderAt('/contactos?buscar=mar&clasificacion=cliente');
    await screen.findByText('Se encontró 1 contacto.');
    expect((searchBox() as HTMLInputElement).value).toBe('mar');
    expect(classificationSelect().value).toBe('cliente');
    expect(names()).toEqual(['María Rodríguez']);
  });

  it('"Contactos" en la barra superior vuelve a la lista sin búsqueda ni filtro', async () => {
    const user = userEvent.setup();
    renderAt('/contactos?buscar=mar&clasificacion=cliente');
    await screen.findByText('Se encontró 1 contacto.');
    await user.click(within(screen.getByRole('navigation', { name: /principal/i })).getByRole('link', { name: 'Contactos' }));
    await screen.findByText('Se encontraron 5 contactos.');
    expect((searchBox() as HTMLInputElement).value).toBe('');
    expect(classificationSelect().value).toBe('todos');
    expect(currentLocation.search).toBe('');
  });

  it('los resultados también se paginan de 20 en 20', async () => {
    const many = Array.from({ length: 45 }, (_, i) => contact(`x${i}`, `Marta ${String(i).padStart(2, '0')}`));
    serve(many);
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await user.type(searchBox(), 'marta');
    await screen.findByText('Se encontraron 45 contactos.');
    expect(names()).toHaveLength(20);
    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 3 de 3')).toBeTruthy();
    expect(names()).toHaveLength(5);
    expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('si falla la carga, muestra el error y el buscador sigue en su lugar', async () => {
    vi.mocked(listAllContacts).mockRejectedValue(new Error('unavailable'));
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudieron cargar los contactos. Intente de nuevo.');
    expect(searchBox()).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
