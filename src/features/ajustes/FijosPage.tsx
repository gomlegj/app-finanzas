import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Pencil } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { useCategorias, useFijos, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import { etiquetaFrecuencia, etiquetaVencimiento, ordenarFijos, type Fijo } from '../../domain/fijos';
import { DIAS_PAGO_POR_DEFECTO } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { FormularioFijo } from './FormularioFijo';

export function FijosPage() {
  const usuario = useUsuario();
  const { datos: fijos, cargando, error } = useFijos(usuario.uid);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const [editando, setEditando] = useState<Fijo | 'nuevo' | null>(null);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const lista = ordenarFijos(fijos);

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Gastos fijos</h2>
      <p className="text-sm text-slate-500">Lo que pagas siempre. Aparece en Inicio en la quincena que le toca.</p>

      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus gastos fijos. Revisa tu conexión.
        </p>
      ) : cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : (
        lista.length > 0 && (
          <ul className="rounded-2xl bg-white p-1 shadow-sm">
            {lista.map((f) => {
              const categoria = porId.get(f.categoriaId);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(f)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50 ${
                      f.activo ? '' : 'opacity-50'
                    }`}
                  >
                    <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{f.nombre}</span>
                      <span className="block text-sm text-slate-500">
                        {etiquetaFrecuencia(f)}
                        {etiquetaVencimiento(f) ? ` · ${etiquetaVencimiento(f)}` : ''}
                        {f.activo ? '' : ' · Pausado'}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-800">{formatearMonto(f.monto, moneda)}</span>
                    <Pencil size={16} className="text-slate-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nuevo gasto fijo
      </button>

      <HojaInferior
        abierta={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}
        onCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioFijo
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            fijo={editando === 'nuevo' ? undefined : editando}
            categorias={categorias}
            diasPago={perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO}
            moneda={moneda}
            onListo={() => setEditando(null)}
          />
        )}
      </HojaInferior>
    </div>
  );
}
