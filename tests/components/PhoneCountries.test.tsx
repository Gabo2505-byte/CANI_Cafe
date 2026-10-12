// @vitest-environment jsdom
// HU-202: Teléfonos de Costa Rica y de otros países
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { createContact, getContact } from '../../src/contacts/contactsApi';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({ createContact: vi.fn(), getContact: vi.fn() }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

function renderAt(path: string) {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const countrySelect = () => screen.getByLabelText('País del teléfono') as HTMLSelectElement;
const numberInput = () => screen.getByLabelText('Teléfono') as HTMLInputElement;
const contact = (phoneCountry: string, phoneNumber: string): Contact => ({
  id: 'c1',
  fullName: 'Contacto Prueba',
  email: null,
  phoneCountry,
  phoneNumber,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
});

async function fillAndSave(country: string, number: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nombre completo', { exact: false }), 'Contacto Prueba');
  if (country !== 'CR') await user.selectOptions(countrySelect(), country);
  await user.type(numberInput(), number);
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
}

beforeEach(() => {
  vi.mocked(createContact).mockReset().mockResolvedValue('c1');
  vi.mocked(getContact).mockReset();
});
afterEach(cleanup);

describe('HU-202 Teléfonos de Costa Rica y de otros países', () => {
  it('el teléfono tiene dos partes: primero el país en una lista y después el número', () => {
    renderAt('/contactos/nuevo');
    const select = countrySelect();
    const input = numberInput();
    expect(select.tagName).toBe('SELECT');
    expect(input.tagName).toBe('INPUT');
    // El país va antes que el número
    expect(select.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la lista muestra cada país con su código y Costa Rica (+506) viene elegido', () => {
    renderAt('/contactos/nuevo');
    const select = countrySelect();
    expect(select.value).toBe('CR');
    expect(select.selectedOptions[0].textContent).toBe('Costa Rica (+506)');
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels).toContain('Estados Unidos (+1)');
    expect(labels).toContain('Nicaragua (+505)');
    expect(labels).toContain('España (+34)');
    expect(select.options.length).toBeGreaterThan(200);
  });

  it('Costa Rica con 8 números se guarda y se muestra "+506 8888-8888"', async () => {
    vi.mocked(getContact).mockResolvedValue(contact('CR', '88888888'));
    renderAt('/contactos/nuevo');
    await fillAndSave('CR', '8888 8888');

    expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ phoneCountry: 'CR', phoneNumber: '88888888' }));
    expect(await screen.findByText('+506 8888-8888')).toBeTruthy();
  });

  it.each(['8888888', '888888888'])('Costa Rica con %s → "El teléfono debe tener 8 dígitos."', async (number) => {
    renderAt('/contactos/nuevo');
    await fillAndSave('CR', number);
    expect(screen.getByText('El teléfono debe tener 8 dígitos.')).toBeTruthy();
    expect(createContact).not.toHaveBeenCalled();
  });

  it('otro país entre 6 y 14 números se guarda y se muestra con su código: "+1 3055551234"', async () => {
    vi.mocked(getContact).mockResolvedValue(contact('US', '3055551234'));
    renderAt('/contactos/nuevo');
    await fillAndSave('US', '305 555 1234');

    expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ phoneCountry: 'US', phoneNumber: '3055551234' }));
    expect(await screen.findByText('+1 3055551234')).toBeTruthy();
  });

  it.each(['12345', '123456789012345'])(
    'otro país con %s → "El teléfono debe tener entre 6 y 14 dígitos."',
    async (number) => {
      renderAt('/contactos/nuevo');
      await fillAndSave('US', number);
      expect(screen.getByText('El teléfono debe tener entre 6 y 14 dígitos.')).toBeTruthy();
      expect(createContact).not.toHaveBeenCalled();
    },
  );
});
