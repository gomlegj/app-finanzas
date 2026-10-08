import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AjustesPage } from './features/ajustes/AjustesPage';
import { CategoriasPage } from './features/ajustes/CategoriasPage';
import { QuincenasPage } from './features/ajustes/QuincenasPage';
import { LoginPage } from './features/auth/LoginPage';
import { useAuth } from './features/auth/contexto';
import { InicioPage } from './features/inicio/InicioPage';
import { MovimientosPage } from './features/movimientos/MovimientosPage';

export default function App() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="flex min-h-dvh animate-pulse items-center justify-center text-5xl">🐷</div>;
  }
  if (!usuario) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<InicioPage />} />
        <Route path="movimientos" element={<MovimientosPage />} />
        <Route path="ajustes" element={<AjustesPage />} />
        <Route path="ajustes/quincenas" element={<QuincenasPage />} />
        <Route path="ajustes/categorias" element={<CategoriasPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
