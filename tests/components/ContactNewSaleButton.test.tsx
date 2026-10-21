// @vitest-environment jsdom
// HU-301 (criterio 1): botón "+ Nueva oportunidad" en la pestaña "Oportunidades de venta" de la ficha del contacto
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact } from '../../src/contacts/contactsApi';
import { listActiveProducts } from '../../src/products/productsApi';
import { getContactForSale } from '../../src/sales/contactSearchApi';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({ loadContactRecords: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));
// Pantalla a la que se navega al dar clic en el botón (formulario de nueva posible venta).
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactForSale: vi.fn(),
  listActiveContacts: vi.fn().mockResolvedValue([]),
  getContactNames: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('../../src/products/productsApi', () => ({ listActiveProducts: vi.fn(), listProducts: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({
  createSale: vi.fn(),
  listOpenSaleTitles: vi.fn().mockResolvedValue([]),
  listBoardSales: vi.fn().mockResolvedValue([]),
  updateSale: vi.fn(),
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

const contact: Contact = {
  id: 'contact-002',
  fullName: 'Bruno Ficticio Solís',
  nameSortKey: 'bruno ficticio solis',
  email: 'bruno.ficticio@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000002',
  address: null,
  classification: 'cliente',
  status: 'activo',
  origin: 'referido',
  createdAt: Timestamp.fromDate(new Date('2026-09-03T16:30:00Z')),
};

beforeEach(() => {
  vi.mocked(getContact).mockResolvedValue(contact);
  vi.mocked(getContactForSale).mockResolvedValue(contact);
  vi.mocked(listActiveProducts).mockResolvedValue([]);
  vi.mocked(loadContactRecords).mockResolvedValue({ communications: [], sales: [], products: [] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderContact() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/contact-002']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

async function openSalesTab() {
  const user = userEvent.setup();
  renderContact();
  await user.click(await screen.findByRole('tab', { name: /^Oportunidades de venta/ }));
  return user;
}

describe('HU-301 botón "+ Nueva oportunidad" en la ficha', () => {
  it('aparece en la pestaña "Oportunidades de venta", arriba a la derecha, aunque el contacto no tenga ventas', async () => {
    await openSalesTab();
    const button = await screen.findByRole('button', { name: 'Nueva oportunidad' });
    expect(button.closest('.tab-panel-actions')).not.toBeNull();
    expect(await screen.findByText('Este contacto no tiene oportunidades de venta.')).toBeTruthy();
  });

  it('el nombre accesible del botón es exactamente "Nueva oportunidad" (sin el "+")', async () => {
    await openSalesTab();
    const button = await screen.findByRole('button', { name: 'Nueva oportunidad' });
    expect(screen.queryByRole('button', { name: '+ Nueva oportunidad' })).toBeNull();
    expect(button.closest('.tab-panel-actions')).not.toBeNull();
  });

  it('el "+" del botón se ve pero es decorativo (aria-hidden)', async () => {
    await openSalesTab();
    const button = await screen.findByRole('button', { name: 'Nueva oportunidad' });
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe('+');
    expect(button.textContent).toBe('+Nueva oportunidad');
  });

  it('no aparece en las otras pestañas', async () => {
    const user = userEvent.setup();
    renderContact();
    await screen.findByRole('tab', { name: /^Comunicaciones/ });
    expect(screen.queryByRole('button', { name: 'Nueva oportunidad' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: /^Productos de interés/ }));
    expect(screen.queryByRole('button', { name: 'Nueva oportunidad' })).toBeNull();
  });

  it('al darle clic abre el formulario con este contacto ya elegido y sin poder cambiarlo', async () => {
    const user = await openSalesTab();
    await user.click(await screen.findByRole('button', { name: 'Nueva oportunidad' }));

    expect(currentLocation.pathname).toBe('/posibles-ventas/nueva');
    expect(currentLocation.search).toBe('?contactId=contact-002');
    const field = (await screen.findByDisplayValue('Bruno Ficticio Solís')) as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(getContactForSale).toHaveBeenCalledWith('contact-002');
  });
});
