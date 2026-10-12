import { describe, expect, it } from 'vitest';
import {
  CONTACT_MESSAGES,
  EMPTY_CONTACT_FORM,
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
