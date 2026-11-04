import { describe, expect, it } from 'vitest';
import {
  CONTACT_MESSAGES,
  contactToFormValues,
  duplicateErrors,
  EMPTY_CONTACT_FORM,
  isValidEmail,
  isContactEditDirty,
  isContactFormDirty,
  normalizePhone,
  toNewContactInput,
  validateContactForm,
} from '../../src/contacts/contactForm';

const form = (values: Partial<typeof EMPTY_CONTACT_FORM>) => ({ ...EMPTY_CONTACT_FORM, ...values });

describe('HU-201 validación del formulario de contacto', () => {
  it('el nombre completo es obligatorio', () => {
    expect(validateContactForm(form({ email: 'a@example.com' }))).toEqual({
      fullName: CONTACT_MESSAGES.fullNameRequired,
    });
    expect(validateContactForm(form({ fullName: '   ', email: 'a@example.com' })).fullName).toBeDefined();
  });

  it('pide al menos correo o teléfono', () => {
    expect(validateContactForm(form({ fullName: 'Ana' }))).toEqual({
      emailOrPhone: CONTACT_MESSAGES.emailOrPhoneRequired,
    });
  });

  it('con solo correo, o solo teléfono, es válido; la dirección es opcional', () => {
    expect(validateContactForm(form({ fullName: 'Ana', email: 'a@example.com' }))).toEqual({});
    expect(validateContactForm(form({ fullName: 'Ana', phone: '0000 0001' }))).toEqual({});
  });

  it('un teléfono sin dígitos no cuenta', () => {
    expect(validateContactForm(form({ fullName: 'Ana', phone: '- -' })).emailOrPhone).toBeDefined();
  });

  it('HU-202: si se escribe un teléfono, se valida su largo aunque haya correo', () => {
    expect(validateContactForm(form({ fullName: 'Ana', email: 'a@example.com', phone: '123' }))).toEqual({
      phone: 'El teléfono debe tener 8 dígitos.',
    });
    expect(
      validateContactForm(form({ fullName: 'Ana', phoneCountry: 'US', phone: '123' })),
    ).toEqual({ phone: 'El teléfono debe tener entre 6 y 14 dígitos.' });
  });

  it('HU-202: guarda el país elegido junto al número', () => {
    expect(toNewContactInput(form({ fullName: 'Ana', phoneCountry: 'US', phone: '(305) 555-1234' }))).toMatchObject({
      phoneCountry: 'US',
      phoneNumber: '3055551234',
    });
  });
});

