import type { ReactNode } from 'react';

/**
 * Texto de un botón de "agregar" con un "+" decorativo delante: se ve "+ Nuevo registro", pero el nombre accesible es
 * solo el texto ("Nuevo registro"). El "+" va en un span con aria-hidden y no en un ::before de CSS, porque los
 * navegadores sí incluyen el contenido de ::before en el nombre accesible.
 */
export function AddButtonLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="button-plus" aria-hidden="true">
        +
      </span>
      {children}
    </>
  );
}
