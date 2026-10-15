import { ID_AHORRO } from './categorias';
import { ordenarPendientes, resumirPagos, type Pendiente } from './fijos';
import type { Movimiento } from './movimientos';
import { desplazarQuincena, type DiasPago, type Quincena } from './quincena';

export type ModoMeta = 'fecha' | 'cuota';

export interface DatosMetaEditable {
  nombre: string;
  icono: string;
  color: string;
  objetivo: number;
  /** Lo que ya estaba ahorrado antes de crear la meta; no genera movimiento. */
  ahorroInicial: number;
  modo: ModoMeta;
  /** Solo modo fecha. */
  fechaObjetivo?: string;
  /** Solo modo cuota. */
  cuotaQuincenal?: number;
}

export interface DatosMeta extends DatosMetaEditable {
  archivada: boolean;
}

export interface Meta extends DatosMeta {
  id: string;
}

export interface FormularioMeta {
  nombre: string;
  icono: string;
  color: string;
  objetivo: number | null;
  ahorroInicial: number | null;
  modo: ModoMeta;
  fechaObjetivo: string;
  cuotaQuincenal: number | null;
}

export type ErroresMeta = Partial<Record<'nombre' | 'objetivo' | 'ahorroInicial' | 'fechaObjetivo' | 'cuotaQuincenal', string>>;

export const MAX_NOMBRE_META = 40;

export function validarMeta(f: FormularioMeta, { hoy, creando }: { hoy: string; creando: boolean }): ErroresMeta {
  const errores: ErroresMeta = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_META) errores.nombre = `Máximo ${MAX_NOMBRE_META} caracteres`;
  if (f.objetivo === null || f.objetivo <= 0) errores.objetivo = 'Escribe un objetivo mayor a 0';
  else if ((f.ahorroInicial ?? 0) >= f.objetivo) errores.ahorroInicial = 'Debe ser menor que el objetivo';
  if (f.modo === 'fecha') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fechaObjetivo)) errores.fechaObjetivo = 'Elige una fecha';
    else if (creando && f.fechaObjetivo <= hoy) errores.fechaObjetivo = 'Elige una fecha futura';
  } else if (f.cuotaQuincenal === null || f.cuotaQuincenal <= 0) {
    errores.cuotaQuincenal = 'Escribe una cuota mayor a 0';
  }
  return errores;
}

export function normalizarMeta(f: FormularioMeta): DatosMetaEditable {
  if (f.objetivo === null) throw new Error('normalizarMeta requiere un objetivo validado');
  const datos: DatosMetaEditable = {
    nombre: f.nombre.trim(),
    icono: f.icono,
    color: f.color,
    objetivo: f.objetivo,
    ahorroInicial: f.ahorroInicial ?? 0,
    modo: f.modo,
  };
  if (f.modo === 'fecha') datos.fechaObjetivo = f.fechaObjetivo;
  else if (f.cuotaQuincenal !== null) datos.cuotaQuincenal = f.cuotaQuincenal;
  return datos;
}

/** Ahorro inicial + abonos (gastos) − retiros (ingresos) con origen en esta meta. */
export function ahorrado(meta: Pick<Meta, 'id' | 'ahorroInicial'>, movimientos: readonly Movimiento[]): number {
  let total = meta.ahorroInicial;
  for (const m of movimientos) {
    if (m.origen?.tipo !== 'meta' || m.origen.id !== meta.id) continue;
    total += m.tipo === 'gasto' ? m.monto : -m.monto;
  }
  return total;
}

export function progreso(meta: Pick<Meta, 'objetivo'>, ahorradoActual: number): number {
  return Math.min(100, Math.max(0, Math.floor((ahorradoActual * 100) / meta.objetivo)));
}

export function cumplida(meta: Pick<Meta, 'objetivo'>, ahorradoActual: number): boolean {
  return ahorradoActual >= meta.objetivo;
}

/** Tope de cálculo: 50 años de quincenas. Más allá no aporta y las fechas se salen del rango válido. */
const MAX_QUINCENAS = 1200;

