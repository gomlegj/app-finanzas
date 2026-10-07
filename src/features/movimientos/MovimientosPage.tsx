import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { TarjetaResumen } from '../../components/TarjetaResumen';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { categoriasActivas } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import { desplazarMes, etiquetaFecha, mesActual, nombreMes, rangoMes, type MesAnio } from '../../domain/fechas';
import { agruparPorFecha, sumarPorTipo, type Movimiento } from '../../domain/movimientos';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from './RegistroRapido';

export function MovimientosPage() {
  const usuario = useUsuario();
  const [mes, setMes] = useState<MesAnio>(() => mesActual());
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const { desde, hasta } = rangoMes(mes.anio, mes.mes);
  const { datos: movimientos, cargando } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const filtrados = categoriaFiltro ? movimientos.filter((m) => m.categoriaId === categoriaFiltro) : movimientos;
  const totales = sumarPorTipo(filtrados);
  const grupos = agruparPorFecha(filtrados);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 shadow-sm">
        <button type="button" aria-label="Mes anterior" onClick={() => setMes((m) => desplazarMes(m, -1))} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-slate-900">{nombreMes(mes.anio, mes.mes)}</span>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMes((m) => desplazarMes(m, 1))} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronRight size={20} />
        </button>
      </div>

      <select
        aria-label="Filtrar por categoría"
        value={categoriaFiltro}
        onChange={(e) => setCategoriaFiltro(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
      >
        <option value="">Todas las categorías</option>
        {[...categoriasActivas(categorias, 'gasto'), ...categoriasActivas(categorias, 'ingreso')].map((c) => (
          <option key={c.id} value={c.id}>
            {c.icono} {c.nombre}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <TarjetaResumen etiqueta="Ingresos" valor={formatearMonto(totales.ingresos, moneda)} colorValor="text-emerald-600" />
        <TarjetaResumen etiqueta="Gastos" valor={formatearMonto(totales.gastos, moneda)} colorValor="text-rose-600" />
      </div>

      {cargando ? (
        <p className="py-10 text-center text-slate-400">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="py-10 text-center text-slate-400">No hay movimientos en este mes.</p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.fecha}>
            <h3 className="mb-1 px-2 text-sm font-medium text-slate-500">{etiquetaFecha(grupo.fecha)}</h3>
            <div className="rounded-2xl bg-white p-1 shadow-sm">
              {grupo.movimientos.map((m) => (
                <FilaMovimiento key={m.id} movimiento={m} categoria={porId.get(m.categoriaId)} moneda={moneda} onClick={() => setEditando(m)} />
              ))}
            </div>
          </section>
        ))
      )}

      <RegistroRapido abierta={editando !== undefined} movimiento={editando} onCerrar={() => setEditando(undefined)} />
    </div>
  );
}
