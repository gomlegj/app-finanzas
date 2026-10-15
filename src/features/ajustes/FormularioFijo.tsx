import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { MensajeError } from '../../components/MensajeError';
import { useToast } from '../../components/toastContexto';
import { actualizarFijo, borrarFijo, crearFijo } from '../../data/fijos';
import { diasRecordatorio, enlaceCalendario } from '../../domain/calendario';
import { categoriasActivas, type Categoria } from '../../domain/categorias';
import { actualizarTextoMonto, agruparMiles, parsearMonto } from '../../domain/dinero';
import {
  MAX_NOMBRE_FIJO,
  normalizarFijo,
  validarFijo,
  type ErroresFijo,
  type Fijo,
  type Frecuencia,
  type NumeroQuincena,
} from '../../domain/fijos';
import type { DiasPago } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';

interface Props {
  fijo?: Fijo;
  categorias: readonly Categoria[];
  diasPago: DiasPago;
  moneda: string;
  onListo: () => void;
}

export function FormularioFijo({ fijo, categorias, diasPago, moneda, onListo }: Props) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(fijo?.nombre ?? '');
  const [montoTexto, setMontoTexto] = useState(fijo ? agruparMiles(String(fijo.monto)) : '');
  const [categoriaId, setCategoriaId] = useState(fijo?.categoriaId ?? '');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(fijo?.frecuencia ?? 'mensual');
  const [quincena, setQuincena] = useState<NumeroQuincena>(fijo?.quincena ?? 1);
  const [diaTexto, setDiaTexto] = useState(fijo?.diaPago ? String(fijo.diaPago) : '');
  const [activo, setActivo] = useState(fijo?.activo ?? true);
  const [errores, setErrores] = useState<ErroresFijo>({});

  // Al editar, la categoría actual se muestra aunque esté archivada.
  const actual = categorias.find((c) => c.id === categoriaId);
  const opciones = categoriasActivas(categorias, 'gasto');
  if (actual?.archivada && actual.tipo === 'gasto') opciones.push(actual);

  // El evento se arma con lo guardado, no con cambios sin guardar.
  const diasCalendario = fijo ? diasRecordatorio(fijo, diasPago) : null;

  function guardar(e: FormEvent) {
    e.preventDefault();
    const diaPago = diaTexto === '' ? null : Number(diaTexto);
    const formulario = { nombre, monto: parsearMonto(montoTexto), categoriaId, frecuencia, quincena, diaPago, activo };
    const encontrados = validarFijo(formulario);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarFijo(formulario);
    const operacion = fijo ? actualizarFijo(usuario.uid, fijo.id, datos) : crearFijo(usuario.uid, datos);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar el gasto fijo', 'error'));
    mostrar(fijo ? 'Gasto fijo actualizado' : 'Gasto fijo creado');
    onListo();
  }

  function borrar() {
    if (!fijo || !window.confirm(`¿Eliminar "${fijo.nombre}"? Los pagos ya registrados se conservan.`)) return;
    borrarFijo(usuario.uid, fijo.id).catch(() => mostrar('No se pudo eliminar el gasto fijo', 'error'));
    mostrar('Gasto fijo eliminado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Nombre</span>
        <input
          autoFocus
          value={nombre}
          maxLength={MAX_NOMBRE_FIJO}
          placeholder="Ej. Arriendo, Internet"
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        />
        <MensajeError mensaje={errores.nombre} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Monto planeado</span>
        <div className="flex items-baseline gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <span className="text-slate-400">$</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(actualizarTextoMonto(e.target.value))}
            className="w-full min-w-0 bg-transparent tabular-nums outline-none"
          />
        </div>
        <MensajeError mensaje={errores.monto} />
      </label>

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

      <Segmentado
        etiqueta="Frecuencia"
        valor={frecuencia}
        onCambio={setFrecuencia}
        opciones={[
          { valor: 'mensual', etiqueta: 'Mensual' },
          { valor: 'quincenal', etiqueta: 'Cada quincena' },
        ]}
      />

      {frecuencia === 'mensual' && (
        <>
          <Segmentado
            etiqueta="¿En qué quincena se paga?"
            valor={quincena}
            onCambio={setQuincena}
            opciones={[
              { valor: 1, etiqueta: 'Quincena 1' },
              { valor: 2, etiqueta: 'Quincena 2' },
            ]}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Día de pago (opcional)</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej. 5"
              value={diaTexto}
              onChange={(e) => setDiaTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 tabular-nums"
            />
            <span className="mt-1 block text-sm text-slate-500">Para recordarte en Google Calendar.</span>
            <MensajeError mensaje={errores.diaPago} />
          </label>
        </>
      )}

      <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
        <span>
          <span className="block font-medium text-slate-800">Activo</span>
          <span className="block text-sm text-slate-500">Si lo pausas, deja de aparecer en Inicio.</span>
        </span>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
      </label>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {fijo && diasCalendario && (
        <div className="space-y-1">
          <a
            href={enlaceCalendario(fijo, diasCalendario, moneda)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 py-3 font-medium text-sky-700 hover:bg-sky-100"
          >
            📅 Agregar a Google Calendar
          </a>
          <p className="text-center text-xs text-slate-500">Si cambias este fijo, actualiza también el evento en Calendar.</p>
        </div>
      )}

      {fijo && (
        <button
          type="button"
          onClick={borrar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={18} />
          Eliminar gasto fijo
        </button>
      )}
    </form>
  );
}

interface PropsSegmentado<T extends string | number> {
  etiqueta: string;
  valor: T;
  onCambio: (valor: T) => void;
  opciones: { valor: T; etiqueta: string }[];
}

function Segmentado<T extends string | number>({ etiqueta, valor, onCambio, opciones }: PropsSegmentado<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">{etiqueta}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup">
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onCambio(opcion.valor)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                activa ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
