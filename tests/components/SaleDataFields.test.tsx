// @vitest-environment jsdom
// HU-303: Completar los datos de una posible venta
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SALE_FORM, validateSaleForm, type SaleFormErrors, type SaleFormValues } from '../../src/sales/saleForm';
import { SaleDataFields } from '../../src/sales/SaleDataFields';

/** Hace el papel del formulario de HU-301: valida al pulsar "Guardar". */
function Harness({ onSave, openTitles = [] }: { onSave: (v: SaleFormValues) => void; openTitles?: string[] }) {
  const [values, setValues] = useState<SaleFormValues>(EMPTY_SALE_FORM);
  const [errors, setErrors] = useState<SaleFormErrors>({});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateSaleForm(values, { contactId: 'contact-001', today: '2026-10-14', openTitles });
        setErrors(found);
        if (Object.keys(found).length === 0) onSave(values);
      }}
    >
      <SaleDataFields values={values} onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))} errors={errors} />
      <button type="submit">Guardar</button>
    </form>
  );
}

afterEach(cleanup);

function setup(props: { openTitles?: string[] } = {}) {
  const onSave = vi.fn();
  render(<Harness onSave={onSave} {...props} />);
  return { onSave, user: userEvent.setup() };
}
const title = () => screen.getByLabelText(/^Título/) as HTMLInputElement;
const amount = () => screen.getByLabelText(/^Monto estimado/) as HTMLInputElement;
const followUp = () => screen.getByLabelText(/^Fecha del próximo seguimiento/) as HTMLInputElement;
const notes = () => screen.getByLabelText(/^Notas/) as HTMLTextAreaElement;
const errorsShown = () => screen.queryAllByRole('alert').map((a) => a.textContent);

describe('HU-303 Datos de la posible venta', () => {
  it('la etapa viene en "Nuevo interesado" y ofrece solo las cuatro abiertas', () => {
    setup();
    const stage = screen.getByLabelText(/^Etapa/) as HTMLSelectElement;
    expect(stage.options[stage.selectedIndex].text).toBe('Nuevo interesado');
    expect(Array.from(stage.options).map((o) => o.text)).toEqual([
      'Nuevo interesado',
      'Contactado',
      'Precio o cotización enviada',
      'En negociación',
    ]);
  });

  it('el título acepta como máximo 100 caracteres y muestra el contador', async () => {
    const { user } = setup();
    await user.click(title());
    await user.paste('a'.repeat(120));
    expect(title().value).toHaveLength(100);
    expect(screen.getByText('100/100')).toBeTruthy();
  });

  it('las notas aceptan como máximo 1000 caracteres', async () => {
    const { user } = setup();
    await user.click(notes());
    await user.paste('n'.repeat(1100));
    expect(notes().value).toHaveLength(1000);
  });

  it('con datos correctos guarda (monto ₡ 0 incluido) sin mensajes', async () => {
    const { user, onSave } = setup();
    await user.type(title(), 'Café en grano para su cafetería');
    await user.type(amount(), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual([]);
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ stage: 'nuevo_interesado', amount: '0', followUpDate: '' });
  });

  it('título y monto vacíos: mensajes en rojo bajo cada campo y no guarda', async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual(['Ingrese el título.', 'Ingrese un monto válido.']);
    expect(title().getAttribute('aria-invalid')).toBe('true');
    expect(within(document.getElementById('sale-amount-error')!).getByText('Ingrese un monto válido.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(['1000000000', '-5', '12.5', 'mucho'])('monto "%s": Ingrese un monto válido.', async (value) => {
    const { user, onSave } = setup();
    await user.type(title(), 'Venta');
    await user.type(amount(), value);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual(['Ingrese un monto válido.']);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('título repetido entre las abiertas del contacto', async () => {
    const { user, onSave } = setup({ openTitles: ['Café en grano para su cafetería'] });
    await user.type(title(), 'cafe EN grano para su cafeteria');
    await user.type(amount(), '1000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual(['Este contacto ya tiene una posible venta abierta con este título.']);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('seguimiento anterior a hoy no se guarda; hoy sí', async () => {
    const { user, onSave } = setup();
    await user.type(title(), 'Venta');
    await user.type(amount(), '5');
    await user.type(followUp(), '2026-10-13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual(['La fecha de seguimiento no puede ser anterior a hoy.']);
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(followUp());
    await user.type(followUp(), '2026-10-14');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(errorsShown()).toEqual([]);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
