// @vitest-environment jsdom
// HU-302: Elegir el contacto de una posible venta
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactPicker } from '../../src/sales/ContactPicker';
import { listActiveContacts } from '../../src/sales/contactSearchApi';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/sales/contactSearchApi', () => ({ listActiveContacts: vi.fn() }));

const contact = (id: string, fullName: string, email: string | null): Contact => ({
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

const ANA = contact('c1', 'Ana Prueba Mora', 'ana.prueba@example.com');
const BRUNO = contact('c2', 'Bruno Ficticio Solís', 'bruno@example.com');
const MARIOS = Array.from({ length: 12 }, (_, i) => contact(`m${i}`, `Mario Relleno ${String(i).padStart(2, '0')}`, null));

function Harness({ fixed, onChange }: { fixed?: Contact; onChange?: (c: Contact | null) => void }) {
  const [selected, setSelected] = useState<Contact | null>(null);
  return (
    <>
      <label htmlFor="contact">Contacto</label>
      <ContactPicker
        id="contact"
        selected={selected}
        fixedContact={fixed}
        onSelect={(c) => {
          setSelected(c);
          onChange?.(c);
        }}
      />
    </>
  );
}

beforeEach(() => {
  vi.mocked(listActiveContacts).mockResolvedValue([ANA, BRUNO, ...MARIOS]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function setup(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  await waitFor(() => expect(listActiveContacts).toHaveBeenCalled());
  return { user, input: screen.getByLabelText('Contacto') as HTMLInputElement };
}

describe('HU-302 Elegir el contacto', () => {
  it('con una sola letra no aparece ninguna lista', async () => {
    const { user, input } = await setup();
    await user.type(input, 'a');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('con 2 letras del nombre aparece la lista y se elige un contacto', async () => {
    const onChange = vi.fn();
    const { user, input } = await setup({ onChange });
    await user.type(input, 'an');

    const option = await screen.findByRole('option', { name: /Ana Prueba Mora/ });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(ANA);
    expect(input.value).toBe('Ana Prueba Mora');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('también busca por correo, sin importar tildes ni mayúsculas', async () => {
    const { user, input } = await setup();
    await user.type(input, 'BRUNO@EX');
    expect(await screen.findByRole('option', { name: /Bruno Ficticio Solís/ })).toBeTruthy();
    await user.clear(input);
    await user.type(input, 'solis');
    expect(await screen.findByRole('option', { name: /Bruno Ficticio Solís/ })).toBeTruthy();
  });

  it('muestra como máximo 10 contactos', async () => {
    const { user, input } = await setup();
    await user.type(input, 'mario');
    await screen.findAllByRole('option');
    expect(screen.getAllByRole('option')).toHaveLength(10);
  });

  it('sin coincidencias: No se encontraron contactos.', async () => {
    const { user, input } = await setup();
    await user.type(input, 'zzz');
    expect(await screen.findByText('No se encontraron contactos.')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('se puede elegir con el teclado', async () => {
    const onChange = vi.fn();
    const { user, input } = await setup({ onChange });
    await user.type(input, 'mario');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith(MARIOS[1]);
  });

  it('escribir de nuevo deshace la elección', async () => {
    const onChange = vi.fn();
    const { user, input } = await setup({ onChange });
    await user.type(input, 'ana');
    await user.click(await screen.findByRole('option'));
    await user.type(input, 'x');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('desde la ficha el contacto viene elegido y no se puede cambiar', async () => {
    render(<Harness fixed={ANA} />);
    const input = screen.getByLabelText('Contacto') as HTMLInputElement;
    expect(input.value).toBe('Ana Prueba Mora');
    expect(input.readOnly).toBe(true);
    await userEvent.setup().type(input, 'zzz');
    expect(input.value).toBe('Ana Prueba Mora');
    expect(screen.queryByRole('listbox')).toBeNull();
    // No hace falta leer la lista de contactos.
    expect(listActiveContacts).not.toHaveBeenCalled();
  });

  it('si no se pueden cargar los contactos lo avisa', async () => {
    vi.mocked(listActiveContacts).mockRejectedValue(new Error('sin red'));
    render(<Harness />);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudieron cargar los contactos. Intente de nuevo.');
  });
});
