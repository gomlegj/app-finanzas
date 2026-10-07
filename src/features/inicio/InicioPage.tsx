import { useState } from 'react';
import { Link } from 'react-router';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import { mesActual, nombreMes, rangoMes } from '../../domain/fechas';
import { sumarPorTipo, type Movimiento } from '../../domain/movimientos';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from '../movimientos/RegistroRapido';

const CANTIDAD_ULTIMOS = 5;

export function InicioPage() {
  const usuario = useUsuario();
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const mes = mesActual();
  const { desde, hasta } = rangoMes(mes.anio, mes.mes);
  const { datos: movimientos, cargando } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const totales = sumarPorTipo(movimientos);
  const balance = totales.ingresos - totales.gastos;
  const ultimos = movimientos.slice(0, CANTIDAD_ULTIMOS);
  const nombre = (perfil?.nombre || usuario.displayName || '').split(' ')[0];

  return (
    <div className="space-y-5">
      <p className="text-slate-500">Hola{nombre ? `, ${nombre}` : ''} 👋</p>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-sm opacity-80">Balance de {nombreMes(mes.anio, mes.mes).toLowerCase()}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatearMonto(balance, moneda)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="opacity-80">Ingresos</p>
            <p className="font-semibold tabular-nums">{formatearMonto(totales.ingresos, moneda)}</p>
          </div>
          <div>
            <p className="opacity-80">Gastos</p>
            <p className="font-semibold tabular-nums">{formatearMonto(totales.gastos, moneda)}</p>
          </div>
        </div>
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
            Aún no tienes movimientos este mes.
            <br />
            Toca <strong className="text-emerald-600">+</strong> para registrar el primero.
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-1 shadow-sm">
            {ultimos.map((m) => (
              <FilaMovimiento key={m.id} movimiento={m} categoria={porId.get(m.categoriaId)} moneda={moneda} onClick={() => setEditando(m)} />
            ))}
          </div>
        )}
      </section>

      <RegistroRapido abierta={editando !== undefined} movimiento={editando} onCerrar={() => setEditando(undefined)} />
    </div>
  );
}
