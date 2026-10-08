import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { GraficaDona } from '../../components/GraficaDona';
import type { Categoria } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Movimiento } from '../../domain/movimientos';
import { gastoPorCategoria } from '../../domain/presupuesto';

interface Props {
  movimientos: readonly Movimiento[];
  categorias: ReadonlyMap<string, Categoria>;
  moneda: string;
}

export function GastoPorCategoria({ movimientos, categorias, moneda }: Props) {
  const gastos = gastoPorCategoria(movimientos);
  const total = gastos.reduce((suma, g) => suma + g.total, 0);

  if (gastos.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">Sin gastos en esta quincena.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <GraficaDona
        segmentos={gastos.map((g) => ({
          id: g.categoriaId,
          valor: g.total,
          color: categorias.get(g.categoriaId)?.color ?? '#94a3b8',
          etiqueta: categorias.get(g.categoriaId)?.nombre ?? 'Sin categoría',
        }))}
        centro={formatearMonto(total, moneda)}
        subcentro="gastado"
      />
      <ul className="w-full space-y-1">
        {gastos.map((g) => {
          const categoria = categorias.get(g.categoriaId);
          return (
            <li key={g.categoriaId} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{categoria?.nombre ?? 'Sin categoría'}</span>
              <span className="text-sm tabular-nums text-slate-400">{Math.round(g.porcentaje)}%</span>
              <span className="w-28 text-right font-semibold tabular-nums text-slate-800">{formatearMonto(g.total, moneda)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
