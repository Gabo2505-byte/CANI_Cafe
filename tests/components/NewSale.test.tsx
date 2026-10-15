// @vitest-environment jsdom
// HU-301: Crear una posible venta
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { newSalePath } from '../../src/app/routes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import { listActiveProducts } from '../../src/products/productsApi';
import { getContactForSale, listActiveContacts } from '../../src/sales/contactSearchApi';
import { createSale, listOpenSaleTitles } from '../../src/sales/salesApi';
import { TimedNotice } from '../../src/sales/TimedNotice';
import type { Contact, Product } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({ createSale: vi.fn(), listOpenSaleTitles: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({ listActiveContacts: vi.fn(), getContactForSale: vi.fn() }));
vi.mock('../../src/products/productsApi', () => ({ listActiveProducts: vi.fn(), listProducts: vi.fn() }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

const contact = (id: string, fullName: string, email: string): Contact => ({
  id,
  fullName,
  nameSortKey: fullName.toLowerCase(),
  email,
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-09-01T12:00:00Z')),
});
const ANA = contact('contact-001', 'Ana Prueba Mora', 'ana.prueba@example.com');
const BRUNO = contact('contact-002', 'Bruno Ficticio Solís', 'bruno@example.com');
const PRODUCTS: Product[] = [
  { id: 'product-001', name: 'Café en grano', presentation: 'Bolsa de 340 g', description: '', active: true },
  { id: 'product-002', name: 'Café molido', presentation: 'Bolsa de 1 kg', description: '', active: true },
];

let currentLocation: ReturnType<typeof useLocation>;
function LocationProbe() {
  currentLocation = useLocation();
  return null;
}

function renderAt(path: string) {
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
  vi.mocked(listActiveContacts).mockResolvedValue([ANA, BRUNO]);
  vi.mocked(getContactForSale).mockResolvedValue(ANA);
  vi.mocked(listActiveProducts).mockResolvedValue(PRODUCTS);
  vi.mocked(listOpenSaleTitles).mockResolvedValue([]);
  vi.mocked(createSale).mockResolvedValue('sale-nueva');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const title = () => screen.getByLabelText(/^Título/) as HTMLInputElement;
const amount = () => screen.getByLabelText(/^Monto estimado/) as HTMLInputElement;
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(title(), 'Café en grano para su cafetería');
  await user.type(amount(), '450000');
}

describe('HU-301 Crear una posible venta', () => {
  it('la pantalla "Posibles ventas" tiene el botón "Nueva posible venta", que abre el formulario', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas');
    await user.click(screen.getByRole('button', { name: 'Nueva posible venta' }));
    expect(currentLocation.pathname).toBe('/posibles-ventas/nueva');
    expect(screen.getByRole('heading', { name: 'Nueva posible venta' })).toBeTruthy();
  });

  it('el formulario tiene los siete datos', async () => {
    renderAt(newSalePath());
    expect(await screen.findByLabelText(/^Contacto/)).toBeTruthy();
    expect(title()).toBeTruthy();
    expect(screen.getByLabelText(/^Etapa/)).toBeTruthy();
    expect(amount()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agregar producto' })).toBeTruthy();
    expect(screen.getByLabelText(/^Fecha del próximo seguimiento/)).toBeTruthy();
    expect(screen.getByLabelText(/^Notas/)).toBeTruthy();
  });

  it('flujo completo: guarda contacto, datos y productos y vuelve al tablero con la confirmación', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await waitFor(() => expect(listActiveContacts).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/^Contacto/), 'ana');
    await user.click(await screen.findByRole('option', { name: /Ana Prueba Mora/ }));
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText(/^Etapa/), 'en_negociacion');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Producto 1'), 'product-001');
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '20');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(createSale).toHaveBeenCalledOnce());
    expect(createSale).toHaveBeenCalledWith({
      contactId: 'contact-001',
      title: 'Café en grano para su cafetería',
      stage: 'en_negociacion',
      estimatedAmount: 450000,
      nextFollowUpAt: null,
      notes: '',
      products: [{ productId: 'product-001', quantity: 20 }],
    });
    await waitFor(() => expect(currentLocation.pathname).toBe('/posibles-ventas'));
    expect((await screen.findByRole('status')).textContent).toBe('Posible venta registrada correctamente.');
  });

  it('se puede guardar sin productos, sin seguimiento y sin notas', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await user.type(await screen.findByLabelText(/^Contacto/), 'bruno');
    await user.click(await screen.findByRole('option', { name: /Bruno/ }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(createSale).toHaveBeenCalledOnce());
    expect(vi.mocked(createSale).mock.calls[0][0]).toMatchObject({ stage: 'nuevo_interesado', products: [] });
  });

  it('sin llenar los obligatorios muestra los mensajes y no guarda', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await screen.findByLabelText(/^Contacto/);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts()).toContain('Ingrese el título.'));
    expect(alerts()).toEqual(['Seleccione un contacto.', 'Ingrese el título.', 'Ingrese un monto válido.']);
    expect(createSale).not.toHaveBeenCalled();
  });

  it('título repetido entre las abiertas del contacto: no guarda', async () => {
    vi.mocked(listOpenSaleTitles).mockResolvedValue(['Café en grano para su cafetería']);
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await user.type(await screen.findByLabelText(/^Contacto/), 'ana');
    await user.click(await screen.findByRole('option', { name: /Ana/ }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(alerts()).toEqual(['Este contacto ya tiene una posible venta abierta con este título.']),
    );
    expect(listOpenSaleTitles).toHaveBeenCalledWith('contact-001');
    expect(createSale).not.toHaveBeenCalled();
  });

  it('una fila de producto sin completar impide guardar', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await user.type(await screen.findByLabelText(/^Contacto/), 'ana');
    await user.click(await screen.findByRole('option', { name: /Ana/ }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(alerts()).toEqual(['Seleccione un producto o elimine la fila.', 'Ingrese una cantidad entre 1 y 9999.']),
    );
    expect(createSale).not.toHaveBeenCalled();
  });

  it('si falla el guardado lo avisa y se queda en el formulario con los datos', async () => {
    vi.mocked(createSale).mockRejectedValue(new Error('sin red'));
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await user.type(await screen.findByLabelText(/^Contacto/), 'ana');
    await user.click(await screen.findByRole('option', { name: /Ana/ }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts()).toEqual(['No se pudo registrar la posible venta. Intente de nuevo.']));
    expect(currentLocation.pathname).toBe('/posibles-ventas/nueva');
    expect(title().value).toBe('Café en grano para su cafetería');
  });

  it('desde la ficha (contactId) el contacto viene elegido y no se puede cambiar', async () => {
    const user = userEvent.setup();
    renderAt(newSalePath('contact-001'));
    const contactField = (await screen.findByDisplayValue('Ana Prueba Mora')) as HTMLInputElement;
    expect(contactField.readOnly).toBe(true);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(createSale).toHaveBeenCalledOnce());
    expect(vi.mocked(createSale).mock.calls[0][0].contactId).toBe('contact-001');
    expect(listActiveContacts).not.toHaveBeenCalled();
  });

  it('un contacto que no existe muestra un aviso en lugar del formulario', async () => {
    vi.mocked(getContactForSale).mockResolvedValue(null);
    renderAt(newSalePath('no-existe'));
    expect((await screen.findByRole('alert')).textContent).toBe('No se encontró el contacto.');
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('Cancelar vuelve al tablero sin guardar', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await screen.findByLabelText(/^Contacto/);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(currentLocation.pathname).toBe('/posibles-ventas');
    expect(createSale).not.toHaveBeenCalled();
  });
});

describe('HU-301 mensajes de error', () => {
  it('el mensaje de un dato desaparece al corregirlo y los demás se quedan', async () => {
    const user = userEvent.setup();
    renderAt('/posibles-ventas/nueva');
    await screen.findByLabelText(/^Contacto/);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts()).toHaveLength(3));

    await user.type(title(), 'Venta');
    expect(alerts()).toEqual(['Seleccione un contacto.', 'Ingrese un monto válido.']);
    await user.type(amount(), '5');
    expect(alerts()).toEqual(['Seleccione un contacto.']);
  });
});

describe('confirmación en franja verde', () => {
  it('desaparece sola a los 5 segundos', () => {
    vi.useFakeTimers();
    render(<TimedNotice message="Posible venta registrada correctamente." />);
    expect(screen.getByRole('status').textContent).toBe('Posible venta registrada correctamente.');
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
