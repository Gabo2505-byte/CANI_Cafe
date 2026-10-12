import { CountryPicker } from './CountryPicker';

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
 * HU-202: teléfono en dos partes. Primero el país (lista con buscador, agrupada por letras)
 * y después el número. Se reutiliza en "Nuevo contacto" y "Editar contacto".
 */
export function PhoneField({ id, country, number, onCountryChange, onNumberChange, invalid, describedBy }: PhoneFieldProps) {
  return (
    <div className="phone-field">
      <CountryPicker value={country} onChange={onCountryChange} />
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
