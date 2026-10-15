import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import type { Categoria } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Pendiente } from '../../domain/fijos';

interface Props {
  pendientes: readonly Pendiente[];
  categorias: ReadonlyMap<string, Categoria>;
  moneda: string;
  cargando: boolean;
  error: boolean;
  onPagar: (pendiente: Pendiente) => void;
  onAbrirPago: (movimientoId: string) => void;
}

export function PendientesQuincena({ pendientes, categorias, moneda, cargando, error, onPagar, onAbrirPago }: Props) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-slate-900">Pendientes de esta quincena</h2>
      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus pendientes.
        </p>
      ) : cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
          Nada pendiente en esta quincena. Agrega{' '}
          <Link to="/ajustes/fijos" className="font-medium text-emerald-600">
            gastos fijos
          </Link>{' '}
          o crea una{' '}
          <Link to="/metas" className="font-medium text-emerald-600">
            meta
          </Link>
          .
        </div>
      ) : (
        <ul className="rounded-2xl bg-white p-1 shadow-sm">
          {pendientes.map((p) => {
            const categoria = categorias.get(p.categoriaId);
            const burbuja = (
              <BurbujaCategoria icono={p.icono ?? categoria?.icono ?? '❔'} color={p.color ?? categoria?.color ?? '#94a3b8'} />
            );
            const { pagado } = p;
            return (
              <li key={p.origen.id}>
                {pagado ? (
                  <button
                    type="button"
                    onClick={() => onAbrirPago(pagado.movimientos[0])}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
                  >
                    {burbuja}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-medium text-slate-500">
                        <Check size={16} className="shrink-0 text-emerald-600" aria-label="Pagado" />
                        <span className="truncate">{p.nombre}</span>
                      </span>
                      <Diferencia planeado={p.planeado} real={pagado.monto} moneda={moneda} />
                    </span>
                    <span className="font-semibold tabular-nums text-slate-500">{formatearMonto(pagado.monto, moneda)}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2.5">
                    {burbuja}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{p.nombre}</span>
                      <span className="block text-sm tabular-nums text-slate-500">{formatearMonto(p.planeado, moneda)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onPagar(p)}
                      className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {p.origen.tipo === 'meta' ? 'Abonar' : 'Pagado'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Diferencia({ planeado, real, moneda }: { planeado: number; real: number; moneda: string }) {
  const diferencia = real - planeado;
  if (diferencia === 0) return null;
  const deMas = diferencia > 0;
  return (
    <span className={`block text-sm tabular-nums ${deMas ? 'text-amber-600' : 'text-emerald-600'}`}>
      {deMas ? '+' : '−'}
      {formatearMonto(Math.abs(diferencia), moneda)} vs. planeado
    </span>
  );
}
