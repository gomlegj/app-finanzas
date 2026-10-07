import { useCallback, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { CloudOff, UserRound } from 'lucide-react';
import { useUsuario } from '../features/auth/contexto';
import { RegistroRapido } from '../features/movimientos/RegistroRapido';
import { useEnLinea } from '../lib/useEnLinea';
import { BottomNav } from './BottomNav';

export function Layout() {
  const usuario = useUsuario();
  const enLinea = useEnLinea();
  const [registroAbierto, setRegistroAbierto] = useState(false);
  const cerrarRegistro = useCallback(() => setRegistroAbierto(false), []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-50/90 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-bold text-slate-900">Mis finanzas</h1>
        <div className="flex items-center gap-2">
          {!enLinea && (
            <span
              title="Sin conexión: tus cambios se guardan y se sincronizan después"
              className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              <CloudOff size={14} />
              Sin conexión
            </span>
          )}
          <Link to="/ajustes" aria-label="Ajustes">
            {usuario.photoURL ? (
              <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <UserRound size={18} />
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-5 pb-28">
        <Outlet />
      </main>
      <BottomNav onAgregar={() => setRegistroAbierto(true)} />
      <RegistroRapido abierta={registroAbierto} onCerrar={cerrarRegistro} />
    </div>
  );
}
