import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Fuentes empaquetadas (sin depender de internet): solo los pesos que usa el sitio público.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/cormorant-garamond/600.css';
import '../../src/shared/styles/tokens.css';
import './publico.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
