import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { formatearMonto } from '../../domain/dinero';
import { fechaConAnio } from '../../domain/fechas';
import { cumplida, progreso, type Meta } from '../../domain/metas';

interface Props {
  meta: Meta;
  ahorrado: number;
  cuota: number;
  abonadoEnQuincena: number;
  fechaEstimada: string | null;
  moneda: string;
  /** Sin datos confiables de lo ahorrado (falló la carga): no se permite abonar ni retirar. */
  sinDatos: boolean;
  onAbonar: () => void;
  onRetirar: () => void;
  onEditar: () => void;
}

export function TarjetaMeta({
  meta,
  ahorrado,
  cuota,
  abonadoEnQuincena,
  fechaEstimada,
  moneda,
  sinDatos,
  onAbonar,
  onRetirar,
  onEditar,
}: Props) {
  const lista = cumplida(meta, ahorrado);
  const porcentaje = progreso(meta, ahorrado);
  const detalle = lista
    ? '🎉 ¡Lo lograste!'
    : meta.modo === 'cuota'
      ? `Cuota: ${formatearMonto(meta.cuotaQuincenal ?? 0, moneda)} por quincena${
          fechaEstimada ? ` · llegas aprox. el ${fechaConAnio(fechaEstimada)}` : ''
        }`
      : `Meta: ${fechaConAnio(meta.fechaObjetivo ?? '')} · cuota ${formatearMonto(cuota, moneda)} por quincena`;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <button type="button" onClick={onEditar} className="flex w-full items-center gap-3 text-left">
        <BurbujaCategoria icono={meta.icono} color={meta.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{meta.nombre}</span>
          <span className="block text-sm text-slate-500">
            {sinDatos
              ? 'No se pudo calcular tu progreso'
              : `${formatearMonto(Math.max(0, ahorrado), moneda)} de ${formatearMonto(meta.objetivo, moneda)} (${porcentaje} %)`}
          </span>
        </span>
      </button>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${sinDatos ? 0 : porcentaje}%`, backgroundColor: meta.color }} />
      </div>
      {!sinDatos && <p className="mt-2 text-sm text-slate-600">{detalle}</p>}
      {!sinDatos && abonadoEnQuincena > 0 && (
        <p className="text-sm font-medium text-emerald-700">✓ Abonaste {formatearMonto(abonadoEnQuincena, moneda)} esta quincena</p>
      )}

      <div className="mt-3 flex gap-2">
        {!lista && (
          <button
            type="button"
            disabled={sinDatos}
            onClick={onAbonar}
            className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Abonar
          </button>
        )}
        {ahorrado > 0 && (
          <button
            type="button"
            disabled={sinDatos}
            onClick={onRetirar}
            className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Retirar
          </button>
        )}
      </div>
    </article>
  );
}
