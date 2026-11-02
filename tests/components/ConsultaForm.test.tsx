// @vitest-environment jsdom
// HU-403 (formulario "Envíenos su consulta") y HU-501 (revisión de datos) en la página Contáctenos.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsultaForm } from '../../sitio-publico/src/components/ConsultaForm';
import { ContactenosPage } from '../../sitio-publico/src/pages/ContactenosPage';

// La página Contáctenos lee el catálogo; aquí no se consulta Firestore (las pruebas de la lista están en ProductosField.test.tsx).
vi.mock('../../sitio-publico/src/firebase', () => ({ db: {} }));
vi.mock('../../src/products/publicCatalog', () => ({ listPublicProductsIn: vi.fn().mockResolvedValue([]) }));

afterEach(cleanup);

const nombre = () => screen.getByRole('textbox', { name: 'Nombre completo' }) as HTMLInputElement;
const correo = () => screen.getByRole('textbox', { name: 'Correo electrónico' }) as HTMLInputElement;
const telefono = () => screen.getByRole('textbox', { name: /^Teléfono/ }) as HTMLInputElement;
const mensaje = () => screen.getByRole('textbox', { name: /^Mensaje/ }) as HTMLTextAreaElement;
const enviar = () => screen.getByRole('button', { name: 'Enviar' });
const aviso = () => screen.queryByText('Revise los campos marcados en rojo.');

function renderForm(props: Parameters<typeof ConsultaForm>[0] = {}) {
  const user = userEvent.setup();
  render(<ConsultaForm {...props} />);
  return user;
}

