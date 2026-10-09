import { Outlet } from 'react-router';
import { TopBar } from './TopBar';

/** Marco de las pantallas internas: barra superior + contenido. */
export function AppLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}
