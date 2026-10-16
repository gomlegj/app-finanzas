import { useState } from 'react';
import { ArchiveRestore, ChevronDown } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { useToast } from '../../components/toastContexto';
import { archivarDeuda } from '../../data/deudas';
import { useDeudas, useMovimientosDeDeudas, usePerfil } from '../../data/hooks';
import {
  COLOR_DEUDA,
  ICONO_TIPO_DEUDA,
  pagadoEnQuincena,
  proximoPago,
  saldo,
  sugerenciaDePago,
  type Deuda,
} from '../../domain/deudas';
import { formatearMonto } from '../../domain/dinero';
import { DIAS_PAGO_POR_DEFECTO, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido, type Prellenado } from '../movimientos/RegistroRapido';
import { ActualizarSaldo } from './ActualizarSaldo';
import { FormularioDeuda } from './FormularioDeuda';
import { prellenadoPagoDeuda } from './prellenados';
import { TarjetaDeuda } from './TarjetaDeuda';

const porNombre = (a: Deuda, b: Deuda) => a.nombre.localeCompare(b.nombre, 'es');

type Hoja = { tipo: 'editar'; deuda?: Deuda } | { tipo: 'saldo'; deuda: Deuda; saldo: number } | null;

export function DeudasPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: perfil } = usePerfil(usuario.uid);
  const deudas = useDeudas(usuario.uid);
  const pagos = useMovimientosDeDeudas(usuario.uid);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [registro, setRegistro] = useState<Prellenado | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);

  const moneda = perfil?.moneda ?? 'COP';
  const quincena = quincenaDe(new Date(), perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO);
  const activas = deudas.datos.filter((d) => !d.archivada).sort(porNombre);
  const archivadas = deudas.datos.filter((d) => d.archivada).sort(porNombre);
  const total = activas.reduce((s, d) => s + saldo(d, pagos.datos), 0);

  function archivar(deuda: Deuda, archivada: boolean) {
    archivarDeuda(usuario.uid, deuda.id, archivada).catch(() => mostrar('No se pudo guardar la deuda', 'error'));
    mostrar(archivada ? 'Deuda archivada' : 'Deuda restaurada');
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Deudas</h2>

      {deudas.error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus deudas. Revisa tu conexión.
        </p>
      ) : deudas.cargando || pagos.cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : activas.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">No tienes deudas registradas. 🐿️</div>
      ) : (
        <>
          {!pagos.error && (
            <section className="rounded-2xl bg-slate-800 p-4 text-white">
              <p className="text-sm opacity-80">Debes en total</p>
              <p className="text-2xl font-bold tabular-nums">{formatearMonto(total, moneda)}</p>
            </section>
          )}
          {activas.map((d) => {
            const actual = saldo(d, pagos.datos);
            const pagado = pagadoEnQuincena(d, pagos.datos, quincena);
            return (
              <TarjetaDeuda
                key={d.id}
                deuda={d}
                saldo={actual}
                pagadoEnQuincena={pagado}
                proximoPago={proximoPago(d)}
                moneda={moneda}
                sinDatos={pagos.error}
                onPagar={() => setRegistro(prellenadoPagoDeuda(d, sugerenciaDePago(d, actual, pagado), actual, moneda))}
                onActualizarSaldo={() => setHoja({ tipo: 'saldo', deuda: d, saldo: actual })}
                onEditar={() => setHoja({ tipo: 'editar', deuda: d })}
                onArchivar={() => archivar(d, true)}
              />
            );
          })}
        </>
      )}

      <button
        type="button"
        onClick={() => setHoja({ tipo: 'editar' })}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nueva deuda
      </button>

      {archivadas.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setVerArchivadas((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1 text-sm font-medium text-slate-500"
          >
            Archivadas ({archivadas.length})
            <ChevronDown size={16} className={verArchivadas ? 'rotate-180' : ''} />
          </button>
          {verArchivadas && (
            <ul className="rounded-2xl bg-white p-1 shadow-sm">
              {archivadas.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-2 py-2.5">
                  <BurbujaCategoria icono={ICONO_TIPO_DEUDA[d.tipo]} color={COLOR_DEUDA} />
                  <span className="flex-1 text-slate-500">{d.nombre}</span>
                  <button
                    type="button"
                    onClick={() => archivar(d, false)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    <ArchiveRestore size={16} />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HojaInferior
        abierta={hoja !== null}
        titulo={hoja?.tipo === 'saldo' ? 'Actualizar saldo' : hoja?.deuda ? 'Editar deuda' : 'Nueva deuda'}
        onCerrar={() => setHoja(null)}
      >
        {hoja?.tipo === 'editar' && (
          <FormularioDeuda key={hoja.deuda?.id ?? 'nueva'} deuda={hoja.deuda} onListo={() => setHoja(null)} />
        )}
        {hoja?.tipo === 'saldo' && (
          <ActualizarSaldo key={hoja.deuda.id} deuda={hoja.deuda} saldoActual={hoja.saldo} onListo={() => setHoja(null)} />
        )}
      </HojaInferior>

      <RegistroRapido abierta={registro !== null} prellenado={registro ?? undefined} onCerrar={() => setRegistro(null)} />
    </div>
  );
}
