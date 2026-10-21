// @vitest-environment jsdom
// HU-211: Registrar una comunicación
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { createCommunication } from '../../src/communications/communicationsApi';
import { sortCommunications, type ContactRecords } from '../../src/contacts/contactDetail';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact } from '../../src/contacts/contactsApi';
import type { Communication, Contact } from '../../src/shared/types';
import { toCostaRicaDateKey } from '../../src/shared/utils/dates';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/communications/communicationsApi', () => ({ createCommunication: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({ loadContactRecords: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'admin-uid' } as FirebaseUser,
  profile: { id: 'admin-uid', username: 'admin', email: 'admin@example.com', active: true },
};

function renderContact() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/contact-001']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const cr = (localIso: string) => Timestamp.fromDate(new Date(`${localIso}-06:00`));

const contact: Contact = {
  id: 'contact-001',
  fullName: 'Ana Prueba Mora',
  nameSortKey: 'ana prueba mora',
  email: 'ana.prueba@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000001',
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: cr('2026-09-01T09:00:00'),
};

const comm = (id: string, day: string, note: string, overrides: Partial<Communication> = {}): Communication => ({
  id,
  contactId: 'contact-001',
  saleId: null,
  appliesToAllSales: false,
  date: cr(`${day}T00:00:00`),
  medium: 'llamada',
  otherMedium: null,
  note,
  source: 'usuario',
  userId: 'admin-uid',
  createdAt: cr(`${day}T09:00:00`),
  ...overrides,
});

const TODAY = toCostaRicaDateKey(new Date());
const existing = comm('comm-001', '2026-09-28', 'Primer contacto, interesada en conocer los productos.');
const records = (communications: Communication[]): ContactRecords => ({
  communications: sortCommunications(communications),
  sales: [],
  products: [],
});

const dialog = () => screen.getByRole('dialog', { name: 'Registrar comunicación' });
const field = (label: string | RegExp) => within(dialog()).getByLabelText(label) as HTMLInputElement;

async function openDialog() {
  renderContact();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Registrar comunicación' }));
  return user;
}

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(contact);
  vi.mocked(loadContactRecords).mockReset().mockResolvedValue(records([existing]));
  vi.mocked(createCommunication).mockReset().mockResolvedValue('comm-nueva');
});
afterEach(cleanup);

