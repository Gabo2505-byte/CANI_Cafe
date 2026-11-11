import { useEffect, useState } from 'react';
import { listenFormBadgeCount } from './formBadgesApi';

/**
 * HU-504: cuántos contactos tienen etiqueta ("Nuevo" o "Nuevo mensaje"), en vivo: sube cuando el procesamiento del
 * formulario pone una y baja cuando se abre la ficha. Si no se puede saber, 0 (la barra muestra solo "Contactos").
 */
export function useFormBadgeCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      return listenFormBadgeCount(setCount, () => setCount(0));
    } catch {
      setCount(0);
      return undefined;
    }
  }, []);

  return count;
}

/** HU-504: "Contactos (2)". Sin contactos con etiqueta, solo "Contactos". */
export function contactsNavLabel(label: string, badged: number): string {
  return badged > 0 ? `${label} (${badged})` : label;
}