describe('HU-403 página Contáctenos', () => {
  it('el formulario "Envíenos su consulta" va a la izquierda y los datos de contacto a la derecha', () => {
    render(
      <MemoryRouter>
        <ContactenosPage />
      </MemoryRouter>,
    );
    const formulario = screen.getByRole('form', { name: 'Envíenos su consulta' });
    const datos = screen.getByRole('complementary');
    expect(formulario.compareDocumentPosition(datos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(datos).getByText('+506 6045 7872')).toBeTruthy();
    expect(within(datos).getByText('cmarotob@gmail.com')).toBeTruthy();
    expect(within(datos).getByText('Naranjo, Alajuela, Costa Rica')).toBeTruthy();
    expect(within(datos).queryByRole('textbox')).toBeNull();
    expect(document.title).toBe('CANI Café | Contáctenos');
  });

  it('pide nombre, correo, teléfono, productos y mensaje', () => {
    renderForm();
    expect(nombre()).toBeTruthy();
    expect(correo()).toBeTruthy();
    expect(telefono()).toBeTruthy();
    expect(screen.getByRole('group', { name: /^Productos de interés/ })).toBeTruthy();
    expect(mensaje()).toBeTruthy();
  });

  it('son obligatorios (con asterisco) nombre, correo y productos; teléfono y mensaje son opcionales', () => {
    renderForm();
    const conAsterisco = Array.from(document.querySelectorAll('.pub-required')).map((s) => s.closest('label, legend')?.textContent);
    expect(conAsterisco).toEqual(['Nombre completo *', 'Correo electrónico *', 'Productos de interés *']);
    expect(nombre().getAttribute('aria-required')).toBe('true');
    expect(correo().getAttribute('aria-required')).toBe('true');
    expect(telefono().getAttribute('aria-required')).toBeNull();
    expect(Array.from(document.querySelectorAll('.optional')).map((s) => s.closest('label')?.textContent)).toEqual([
      'Teléfono (opcional)',
      'Mensaje (opcional)',
    ]);
  });

  it('el nombre y el correo aceptan como máximo 100 caracteres y el mensaje 1000', async () => {
    const user = renderForm();
    expect(nombre().maxLength).toBe(100);
    expect(correo().maxLength).toBe(100);
    expect(mensaje().maxLength).toBe(1000);
    await user.click(nombre());
    await user.paste('a'.repeat(150));
    expect(nombre().value).toHaveLength(100);
    await user.click(mensaje());
    await user.paste('b'.repeat(1200));
    expect(mensaje().value).toHaveLength(1000);
    expect(screen.getByText('1000/1000')).toBeTruthy();
  });

  it('el contador del mensaje, debajo del campo, muestra los caracteres escritos ("120/1000")', async () => {
    const user = renderForm();
    expect(screen.getByText('0/1000')).toBeTruthy();
    await user.click(mensaje());
    await user.paste('x'.repeat(120));
    const contador = screen.getByText('120/1000');
    expect(mensaje().compareDocumentPosition(contador) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el teléfono trae Costa Rica (+506) elegida y se puede elegir otro país', async () => {
    const user = renderForm();
    const pais = screen.getByRole('button', { name: 'País del teléfono: Costa Rica (+506)' });
    expect(pais.textContent).toContain('CR (+506)');
    await user.click(pais);
    await user.type(screen.getByRole('combobox', { name: 'Buscar país' }), 'Estados Unidos');
    await user.click(screen.getByRole('option', { name: /Estados Unidos/ }));
    expect(screen.getByRole('button', { name: /^País del teléfono: Estados Unidos/ }).textContent).toContain('US (+1)');
  });
});

describe('HU-501 criterio 1: revisión al salir de cada campo', () => {
  it('nombre vacío: al pasar al siguiente campo aparece "Este campo es obligatorio." bajo el campo, en rojo', async () => {
    const user = renderForm();
    await user.click(nombre());
    expect(screen.queryByText('Este campo es obligatorio.')).toBeNull();
    await user.tab();
    const error = screen.getByText('Este campo es obligatorio.');
    expect(error.className).toBe('field-error');
    expect(nombre().getAttribute('aria-invalid')).toBe('true');
    expect(nombre().getAttribute('aria-describedby')).toBe(error.id);
    expect(aviso()).toBeNull(); // el aviso de arriba es solo al enviar
  });

  it('correo mal escrito: "Ingrese un correo electrónico válido."; al corregirlo desaparece', async () => {
    const user = renderForm();
    await user.type(correo(), 'ana@example');
    await user.tab();
    expect(screen.getByText('Ingrese un correo electrónico válido.')).toBeTruthy();
    await user.type(correo(), '.com');
    expect(screen.queryByText('Ingrese un correo electrónico válido.')).toBeNull();
    expect(correo().getAttribute('aria-invalid')).toBeNull();
  });

  it('teléfono de Costa Rica con menos de 8 dígitos: "El teléfono debe tener 8 dígitos."', async () => {
    const user = renderForm();
    await user.type(telefono(), '8888123');
    await user.tab();
    expect(screen.getByText('El teléfono debe tener 8 dígitos.')).toBeTruthy();
    expect(telefono().getAttribute('aria-invalid')).toBe('true');
  });

  it('teléfono de otro país: "El teléfono debe tener entre 6 y 14 dígitos."', async () => {
    const user = renderForm();
    await user.type(telefono(), '12345');
    await user.tab();
    expect(screen.getByText('El teléfono debe tener 8 dígitos.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^País del teléfono/ }));
    await user.type(screen.getByRole('combobox', { name: 'Buscar país' }), 'Estados Unidos');
    await user.click(screen.getByRole('option', { name: /Estados Unidos/ }));
    expect(screen.getByText('El teléfono debe tener entre 6 y 14 dígitos.')).toBeTruthy();
  });

  it('el teléfono vacío no da error al salir (es opcional)', async () => {
    const user = renderForm();
    await user.click(telefono());
    await user.tab();
    expect(document.querySelectorAll('.field-error')).toHaveLength(0);
  });

  it('pasar por el selector de país hacia el número no revisa el teléfono todavía', async () => {
    const user = renderForm();
    await user.type(telefono(), '123');
    await user.tab({ shift: true }); // del número al botón de país
    expect(screen.queryByText('El teléfono debe tener 8 dígitos.')).toBeNull();
  });
});

describe('HU-501 criterios 1, 2 y 5: al dar clic en "Enviar"', () => {
  it('con todo vacío no envía y muestra el aviso de arriba y los errores de nombre, correo y productos', async () => {
    const onValido = vi.fn();
    const user = renderForm({ onValido });
    await user.click(enviar());
    expect(onValido).not.toHaveBeenCalled();
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Revise los campos marcados en rojo.');
    const form = screen.getByRole('form', { name: 'Envíenos su consulta' });
    // El aviso va arriba: antes del primer campo.
    expect(alerta.compareDocumentPosition(nombre()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(form).getAllByText('Este campo es obligatorio.')).toHaveLength(2);
    expect(within(form).getByText('Seleccione al menos un producto.')).toBeTruthy();
    expect(nombre().getAttribute('aria-invalid')).toBe('true');
    expect(correo().getAttribute('aria-invalid')).toBe('true');
    expect(telefono().getAttribute('aria-invalid')).toBeNull();
  });

  it('con una cantidad fuera de 1 a 9999 tampoco envía y avisa arriba', async () => {
    const onValido = vi.fn();
    const user = renderForm({
      valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com', intereses: { 'prod-1': '0' } },
      onValido,
    });
    await user.click(enviar());
    expect(onValido).not.toHaveBeenCalled();
    expect(aviso()).toBeTruthy();
  });

  it('con los datos bien, envía los valores y no muestra errores', async () => {
    const onValido = vi.fn();
    const user = renderForm({
      valoresIniciales: { nombre: 'Ana Pérez', correo: 'ana@example.com', intereses: { 'prod-1': '2' } },
      onValido,
    });
    await user.click(enviar());
    expect(onValido).toHaveBeenCalledTimes(1);
    expect(onValido.mock.calls[0][0]).toMatchObject({ nombre: 'Ana Pérez', correo: 'ana@example.com', intereses: { 'prod-1': '2' } });
    expect(aviso()).toBeNull();
    expect(document.querySelectorAll('.field-error')).toHaveLength(0);
  });

  it('un teléfono mal escrito también impide enviar aunque lo demás esté bien', async () => {
    const onValido = vi.fn();
    const user = renderForm({
      valoresIniciales: { nombre: 'Ana', correo: 'ana@example.com', intereses: { 'prod-1': '1' } },
      onValido,
    });
    await user.type(telefono(), '123');
    await user.click(enviar());
    expect(onValido).not.toHaveBeenCalled();
    expect(aviso()).toBeTruthy();
    expect(screen.getByText('El teléfono debe tener 8 dígitos.')).toBeTruthy();
  });

  it('al corregir todo, el aviso de arriba desaparece y se puede enviar', async () => {
    const onValido = vi.fn();
    const user = renderForm({ valoresIniciales: { intereses: { 'prod-1': '1' } }, onValido });
    await user.click(enviar());
    expect(aviso()).toBeTruthy();
    await user.type(nombre(), 'Ana');
    await user.type(correo(), 'ana@example.com');
    expect(aviso()).toBeNull();
    await user.click(enviar());
    expect(onValido).toHaveBeenCalledTimes(1);
  });
});
