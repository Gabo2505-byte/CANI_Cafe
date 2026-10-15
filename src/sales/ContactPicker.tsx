import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { Contact } from '../shared/types';
import { canSearchContacts, CONTACT_SEARCH_MESSAGES, searchContacts } from './contactSearch';
import { listActiveContacts } from './contactSearchApi';

interface ContactPickerProps {
  id: string;
  /** Contacto elegido (null mientras no se elige ninguno). */
  selected: Contact | null;
  onSelect: (contact: Contact | null) => void;
  /** Desde la ficha de un contacto: viene elegido y no se puede cambiar (HU-302, criterio 3). */
  fixedContact?: Contact;
  /** Error del campo, calculado por el formulario al guardar. */
  error?: string;
}

/**
 * HU-302: elegir el contacto de una posible venta. Se escriben al menos 2 letras del nombre o del
 * correo y aparece una lista con hasta 10 contactos activos que coinciden.
 */
export function ContactPicker({ id, selected, onSelect, fixedContact, error }: ContactPickerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState(selected?.fullName ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (fixedContact) return;
    let cancelled = false;
    listActiveContacts().then(
      (list) => {
        if (cancelled) return;
        setContacts(list);
        setLoaded(true);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fixedContact]);

  const results = useMemo(() => searchContacts(contacts, text), [contacts, text]);

  if (fixedContact) {
    return (
      <input
        id={id}
        value={fixedContact.fullName}
        readOnly
        aria-readonly="true"
        className="contact-picker-fixed"
      />
    );
  }

  const showList = open && !selected && canSearchContacts(text);

  function choose(contact: Contact) {
    setText(contact.fullName);
    setOpen(false);
    onSelect(contact);
  }

  function handleChange(value: string) {
    setText(value);
    setOpen(true);
    setActiveIndex(0);
    // Escribir de nuevo deshace la elección anterior.
    if (selected) onSelect(null);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!showList) return;
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  return (
    <div className="contact-picker">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results.length > 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder="Escriba al menos 2 letras del nombre o del correo"
      />
      {showList && (
        <ul id={listId} role="listbox" className="contact-picker-list">
          {results.map((contact, index) => (
            <li
              key={contact.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'contact-picker-option active' : 'contact-picker-option'}
              // mouseDown (y no click) para elegir antes de que el campo pierda el foco.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(contact);
              }}
            >
              <span>{contact.fullName}</span>
              {contact.email && <span className="contact-picker-email">{contact.email}</span>}
            </li>
          ))}
          {results.length === 0 && loaded && (
            <li className="contact-picker-empty">{CONTACT_SEARCH_MESSAGES.noResults}</li>
          )}
        </ul>
      )}
      {loadFailed && (
        <p className="field-error" role="alert">
          {CONTACT_SEARCH_MESSAGES.loadError}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
