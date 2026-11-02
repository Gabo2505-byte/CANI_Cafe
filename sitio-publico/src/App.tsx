import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PublicLayout } from './components/PublicLayout';
import { CatalogoPage } from './pages/CatalogoPage';
import { ContactenosPage } from './pages/ContactenosPage';
import { InicioPage } from './pages/InicioPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<InicioPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/contactenos" element={<ContactenosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
