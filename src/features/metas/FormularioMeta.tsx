import { useState, type FormEvent } from 'react';
import { Archive } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { MensajeError } from '../../components/MensajeError';
import { SelectorColor, SelectorIcono } from '../../components/SelectorIconoColor';
import { useToast } from '../../components/toastContexto';
import { archivarMeta, actualizarMeta, crearMeta } from '../../data/metas';
import { COLORES_DISPONIBLES, ICONOS_DISPONIBLES } from '../../domain/categorias';
import { actualizarTextoMonto, agruparMiles, formatearMonto, parsearMonto } from '../../domain/dinero';
import { fechaConAnio, fechaLocalISO } from '../../domain/fechas';
import {
  cuotaDeQuincena,
  fechaEstimada,
  MAX_NOMBRE_META,
  normalizarMeta,
  validarMeta,
  type ErroresMeta,
  type Meta,
  type ModoMeta,
} from '../../domain/metas';
import { quincenaDe, type DiasPago } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';

interface Props {
  meta?: Meta;
  /** Abonos menos retiros antes de la quincena actual, sin el ahorro inicial (vista previa al editar). */
  movidoAntes?: number;
  diasPago: DiasPago;
  moneda: string;
  onListo: () => void;
}

const textoMonto = (valor?: number) => (valor ? agruparMiles(String(valor)) : '');

export function FormularioMeta({ meta, movidoAntes = 0, diasPago, moneda, onListo }: Props) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const hoy = fechaLocalISO();
  const [nombre, setNombre] = useState(meta?.nombre ?? '');
  const [icono, setIcono] = useState(meta?.icono ?? ICONOS_DISPONIBLES[0]);
  const [color, setColor] = useState(meta?.color ?? COLORES_DISPONIBLES[0]);
  const [objetivoTexto, setObjetivoTexto] = useState(textoMonto(meta?.objetivo));
  const [inicialTexto, setInicialTexto] = useState(textoMonto(meta?.ahorroInicial));
  const [modo, setModo] = useState<ModoMeta>(meta?.modo ?? 'fecha');
  const [fecha, setFecha] = useState(meta?.fechaObjetivo ?? '');
  const [cuotaTexto, setCuotaTexto] = useState(textoMonto(meta?.cuotaQuincenal));
  const [errores, setErrores] = useState<ErroresMeta>({});

  const formulario = {
    nombre,
    icono,
    color,
    objetivo: parsearMonto(objetivoTexto),
    ahorroInicial: inicialTexto ? parsearMonto(inicialTexto) : null,
    modo,
    fechaObjetivo: fecha,
    cuotaQuincenal: parsearMonto(cuotaTexto),
  };

  // Vista previa: solo si los datos del modo son válidos.
  const valida = Object.keys(validarMeta(formulario, { hoy, creando: !meta })).length === 0;
  const previa = valida ? normalizarMeta(formulario) : null;
  const quincena = quincenaDe(new Date(), diasPago);
  const base = (previa?.ahorroInicial ?? 0) + movidoAntes;
  let textoPrevia: string | null = null;
  if (previa?.modo === 'fecha') {
    textoPrevia = `Necesitas ${formatearMonto(cuotaDeQuincena(previa, base, quincena, diasPago), moneda)} por quincena`;
  } else if (previa) {
    const estimada = fechaEstimada(previa, base, quincena, diasPago);
    if (estimada) textoPrevia = `Llegarías aprox. el ${fechaConAnio(estimada)}`;
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarMeta(formulario, { hoy, creando: !meta });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarMeta(formulario);
    const operacion = meta ? actualizarMeta(usuario.uid, meta.id, datos) : crearMeta(usuario.uid, datos);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar la meta', 'error'));
    mostrar(meta ? 'Meta actualizada' : 'Meta creada');
    onListo();
  }

  function archivar() {
    if (!meta) return;
    archivarMeta(usuario.uid, meta.id, true).catch(() => mostrar('No se pudo archivar la meta', 'error'));
    mostrar('Meta archivada');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <div>
        <div className="flex items-center gap-3">
          <BurbujaCategoria icono={icono} color={color} grande />
          <input
            aria-label="Nombre de la meta"
            value={nombre}
            maxLength={MAX_NOMBRE_META}
            placeholder="Ej. Viaje, Fondo de emergencia"
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg"
          />
        </div>
        <MensajeError mensaje={errores.nombre} />
      </div>

      <CampoMonto etiqueta="Objetivo" valor={objetivoTexto} onCambio={setObjetivoTexto} error={errores.objetivo} />
      <CampoMonto
        etiqueta="Ya tengo ahorrado (opcional)"
        valor={inicialTexto}
        onCambio={setInicialTexto}
        error={errores.ahorroInicial}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">¿Cómo quieres ahorrar?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup">
          {(
            [
              { valor: 'fecha', etiqueta: 'Por fecha' },
              { valor: 'cuota', etiqueta: 'Por cuota' },
            ] as const
          ).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={modo === opcion.valor}
              onClick={() => setModo(opcion.valor)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                modo === opcion.valor ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {modo === 'fecha' ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">¿Para cuándo?</span>
          <input
            type="date"
            value={fecha}
            min={meta ? undefined : hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
          <MensajeError mensaje={errores.fechaObjetivo} />
        </label>
      ) : (
        <CampoMonto etiqueta="Cuota por quincena" valor={cuotaTexto} onCambio={setCuotaTexto} error={errores.cuotaQuincenal} />
      )}

      {textoPrevia && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{textoPrevia}</p>}

      <SelectorIcono valor={icono} onCambio={setIcono} />
      <SelectorColor valor={color} onCambio={setColor} />

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {meta && (
        <button
          type="button"
          onClick={archivar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-slate-500 hover:bg-slate-100"
        >
          <Archive size={18} />
          Archivar meta
        </button>
      )}
    </form>
  );
}

function CampoMonto({
  etiqueta,
  valor,
  onCambio,
  error,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (texto: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</span>
      <div className="flex items-baseline gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-slate-400">$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={valor}
          onChange={(e) => onCambio(actualizarTextoMonto(e.target.value))}
          className="w-full min-w-0 bg-transparent tabular-nums outline-none"
        />
      </div>
      <MensajeError mensaje={error} />
    </label>
  );
}
