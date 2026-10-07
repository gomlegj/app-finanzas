import type { Categoria } from '../domain/categorias';
import { formatearMonto } from '../domain/dinero';
import type { Movimiento } from '../domain/movimientos';
import { BurbujaCategoria } from './BurbujaCategoria';

interface Props {
  movimiento: Movimiento;
  categoria?: Categoria;
  moneda: string;
  onClick?: () => void;
}

export function FilaMovimiento({ movimiento, categoria, moneda, onClick }: Props) {
  const esIngreso = movimiento.tipo === 'ingreso';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
    >
      <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-800">{categoria?.nombre ?? 'Sin categoría'}</span>
        {movimiento.nota && <span className="block truncate text-sm text-slate-500">{movimiento.nota}</span>}
      </span>
      <span className={`font-semibold tabular-nums ${esIngreso ? 'text-emerald-600' : 'text-slate-800'}`}>
        {esIngreso ? '+' : '−'}
        {formatearMonto(movimiento.monto, moneda)}
      </span>
    </button>
  );
}
