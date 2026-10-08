import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { TarjetaResumen } from '../../components/TarjetaResumen';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { categoriasActivas } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import { desplazarMes, etiquetaFecha, mesActual, nombreMes, rangoMes, type MesAnio } from '../../domain/fechas';
import { agruparPorFecha, sumarPorTipo, type Movimiento } from '../../domain/movimientos';
import { DIAS_PAGO_POR_DEFECTO, desplazarQuincena, etiquetaQuincena, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from './RegistroRapido';

type Vista = 'quincena' | 'mes';

const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'quincena', etiqueta: 'Quincena' },
  { valor: 'mes', etiqueta: 'Mes' },
];

export function MovimientosPage() {
  const usuario = useUsuario();
  const [vista, setVista] = useState<Vista>('quincena');
  const [mes, setMes] = useState<MesAnio>(() => mesActual());
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const diasPago = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const quincena = desplazarQuincena(quincenaDe(new Date(), diasPago), desplazamiento, diasPago);

  const { desde, hasta } = vista === 'mes' ? rangoMes(mes.anio, mes.mes) : quincena;
  const titulo = vista === 'mes' ? nombreMes(mes.anio, mes.mes) : `Quincena ${quincena.numero} · ${etiquetaQuincena(quincena)}`;

  const { datos: movimientos, cargando, error } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const filtrados = categoriaFiltro ? movimientos.filter((m) => m.categoriaId === categoriaFiltro) : movimientos;
  const totales = sumarPorTipo(filtrados);
  const grupos = agruparPorFecha(filtrados);
  const archivadas = categorias.filter((c) => c.archivada);

  function mover(delta: number) {
    if (vista === 'mes') setMes((m) => desplazarMes(m, delta));
    else setDesplazamiento((d) => d + delta);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Ver por">
        {VISTAS.map((v) => (
          <button
            key={v.valor}
            type="button"
            role="radio"
            aria-checked={vista === v.valor}
            onClick={() => setVista(v.valor)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              vista === v.valor ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 shadow-sm">
        <button type="button" aria-label="Periodo anterior" onClick={() => mover(-1)} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-center font-semibold text-slate-900">{titulo}</span>
        <button type="button" aria-label="Periodo siguiente" onClick={() => mover(1)} className="rounded-full p-2 hover:bg-slate-100">
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
        {archivadas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icono} {c.nombre} (archivada)
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <TarjetaResumen etiqueta="Ingresos" valor={formatearMonto(totales.ingresos, moneda)} colorValor="text-emerald-600" />
        <TarjetaResumen etiqueta="Gastos" valor={formatearMonto(totales.gastos, moneda)} colorValor="text-rose-600" />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus movimientos. Revisa tu conexión.
        </p>
      ) : cargando ? (
        <p className="py-10 text-center text-slate-400">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="py-10 text-center text-slate-400">No hay movimientos en este periodo.</p>
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
