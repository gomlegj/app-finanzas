import { useState } from 'react';
import { Link } from 'react-router';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import {
  useCategorias,
  useDeudas,
  useFijos,
  useMetas,
  useMovimientosDeDeudas,
  useMovimientosDeMetas,
  useMovimientosEntre,
  usePerfil,
} from '../../data/hooks';
import { pendientesDeDeudas } from '../../domain/deudas';
import { formatearMonto } from '../../domain/dinero';
import { comprometido, ordenarPendientes, pendientesDeQuincena, type Pendiente } from '../../domain/fijos';
import { pendientesDeMetas } from '../../domain/metas';
import type { Movimiento } from '../../domain/movimientos';
import { resumenQuincena } from '../../domain/presupuesto';
import { DIAS_PAGO_POR_DEFECTO, etiquetaQuincena, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido, type Prellenado } from '../movimientos/RegistroRapido';
import { PendientesQuincena } from './PendientesQuincena';
import { GastoPorCategoria } from './GastoPorCategoria';

const CANTIDAD_ULTIMOS = 5;

type Hoja = { movimiento: Movimiento } | { prellenado: Prellenado } | null;

export function InicioPage() {
  const usuario = useUsuario();
  const [hoja, setHoja] = useState<Hoja>(null);

  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const diasPago = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const quincena = quincenaDe(new Date(), diasPago);
  const { datos: movimientos, cargando, error } = useMovimientosEntre(usuario.uid, quincena.desde, quincena.hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const fijos = useFijos(usuario.uid);
  const metas = useMetas(usuario.uid);
  const movimientosDeMetas = useMovimientosDeMetas(usuario.uid);
  const deudas = useDeudas(usuario.uid);
  const movimientosDeDeudas = useMovimientosDeDeudas(usuario.uid);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const pendientes = ordenarPendientes([
    ...pendientesDeQuincena(fijos.datos, quincena, movimientos),
    ...pendientesDeMetas(metas.datos, quincena, diasPago, movimientosDeMetas.datos),
    ...pendientesDeDeudas(deudas.datos, quincena, movimientosDeDeudas.datos),
  ]);
  const resumen = resumenQuincena(movimientos, comprometido(pendientes));
  const ultimos = movimientos.slice(0, CANTIDAD_ULTIMOS);
  const nombre = (perfil?.nombre || usuario.displayName || '').split(' ')[0];

  function pagar(p: Pendiente) {
    setHoja({
      prellenado: {
        tipo: 'gasto',
        monto: p.planeado,
        categoriaId: p.categoriaId,
        nota: p.nombre,
        origen: p.origen,
        titulo: p.origen.tipo === 'meta' ? 'Abonar a la meta' : p.origen.tipo === 'deuda' ? 'Pagar cuota' : 'Registrar pago',
      },
    });
  }

  function abrirPago(movimientoId: string) {
    const encontrado = movimientos.find((m) => m.id === movimientoId);
    if (encontrado) setHoja({ movimiento: encontrado });
  }

  return (
    <div className="space-y-5">
      <p className="text-slate-500">Hola{nombre ? `, ${nombre}` : ''} 👋</p>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-sm opacity-80">Quincena actual · {etiquetaQuincena(quincena)}</p>
        <p className="mt-3 text-sm opacity-80">Disponible</p>
        <p className="text-3xl font-bold tabular-nums">{formatearMonto(resumen.disponible, moneda)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0">
            <p className="opacity-80">Ingresos</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.ingresos, moneda)}</p>
          </div>
          <div className="min-w-0">
            <p className="opacity-80">Gastado</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.gastado, moneda)}</p>
          </div>
          <div className="min-w-0">
            <p className="opacity-80">Comprometido</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.comprometido, moneda)}</p>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus movimientos. Revisa tu conexión.
        </p>
      )}

      <PendientesQuincena
        pendientes={pendientes}
        categorias={porId}
        moneda={moneda}
        cargando={
          fijos.cargando || metas.cargando || movimientosDeMetas.cargando || deudas.cargando || movimientosDeDeudas.cargando || cargando
        }
        // Sin todos los datos no se sabe qué está pagado: mostrar botones invitaría a pagar dos veces.
        error={fijos.error || metas.error || movimientosDeMetas.error || deudas.error || movimientosDeDeudas.error || error}
        onPagar={pagar}
        onAbrirPago={abrirPago}
      />

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">¿En qué se fue?</h2>
        {cargando ? (
          <p className="py-6 text-center text-slate-400">Cargando…</p>
        ) : (
          <GastoPorCategoria movimientos={movimientos} categorias={porId} moneda={moneda} />
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Últimos movimientos</h2>
          <Link to="/movimientos" className="text-sm font-medium text-emerald-600">
            Ver todos
          </Link>
        </div>
        {cargando ? (
          <p className="py-6 text-center text-slate-400">Cargando…</p>
        ) : ultimos.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
            Aún no tienes movimientos en esta quincena.
            <br />
            Toca <strong className="text-emerald-600">+</strong> para registrar el primero.
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-1 shadow-sm">
            {ultimos.map((m) => (
              <FilaMovimiento
                key={m.id}
                movimiento={m}
                categoria={porId.get(m.categoriaId)}
                moneda={moneda}
                onClick={() => setHoja({ movimiento: m })}
              />
            ))}
          </div>
        )}
      </section>

      <RegistroRapido
        abierta={hoja !== null}
        movimiento={hoja && 'movimiento' in hoja ? hoja.movimiento : undefined}
        prellenado={hoja && 'prellenado' in hoja ? hoja.prellenado : undefined}
        onCerrar={() => setHoja(null)}
      />
    </div>
  );
}
