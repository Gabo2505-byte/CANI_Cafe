import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterCountries, getPhoneCountries, groupCountriesByLetter, type PhoneCountryOption } from './phone';

interface CountryPickerProps {
  value: string;
  onChange: (country: string) => void;
}

/**
 * Lista de países del teléfono con buscador y agrupada por letras.
 * Cerrada muestra las siglas y el código (ej. "CR (+506)"); abierta, el nombre completo con su código.
 * Teclado: ↑/↓ para moverse, Enter para elegir, Escape para cerrar.
 */
export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCode, setActiveCode] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const countries = useMemo(getPhoneCountries, []);
  const selected = countries.find((c) => c.code === value);
  const filtered = useMemo(() => filterCountries(countries, query), [countries, query]);
  // Sin búsqueda: agrupado por letras. Con búsqueda: un solo grupo, ordenado por relevancia.
  const groups = useMemo(
    () =>
      query.trim()
        ? filtered.length > 0
          ? [{ label: 'Resultados', countries: filtered }]
          : []
        : groupCountriesByLetter(filtered),
    [filtered, query],
  );
  const optionId = (code: string) => `${listId}-${code}`;

  /** Desplaza solo la lista (no la página) para que la opción quede a la vista, debajo del título del grupo. */
  function revealOption(code: string, center = false) {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[id="${optionId(code)}"]`);
    if (!list || !option) return;
    const header = list.querySelector<HTMLElement>('.country-picker-group')?.offsetHeight ?? 0;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (center) list.scrollTop = top - list.clientHeight / 2 + option.offsetHeight / 2;
    else if (top - header < list.scrollTop) list.scrollTop = top - header;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  // Al abrir: buscador enfocado (sin mover la página) y el país elegido visible.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    revealOption(value, true);
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Al filtrar, la primera coincidencia queda marcada.
  useEffect(() => {
    if (open && !filtered.some((c) => c.code === activeCode)) setActiveCode(filtered[0]?.code ?? '');
  }, [open, filtered, activeCode]);

  useEffect(() => {
    if (open) revealOption(activeCode);
  }, [activeCode]);

  function openList() {
    setQuery('');
    setActiveCode(value);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(country: PhoneCountryOption) {
    onChange(country.code);
    close();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const index = filtered.findIndex((c) => c.code === activeCode);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = filtered[Math.min(Math.max(index + step, 0), filtered.length - 1)];
      if (next) setActiveCode(next.code);
    } else if (event.key === 'Enter') {
      event.preventDefault(); // no enviar el formulario
      const current = filtered[index];
      if (current) choose(current);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="country-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="country-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`País del teléfono: ${selected?.label ?? value}`}
        title={selected?.label}
        onClick={() => (open ? close() : openList())}
      >
        <span>
          {value} ({selected?.dialCode})
        </span>
        <span aria-hidden="true" className="country-picker-caret">
          ▾
        </span>
      </button>

      {open && (
        <div className="country-picker-popup">
          <input
            ref={searchRef}
            type="search"
            className="country-picker-search"
            placeholder="Buscar país o código"
            aria-label="Buscar país"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeCode ? optionId(activeCode) : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <div ref={listRef} id={listId} role="listbox" aria-label="Países" className="country-picker-list">
            {groups.length === 0 && <p className="country-picker-empty">No se encontraron países.</p>}
            {groups.map((group) => (
              <div key={group.label} role="group" aria-labelledby={`${listId}-g-${group.label}`}>
                <div id={`${listId}-g-${group.label}`} className="country-picker-group" aria-hidden="true">
                  {group.label}
                </div>
                {group.countries.map((country) => (
                  <div
                    key={country.code}
                    id={optionId(country.code)}
                    role="option"
                    aria-selected={country.code === value}
                    className={[
                      'country-picker-option',
                      country.code === activeCode ? 'active' : '',
                      country.code === value ? 'selected' : '',
                    ].join(' ')}
                    onMouseEnter={() => setActiveCode(country.code)}
                    onClick={() => choose(country)}
                  >
                    {country.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
