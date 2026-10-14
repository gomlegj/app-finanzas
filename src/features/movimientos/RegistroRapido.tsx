import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { MensajeError } from '../../components/MensajeError';
import { SelectorTipo } from '../../components/SelectorTipo';
import { useToast } from '../../components/toastContexto';
import { useCategorias } from '../../data/hooks';
import { actualizarMovimiento, borrarMovimiento, crearMovimiento } from '../../data/movimientos';
import { categoriasActivas } from '../../domain/categorias';
import { actualizarTextoMonto, agruparMiles, formatearMonto, parsearMonto } from '../../domain/dinero';
import { fechaLocalISO } from '../../domain/fechas';
import {
  MAX_NOTA,
  normalizarMovimiento,
  validarMovimiento,
  type ErroresMovimiento,
  type Movimiento,
  type OrigenMovimiento,
  type TipoMovimiento,
} from '../../domain/movimientos';
import { useUsuario } from '../auth/contexto';

export interface Prellenado {
  monto: number;
  categoriaId: string;
  nota: string;
  origen: OrigenMovimiento;
}

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  movimiento?: Movimiento;
  /** Para registrar el pago de un pendiente (fijo, y luego deuda o meta). Se ignora si hay `movimiento`. */
  prellenado?: Prellenado;
}

export function RegistroRapido({ abierta, onCerrar, movimiento, prellenado }: Props) {
  const pago = movimiento ? undefined : prellenado;
  const titulo = movimiento ? 'Editar movimiento' : pago ? 'Registrar pago' : 'Nuevo movimiento';
  const clave = movimiento?.id ?? (pago ? `pago:${pago.origen.id}` : 'nuevo');
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={titulo}>
      <FormularioMovimiento key={clave} movimiento={movimiento} prellenado={pago} onListo={onCerrar} />
    </HojaInferior>
  );
}

function FormularioMovimiento({
  movimiento,
  prellenado,
  onListo,
}: {
  movimiento?: Movimiento;
  prellenado?: Prellenado;
  onListo: () => void;
}) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: categorias } = useCategorias(usuario.uid);

  const montoInicial = movimiento?.monto ?? prellenado?.monto;
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? 'gasto');
  const [montoTexto, setMontoTexto] = useState(montoInicial ? agruparMiles(String(montoInicial)) : '');
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoriaId ?? prellenado?.categoriaId ?? '');
  const [fecha, setFecha] = useState(movimiento?.fecha ?? fechaLocalISO());
  const [nota, setNota] = useState(movimiento?.nota ?? prellenado?.nota ?? '');
  const [errores, setErrores] = useState<ErroresMovimiento>({});

  // Al editar, la categoría actual se muestra aunque esté archivada.
  const actual = categorias.find((c) => c.id === categoriaId);
  const opciones = categoriasActivas(categorias, tipo);
  if (actual?.archivada && actual.tipo === tipo) opciones.push(actual);

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo);
    setCategoriaId('');
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    const formulario = { tipo, monto: parsearMonto(montoTexto), categoriaId, fecha, nota };
    const encontrados = validarMovimiento(formulario);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarMovimiento(formulario);
    const operacion = movimiento
      ? actualizarMovimiento(usuario.uid, movimiento.id, datos)
      : crearMovimiento(usuario.uid, datos, prellenado?.origen);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar el movimiento', 'error'));
    mostrar(movimiento ? 'Movimiento actualizado' : 'Movimiento guardado');
    onListo();
  }

  function borrar() {
    if (!movimiento || !window.confirm('¿Borrar este movimiento?')) return;
    borrarMovimiento(usuario.uid, movimiento.id).catch(() => mostrar('No se pudo borrar el movimiento', 'error'));
    mostrar('Movimiento borrado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      {/* Un pago siempre es gasto: cambiarlo a ingreso rompería planeado vs real. */}
      {!prellenado && !movimiento?.origen && <SelectorTipo valor={tipo} onCambio={cambiarTipo} />}

      <div>
        <label htmlFor="monto" className="sr-only">
          Monto
        </label>
        <div className="flex items-baseline justify-center gap-1 border-b-2 border-slate-200 pb-2 focus-within:border-emerald-500">
          <span className="text-3xl font-semibold text-slate-400">$</span>
          <input
            id="monto"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(actualizarTextoMonto(e.target.value))}
            className="w-full min-w-0 bg-transparent text-center text-4xl font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
          />
        </div>
        {montoTexto.includes(',') && parsearMonto(montoTexto) !== null && (
          <p className="mt-1 text-center text-sm text-amber-700">
            Sin centavos: se guardará {formatearMonto(parsearMonto(montoTexto) ?? 0)}
          </p>
        )}
        <MensajeError mensaje={errores.monto} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">Categoría</legend>
        <div className="grid grid-cols-4 gap-2">
          {opciones.map((c) => {
            const elegida = c.id === categoriaId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={elegida}
                onClick={() => setCategoriaId(c.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-center transition ${
                  elegida ? 'bg-emerald-50 ring-2 ring-emerald-500' : 'hover:bg-slate-50'
                }`}
              >
                <BurbujaCategoria icono={c.icono} color={c.color} />
                <span className="line-clamp-2 text-xs leading-tight text-slate-700">{c.nombre}</span>
              </button>
            );
          })}
        </div>
        <MensajeError mensaje={errores.categoriaId} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
          <MensajeError mensaje={errores.fecha} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Nota</span>
          <input
            value={nota}
            maxLength={MAX_NOTA}
            placeholder="Opcional"
            onChange={(e) => setNota(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
          <MensajeError mensaje={errores.nota} />
        </label>
      </div>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {movimiento && (
        <button
          type="button"
          onClick={borrar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={18} />
          Borrar movimiento
        </button>
      )}
    </form>
  );
}
