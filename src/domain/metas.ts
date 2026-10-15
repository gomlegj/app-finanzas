import type { Movimiento } from './movimientos';

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