describe('HU-203 validaciones', () => {
  it('textos exactos', () => {
    expect(CONTACT_MESSAGES.invalidEmail).toBe('Ingrese un correo electrónico válido.');
    expect(CONTACT_MESSAGES.duplicateEmail).toBe('Ya existe un contacto con este correo electrónico.');
    expect(CONTACT_MESSAGES.duplicatePhone).toBe('Ya existe un contacto con este teléfono.');
    expect(CONTACT_MESSAGES.viewContact).toBe('Ver contacto');
  });

  it('formato de correo nombre@dominio.com, sin espacios', () => {
    expect(isValidEmail('nombre@dominio.com')).toBe(true);
    expect(isValidEmail('n.a+x@sub.dominio.cr')).toBe(true);
    for (const bad of ['nombre', 'nombre@dominio', 'nom bre@dominio.com', 'nombre@do minio.com', '@dominio.com', 'a@@b.com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });

  it('largos máximos: nombre y correo 100, dirección 250', () => {
    const errors = validateContactForm(
      form({ fullName: 'n'.repeat(101), email: `${'e'.repeat(95)}@x.com`, address: 'd'.repeat(251) }),
    );
    expect(errors.fullName).toBe(CONTACT_MESSAGES.fullNameTooLong);
    expect(errors.email).toBe(CONTACT_MESSAGES.emailTooLong);
    expect(errors.address).toBe(CONTACT_MESSAGES.addressTooLong);
    expect(
      validateContactForm(form({ fullName: 'n'.repeat(100), email: 'a@b.co', address: 'd'.repeat(250) })),
    ).toEqual({});
  });

  it('duplicateErrors arma los mensajes de repetido', () => {
    expect(duplicateErrors({ email: 'x', phone: 'y' })).toEqual({
      email: CONTACT_MESSAGES.duplicateEmail,
      phone: CONTACT_MESSAGES.duplicatePhone,
    });
    expect(duplicateErrors({})).toEqual({});
  });

  it('el correo se guarda en minúsculas y sin espacios alrededor', () => {
    expect(toNewContactInput(form({ fullName: 'A', email: '  Ana@Example.COM ' })).email).toBe('ana@example.com');
  });
});

describe('isContactFormDirty', () => {
  it('detecta si se escribió algo', () => {
    expect(isContactFormDirty(EMPTY_CONTACT_FORM)).toBe(false);
    expect(isContactFormDirty(form({ address: '  ' }))).toBe(false);
    expect(isContactFormDirty(form({ address: 'x' }))).toBe(true);
  });
});

describe('toNewContactInput', () => {
  it('guarda null en lo no llenado y el teléfono como dígitos de Costa Rica', () => {
    expect(toNewContactInput(form({ fullName: ' Ana Prueba ', phone: '0000-0001' }))).toEqual({
      fullName: 'Ana Prueba',
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '00000001',
      address: null,
    });
    expect(toNewContactInput(form({ fullName: 'Ana', email: ' a@example.com ', address: 'San José' }))).toEqual({
      fullName: 'Ana',
      email: 'a@example.com',
      phoneCountry: null,
      phoneNumber: null,
      address: 'San José',
    });
  });

  it('normalizePhone deja solo dígitos', () => {
    expect(normalizePhone('+506 0000-0001')).toBe('50600000001');
    expect(normalizePhone('0000 0001')).toBe('00000001');
  });
});

describe('HU-210 editar un contacto', () => {
  const stored = {
    fullName: 'Ana Prueba Mora',
    email: 'ana.prueba@example.com',
    phoneCountry: 'CR',
    phoneNumber: '00000001',
    address: 'San José',
  };

  it('textos literales de los criterios', () => {
    expect(CONTACT_MESSAGES.edited).toBe('Cambios guardados correctamente.');
    expect(CONTACT_MESSAGES.editLeaveConfirm).toBe('¿Desea salir sin guardar? Los cambios se perderán.');
    expect(CONTACT_MESSAGES.duplicateEmail).toBe('Ya existe un contacto con este correo electrónico.');
    expect(CONTACT_MESSAGES.duplicatePhone).toBe('Ya existe un contacto con este teléfono.');
  });

  it('el formulario empieza con los datos actuales; lo vacío queda vacío y el país por defecto es Costa Rica', () => {
    expect(contactToFormValues(stored)).toEqual({
      fullName: 'Ana Prueba Mora',
      email: 'ana.prueba@example.com',
      phoneCountry: 'CR',
      phone: '00000001',
      address: 'San José',
    });
    expect(contactToFormValues({ ...stored, email: null, phoneCountry: null, phoneNumber: null, address: null })).toEqual({
      fullName: 'Ana Prueba Mora',
      email: '',
      phoneCountry: 'CR',
      phone: '',
      address: '',
    });
    expect(contactToFormValues({ ...stored, phoneCountry: 'US', phoneNumber: '3055550104' }).phoneCountry).toBe('US');
  });

  it('sin cambios no está modificado (aunque se agreguen espacios o mayúsculas en el correo)', () => {
    const initial = contactToFormValues(stored);
    expect(isContactEditDirty(initial, initial)).toBe(false);
    expect(isContactEditDirty({ ...initial, fullName: ' Ana Prueba Mora ', email: 'ANA.PRUEBA@example.com' }, initial)).toBe(false);
  });

  it('cambiar el nombre, el correo, el teléfono, su país o la dirección sí es un cambio', () => {
    const initial = contactToFormValues(stored);
    expect(isContactEditDirty({ ...initial, fullName: 'Ana Mora' }, initial)).toBe(true);
    expect(isContactEditDirty({ ...initial, email: 'otra@example.com' }, initial)).toBe(true);
    expect(isContactEditDirty({ ...initial, phone: '00000009' }, initial)).toBe(true);
    expect(isContactEditDirty({ ...initial, phoneCountry: 'US' }, initial)).toBe(true);
    expect(isContactEditDirty({ ...initial, address: '' }, initial)).toBe(true);
  });

  it('cambiar el país sin teléfono no es un cambio', () => {
    const initial = contactToFormValues({ ...stored, phoneCountry: null, phoneNumber: null });
    expect(isContactEditDirty({ ...initial, phoneCountry: 'US' }, initial)).toBe(false);
  });
});