describe('HU-211 Registrar una comunicación', () => {
  it('criterio 1: el botón está en la pestaña "Comunicaciones", arriba, antes del historial', async () => {
    renderContact();
    const button = await screen.findByRole('button', { name: 'Registrar comunicación' });
    const panel = screen.getByRole('tabpanel');
    expect(panel.contains(button)).toBe(true);
    const firstNote = await within(panel).findByText(existing.note);
    expect(button.compareDocumentPosition(firstNote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.parentElement?.className).toContain('tab-panel-actions'); // alineado a la derecha
  });

  it('criterio 1: el botón solo está en la pestaña "Comunicaciones"', async () => {
    renderContact();
    await screen.findByRole('button', { name: 'Registrar comunicación' });
    await userEvent.setup().click(screen.getByRole('tab', { name: /^Oportunidades de venta/ }));
    expect(screen.queryByRole('button', { name: 'Registrar comunicación' })).toBeNull();
  });

  it('criterio 1: al dar clic se abre una ventana con fecha, medio y nota', async () => {
    await openDialog();
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(field('Fecha').type).toBe('date');
    expect(field('Medio').tagName).toBe('SELECT');
    expect(field('Nota').tagName).toBe('TEXTAREA');
  });

  it('criterio 1: los tres son obligatorios', async () => {
    const user = await openDialog();
    fireEvent.change(field('Fecha'), { target: { value: '' } });
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog()).getByText('Seleccione la fecha.')).toBeTruthy();
    expect(within(dialog()).getByText('Seleccione el medio.')).toBeTruthy();
    expect(within(dialog()).getByText('Ingrese la nota.')).toBeTruthy();
    expect(createCommunication).not.toHaveBeenCalled();
  });

  it('criterio 2: la fecha viene con el día de hoy y no deja elegir días futuros', async () => {
    await openDialog();
    expect(field('Fecha').value).toBe(TODAY);
    expect(field('Fecha').max).toBe(TODAY);
  });

  it('criterio 2: fecha futura → "La fecha no puede ser posterior a hoy."', async () => {
    const user = await openDialog();
    fireEvent.change(field('Fecha'), { target: { value: '2099-01-01' } });
    await user.selectOptions(field('Medio'), 'WhatsApp');
    await user.type(field('Nota'), 'Hola');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog()).getByText('La fecha no puede ser posterior a hoy.')).toBeTruthy();
    expect(createCommunication).not.toHaveBeenCalled();
  });

  it('criterio 3: el medio se elige de la lista de la HU', async () => {
    await openDialog();
    const options = within(field('Medio')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Seleccione…', 'Llamada telefónica', 'WhatsApp', 'Correo electrónico', 'Visita presencial', 'Otro']);
  });

  it('criterio 3: con "Otro" hay que escribir cuál fue', async () => {
    const user = await openDialog();
    expect(within(dialog()).queryByLabelText('¿Cuál fue el medio?')).toBeNull();
    await user.selectOptions(field('Medio'), 'Otro');
    expect(field('¿Cuál fue el medio?').placeholder).toBe('Por ejemplo: Instagram');
    await user.type(field('Nota'), 'Escribió por mensaje directo.');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog()).getByText('Indique cuál fue el medio.')).toBeTruthy();
    expect(createCommunication).not.toHaveBeenCalled();

    await user.type(field('¿Cuál fue el medio?'), 'Instagram');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(createCommunication).toHaveBeenCalledWith(
      expect.objectContaining({ medium: 'otro', otherMedium: 'Instagram' }),
      'admin-uid',
    );
  });

  it('criterio 4: la nota acepta como máximo 1000 caracteres, con contador', async () => {
    await openDialog();
    expect(field('Nota').maxLength).toBe(1000);
    expect(within(dialog()).getByText('0/1000')).toBeTruthy();
    fireEvent.change(field('Nota'), { target: { value: 'a'.repeat(1000) } });
    expect(within(dialog()).getByText('1000/1000')).toBeTruthy();
    expect(within(dialog()).getByText(/Llegó al máximo de 1000 caracteres\./)).toBeTruthy();
  });

  it('criterio 5: al guardar se cierra, aparece en el historial y el mensaje de confirmación', async () => {
    const saved = comm('comm-nueva', TODAY, 'Pidió precios del café molido; se le envió la lista.', { medium: 'whatsapp' });
    const user = await openDialog();
    vi.mocked(loadContactRecords).mockResolvedValue(records([existing, saved]));
    await user.selectOptions(field('Medio'), 'WhatsApp');
    await user.type(field('Nota'), '  Pidió precios del café molido; se le envió la lista.  ');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));

    expect(createCommunication).toHaveBeenCalledWith(
      {
        contactId: 'contact-001',
        date: new Date(`${TODAY}T00:00:00-06:00`),
        medium: 'whatsapp',
        otherMedium: null,
        saleId: null, // HU-212: "Todas sus oportunidades de venta" viene elegida
        note: 'Pidió precios del café molido; se le envió la lista.',
      },
      'admin-uid',
    );
    expect(await screen.findByText('Comunicación registrada correctamente.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    const panel = screen.getByRole('tabpanel');
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(2));
    const [first] = within(panel).getAllByRole('listitem');
    expect(first.textContent).toContain('WhatsApp');
    expect(first.textContent).toContain('Pidió precios del café molido; se le envió la lista.');
    expect(screen.getByRole('tab', { name: 'Comunicaciones (2)' })).toBeTruthy();
  });

  it('criterio 5: el mensaje sale dentro de la pestaña, encima del historial (a la vista), y no reaparece al cambiar de pestaña', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const user = await openDialog();
    await user.selectOptions(field('Medio'), 'WhatsApp');
    await user.type(field('Nota'), 'Hola');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));

    const message = await screen.findByText('Comunicación registrada correctamente.');
    const panel = screen.getByRole('tabpanel');
    expect(panel.contains(message)).toBe(true);
    const firstCard = (await within(panel).findAllByRole('listitem'))[0];
    expect(message.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scrolled).toHaveBeenCalled(); // se desplaza hasta el mensaje si la página estaba más abajo

    await user.click(screen.getByRole('tab', { name: /^Oportunidades de venta/ }));
    await user.click(screen.getByRole('tab', { name: /^Comunicaciones/ }));
    expect(screen.queryByText('Comunicación registrada correctamente.')).toBeNull();
  });

  it('criterio 5: una comunicación guardada no tiene opciones para editar ni eliminar', async () => {
    renderContact();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByText(existing.note);
    const item = within(panel).getAllByRole('listitem')[0];
    expect(within(item).queryByRole('button')).toBeNull();
    expect(within(item).queryByRole('textbox')).toBeNull();
  });

  it('"Cancelar" y Escape cierran la ventana sin guardar', async () => {
    const user = await openDialog();
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Registrar comunicación' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(createCommunication).not.toHaveBeenCalled();
  });

  it('si falla el guardado, la ventana sigue abierta con un error y los datos escritos', async () => {
    vi.mocked(createCommunication).mockRejectedValue(new Error('unavailable'));
    const user = await openDialog();
    await user.selectOptions(field('Medio'), 'Llamada telefónica');
    await user.type(field('Nota'), 'Llamó para confirmar.');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog()).findByText('No se pudo registrar la comunicación. Intente de nuevo.')).toBeTruthy();
    expect(field('Nota').value).toBe('Llamó para confirmar.');
    expect(screen.queryByText('Comunicación registrada correctamente.')).toBeNull();
  });

  it('el historial muestra el día (dd/mm/aaaa) y el medio; "Otro" con su texto', async () => {
    vi.mocked(loadContactRecords).mockResolvedValue(
      records([existing, comm('comm-002', '2026-10-01', 'Por Instagram.', { medium: 'otro', otherMedium: 'Instagram' })]),
    );
    renderContact();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByText('Por Instagram.');
    const metas = within(panel).getAllByRole('listitem').map((li) => li.querySelector('.record-meta')?.textContent);
    expect(metas).toEqual(['01/10/2026 · Otro: Instagram', '28/09/2026 · Llamada telefónica']);
  });
});
