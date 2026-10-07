import { NavLink } from 'react-router';
import { House, ListOrdered, Plus } from 'lucide-react';

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`;

export function BottomNav({ onAgregar }: { onAgregar: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end border-t border-slate-200 bg-white px-6 pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" end className={claseEnlace}>
        <House size={22} />
        Inicio
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onAgregar}
          aria-label="Registrar movimiento"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition active:scale-95"
        >
          <Plus size={28} />
        </button>
      </div>
      <NavLink to="/movimientos" className={claseEnlace}>
        <ListOrdered size={22} />
        Movimientos
      </NavLink>
    </nav>
  );
}
