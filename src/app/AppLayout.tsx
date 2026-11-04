import { Outlet } from 'react-router';
import { useFormRequestProcessor } from '../formRequests/useFormRequestProcessor';
import { TopBar } from './TopBar';

/** Marco de las pantallas internas: barra superior + contenido. */
export function AppLayout() {
  // HU-502 y HU-503: con la sesión abierta, las solicitudes del formulario del sitio web se procesan solas.
  useFormRequestProcessor();
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}
