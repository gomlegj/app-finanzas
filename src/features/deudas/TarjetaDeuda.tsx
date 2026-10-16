import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { COLOR_DEUDA, cuotasEstimadas, ICONO_TIPO_DEUDA, type Deuda } from '../../domain/deudas';
import { formatearMonto } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';

interface Props {
  deuda: Deuda;
  saldo: number;
  pagadoEnQuincena: number;
  proximoPago: string;
  moneda: string;
  /** Falló la carga de pagos: no se muestran ni se permiten acciones sobre el saldo. */
  sinDatos: boolean;
  onPagar: () => void;
  onActualizarSaldo: () => void;
  onEditar: () => void;
  onArchivar: () => void;
}

export function TarjetaDeuda({
  deuda,
  saldo,
  pagadoEnQuincena,
  proximoPago,
  moneda,
  sinDatos,
  onPagar,
  onActualizarSaldo,
  onEditar,
  onArchivar,
}: Props) {
  const pagada = !sinDatos && saldo === 0;
  const cuotas = cuotasEstimadas(deuda, saldo);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <button type="button" onClick={onEditar} className="flex w-full items-center gap-3 text-left">
        <BurbujaCategoria icono={ICONO_TIPO_DEUDA[deuda.tipo]} color={COLOR_DEUDA} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{deuda.nombre}</span>
          <span className="block text-sm text-slate-500">
            Cuota {formatearMonto(deuda.cuota, moneda)} · día {deuda.diaPago} · próximo pago {fechaCorta(proximoPago)}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-bold tabular-nums text-slate-900">
            {sinDatos ? '—' : formatearMonto(saldo, moneda)}
          </span>
          {!sinDatos && cuotas > 0 && (
            <span className="block text-xs text-slate-500">≈ {cuotas} {cuotas === 1 ? 'cuota' : 'cuotas'}</span>
          )}
        </span>
      </button>

      {sinDatos && <p className="mt-2 text-sm text-rose-700">No se pudo calcular tu saldo</p>}
      {pagada && <p className="mt-2 text-sm font-medium text-emerald-700">🎉 ¡Pagada!</p>}
      {!sinDatos && pagadoEnQuincena > 0 && !pagada && (
        <p className="mt-2 text-sm font-medium text-emerald-700">
          ✓ Pagaste {formatearMonto(pagadoEnQuincena, moneda)} esta quincena
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {pagada ? (
          <button type="button" onClick={onArchivar} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700">
            Archivar
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={sinDatos}
              onClick={onPagar}
              className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Pagar cuota
            </button>
            <button
              type="button"
              disabled={sinDatos}
              onClick={onActualizarSaldo}
              className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Actualizar saldo
            </button>
          </>
        )}
      </div>
    </article>
  );
}
