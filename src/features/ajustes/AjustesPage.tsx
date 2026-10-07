import { Link } from 'react-router';
import { ChevronRight, LogOut, Tags, UserRound } from 'lucide-react';
import { useToast } from '../../components/toastContexto';
import { salir } from '../auth/acciones';
import { useUsuario } from '../auth/contexto';

export function AjustesPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        {usuario.photoURL ? (
          <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound size={22} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{usuario.displayName ?? 'Sin nombre'}</p>
          <p className="truncate text-sm text-slate-500">{usuario.email}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-1 shadow-sm">
        <Link to="/ajustes/categorias" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <Tags size={20} className="text-emerald-600" />
          <span className="flex-1 font-medium text-slate-800">Categorías</span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => salir().catch(() => mostrar('No se pudo cerrar sesión', 'error'))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-4 font-medium text-rose-600 shadow-sm hover:bg-rose-50"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  );
}
