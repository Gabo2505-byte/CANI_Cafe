import { useEffect, useRef, useState } from 'react';

/**
 * Lleva el foco (y la vista) al primer campo con error de un formulario: el primero, en el orden de la pantalla, que
 * tenga `aria-invalid="true"`. Hay que llamarlo cuando ya se pintaron los errores.
 */
export function focusFirstInvalid(container: HTMLElement | null): boolean {
  const target = container?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!target) return false;
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: 'center' });
  return true;
}

/**
 * Para formularios con validación: `formRef` va en el `<form>` y `focusFirstError()` se llama en el mismo manejador que
 * guarda los errores (por ejemplo, justo antes del `return` cuando hay errores). El foco se mueve después de pintarlos,
 * así que el campo ya tiene su mensaje y su `aria-invalid`.
 */
export function useFocusFirstError() {
  const formRef = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt > 0) focusFirstInvalid(formRef.current);
  }, [attempt]);

  return { formRef, focusFirstError: () => setAttempt((n) => n + 1) };
}
