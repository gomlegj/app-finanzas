import { useState, type FormEvent } from 'react';
import { Archive } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { MensajeError } from '../../components/MensajeError';
import { SelectorColor, SelectorIcono } from '../../components/SelectorIconoColor';
import { useToast } from '../../components/toastContexto';
import { actualizarCategoria, crearCategoria } from '../../data/categorias';
import {
  COLORES_DISPONIBLES,
  ICONOS_DISPONIBLES,
  siguienteOrden,
  validarNombreCategoria,
  type Categoria,
  type TipoCategoria,
} from '../../domain/categorias';
import { useUsuario } from '../auth/contexto';

interface Props {
  categoria?: Categoria;
  tipo: TipoCategoria;
  todas: readonly Categoria[];
  onListo: () => void;
}

export function FormularioCategoria({ categoria, tipo, todas, onListo }: Props) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [icono, setIcono] = useState(categoria?.icono ?? ICONOS_DISPONIBLES[0]);
  const [color, setColor] = useState(categoria?.color ?? COLORES_DISPONIBLES[0]);
  const [error, setError] = useState<string | null>(null);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const problema = validarNombreCategoria(nombre, todas, tipo, categoria?.id);
    setError(problema);
    if (problema) return;

    const limpio = nombre.trim();
    const operacion = categoria
      ? actualizarCategoria(usuario.uid, categoria.id, { nombre: limpio, icono, color })
      : crearCategoria(usuario.uid, {
          nombre: limpio,
          icono,
          color,
          tipo,
          orden: siguienteOrden(todas, tipo),
          sistema: false,
          archivada: false,
        });
    operacion.catch(() => mostrar('No se pudo guardar la categoría', 'error'));
    mostrar(categoria ? 'Categoría actualizada' : 'Categoría creada');
    onListo();
  }

  function archivar() {
    if (!categoria) return;
    actualizarCategoria(usuario.uid, categoria.id, { archivada: true }).catch(() =>
      mostrar('No se pudo archivar la categoría', 'error'),
    );
    mostrar('Categoría archivada');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <div>
        <div className="flex items-center gap-3">
          <BurbujaCategoria icono={icono} color={color} grande />
          <input
            aria-label="Nombre de la categoría"
            autoFocus
            value={nombre}
            maxLength={40}
            placeholder="Nombre"
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg"
          />
        </div>
        <MensajeError mensaje={error ?? undefined} />
      </div>

      <SelectorIcono valor={icono} onCambio={setIcono} />
      <SelectorColor valor={color} onCambio={setColor} />

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {categoria && !categoria.sistema && (
        <button
          type="button"
          onClick={archivar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-slate-500 hover:bg-slate-100"
        >
          <Archive size={18} />
          Archivar
        </button>
      )}
    </form>
  );
}
