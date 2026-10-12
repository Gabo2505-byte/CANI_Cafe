import { useMemo } from 'react';
import { getPhoneCountries } from './phone';

interface PhoneFieldProps {
  id: string;
  country: string;
  number: string;
  onCountryChange: (country: string) => void;
  onNumberChange: (number: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * HU-202: teléfono en dos partes. Primero el país (con su código) y después el número.
 * Se reutiliza en "Nuevo contacto" y "Editar contacto".
 */
export function PhoneField({ id, country, number, onCountryChange, onNumberChange, invalid, describedBy }: PhoneFieldProps) {
  const countries = useMemo(getPhoneCountries, []);

  return (
    <div className="phone-field">
      <select
        id={`${id}-country`}
        aria-label="País del teléfono"
        value={country}
        onChange={(e) => onCountryChange(e.target.value)}
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        autoComplete="off"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}
