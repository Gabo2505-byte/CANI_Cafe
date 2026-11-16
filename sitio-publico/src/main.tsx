import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Fuentes empaquetadas (sin depender de internet), las mismas de la web oficial de CANI Café: Cinzel en títulos,
// Montserrat en el texto y Playfair Display en cursiva para los subtítulos. Solo los pesos que usa el sitio.
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '../../src/shared/styles/tokens.css';
import './publico.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
