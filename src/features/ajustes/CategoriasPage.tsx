import { useState } from 'react';
import { Link } from 'react-router';
import { ArchiveRestore, ChevronLeft, Pencil } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { SelectorTipo } from '../../components/SelectorTipo';
import { useToast } from '../../components/toastContexto';
import { actualizarCategoria } from '../../data/categorias';
import { useCategorias } from '../../data/hooks';
import { categoriasActivas, type Categoria, type TipoCategoria } from '../../domain/categorias';
import { useUsuario } from '../auth/contexto';
import { FormularioCategoria } from './FormularioCategoria';

export function CategoriasPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: categorias } = useCategorias(usuario.uid);
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);

  const activas = categoriasActivas(categorias, tipo);
  const archivadas = categorias.filter((c) => c.tipo === tipo && c.archivada);

  function restaurar(categoria: Categoria) {
    actualizarCategoria(usuario.uid, categoria.id, { archivada: false }).catch(() =>
      mostrar('No se pudo restaurar la categoría', 'error'),
    );
    mostrar('Categoría restaurada');
  }

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Categorías</h2>

      <SelectorTipo valor={tipo} onCambio={setTipo} />

      <ul className="rounded-2xl bg-white p-1 shadow-sm">
        {activas.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEditando(c)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
            >
              <BurbujaCategoria icono={c.icono} color={c.color} />
              <span className="flex-1 font-medium text-slate-800">{c.nombre}</span>
              {c.sistema && <span className="text-xs text-slate-400">Sistema</span>}
              <Pencil size={16} className="text-slate-400" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setEditando('nueva')}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nueva categoría
      </button>

      {archivadas.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-sm font-medium text-slate-500">Archivadas</h3>
          <ul className="rounded-2xl bg-white p-1 shadow-sm">
            {archivadas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                <BurbujaCategoria icono={c.icono} color={c.color} />
                <span className="flex-1 text-slate-500">{c.nombre}</span>
                <button
                  type="button"
                  onClick={() => restaurar(c)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                >
                  <ArchiveRestore size={16} />
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HojaInferior
        abierta={editando !== null}
        titulo={editando === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
        onCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioCategoria
            key={editando === 'nueva' ? 'nueva' : editando.id}
            categoria={editando === 'nueva' ? undefined : editando}
            tipo={tipo}
            todas={categorias}
            onListo={() => setEditando(null)}
          />
        )}
      </HojaInferior>
    </div>
  );
}