/** Quincenas desde la actual (incluida) hasta la que contiene `fecha` (incluida); mínimo 1, máximo MAX_QUINCENAS. */
function quincenasHasta(quincena: Quincena, fecha: string, diasPago: DiasPago): number {
  let cuenta = 1;
  let actual = quincena;
  while (actual.hasta < fecha && cuenta < MAX_QUINCENAS) {
    actual = desplazarQuincena(actual, 1, diasPago);
    cuenta++;
  }
  return cuenta;
}

type MetaCalculable = Pick<DatosMetaEditable, 'objetivo' | 'modo' | 'fechaObjetivo' | 'cuotaQuincenal'>;

/** Cuánto toca abonar en `quincena`, con lo ahorrado al inicio de esa quincena. */
export function cuotaDeQuincena(meta: MetaCalculable, ahorradoAlInicio: number, quincena: Quincena, diasPago: DiasPago): number {
  const faltante = Math.max(0, meta.objetivo - ahorradoAlInicio);
  if (faltante === 0) return 0;
  if (meta.modo === 'cuota') return Math.min(meta.cuotaQuincenal ?? faltante, faltante);
  const restantes = meta.fechaObjetivo ? quincenasHasta(quincena, meta.fechaObjetivo, diasPago) : 1;
  return Math.ceil(faltante / restantes);
}

/** Modo cuota: fin de la quincena en que se completa la meta al ritmo de la cuota. */
export function fechaEstimada(meta: MetaCalculable, ahorradoAlInicio: number, quincena: Quincena, diasPago: DiasPago): string | null {
  const faltante = Math.max(0, meta.objetivo - ahorradoAlInicio);
  if (meta.modo !== 'cuota' || !meta.cuotaQuincenal || faltante === 0) return null;
  const quincenas = Math.ceil(faltante / meta.cuotaQuincenal);
  if (quincenas > MAX_QUINCENAS) return null;
  return desplazarQuincena(quincena, quincenas - 1, diasPago).hasta;
}

/**
 * Cuotas de las metas activas en `quincena`. `movimientosDeMetas`: todos los movimientos con
 * origen meta, de cualquier fecha (lo anterior a la quincena define la cuota; lo de la quincena, el pago).
 */
export function pendientesDeMetas(
  metas: readonly Meta[],
  quincena: Quincena,
  diasPago: DiasPago,
  movimientosDeMetas: readonly Movimiento[],
): Pendiente[] {
  const resultado: Pendiente[] = [];
  for (const meta of metas) {
    if (meta.archivada) continue;
    const propios = movimientosDeMetas.filter((m) => m.origen?.tipo === 'meta' && m.origen.id === meta.id);
    const alInicio = ahorrado(meta, propios.filter((m) => m.fecha < quincena.desde));
    const cuota = cuotaDeQuincena(meta, alInicio, quincena, diasPago);
    if (cuota === 0) continue;
    const abonos = propios.filter((m) => m.tipo === 'gasto' && m.fecha >= quincena.desde && m.fecha <= quincena.hasta);
    const pendiente: Pendiente = {
      origen: { tipo: 'meta', id: meta.id },
      nombre: meta.nombre,
      categoriaId: ID_AHORRO,
      icono: meta.icono,
      color: meta.color,
      planeado: cuota,
    };
    if (abonos.length > 0) pendiente.pagado = resumirPagos(abonos);
    resultado.push(pendiente);
  }
  return ordenarPendientes(resultado);
}

/** Lo abonado (gastos con origen en la meta) dentro de la quincena. */
export function abonadoEnQuincena(meta: Pick<Meta, 'id'>, movimientos: readonly Movimiento[], quincena: Quincena): number {
  return movimientos
    .filter(
      (m) =>
        m.tipo === 'gasto' &&
        m.origen?.tipo === 'meta' &&
        m.origen.id === meta.id &&
        m.fecha >= quincena.desde &&
        m.fecha <= quincena.hasta,
    )
    .reduce((suma, m) => suma + m.monto, 0);
}
