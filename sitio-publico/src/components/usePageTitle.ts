import { useEffect } from 'react';

/** Título de la pestaña de cada página ("CANI Café | Inicio", etc.). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
