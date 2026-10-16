import { parseISO } from 'date-fns';
import { proximaFecha } from './calendario';
import { ID_DEUDAS } from './categorias';
import { fechaEnMes, fechaLocalISO } from './fechas';
import { ordenarPendientes, resumirPagos, type Pendiente } from './fijos';
import type { Movimiento } from './movimientos';
import type { Quincena } from './quincena';

export type TipoDeuda = 'tarjeta' | 'prestamo' | 'otro';

export interface DatosDeudaEditable {
  nombre: string;
  tipo: TipoDeuda;
  cuota: number;
  /** Día del mes en que vence la cuota (1–31). */
  diaPago: number;
}

export interface DatosDeuda extends DatosDeudaEditable {
  /** Último saldo conocido (al crear o al actualizar con el extracto). */
  saldoBase: number;
  /** Momento (ms, hora del servidor) en que se registró `saldoBase`. */
  saldoBaseEn: number;
  archivada: boolean;
}

export interface Deuda extends DatosDeuda {
  id: string;
}

export interface FormularioDeuda {
  nombre: string;
  tipo: TipoDeuda;
  /** Solo al crear. */
  saldo: number | null;
  cuota: number | null;
  diaPago: number | null;
}

export type ErroresDeuda = Partial<Record<'nombre' | 'saldo' | 'cuota' | 'diaPago', string>>;

export const MAX_NOMBRE_DEUDA = 40;

export const ICONO_TIPO_DEUDA: Record<TipoDeuda, string> = { tarjeta: '💳', prestamo: '🏦', otro: '📄' };
export const ETIQUETA_TIPO_DEUDA: Record<TipoDeuda, string> = { tarjeta: 'Tarjeta', prestamo: 'Préstamo', otro: 'Otro' };
export const COLOR_DEUDA = '#64748b';

export function validarDeuda(f: FormularioDeuda, { creando }: { creando: boolean }): ErroresDeuda {
  const errores: ErroresDeuda = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_DEUDA) errores.nombre = `Máximo ${MAX_NOMBRE_DEUDA} caracteres`;
  if (creando && (f.saldo === null || f.saldo <= 0)) errores.saldo = 'Escribe un saldo mayor a 0';
  if (f.cuota === null || f.cuota <= 0) errores.cuota = 'Escribe una cuota mayor a 0';
  if (f.diaPago === null || !Number.isInteger(f.diaPago) || f.diaPago < 1 || f.diaPago > 31) {
    errores.diaPago = 'Usa un día entre 1 y 31';
  }
  return errores;
}

export function normalizarDeuda(f: FormularioDeuda): DatosDeudaEditable {
  if (f.cuota === null || f.diaPago === null) throw new Error('normalizarDeuda requiere cuota y día validados');
  return { nombre: f.nombre.trim(), tipo: f.tipo, cuota: f.cuota, diaPago: f.diaPago };
}

export function validarSaldo(monto: number | null): string | null {
  return monto === null || monto < 0 ? 'Escribe el saldo (puede ser 0)' : null;
}

export const esPagoDe = (m: Movimiento, deudaId: string) =>
  m.tipo === 'gasto' && m.origen?.tipo === 'deuda' && m.origen.id === deudaId;

/** Saldo base menos los pagos registrados después de él (los no sincronizados cuentan). Nunca < 0. */
export function saldo(deuda: Pick<Deuda, 'id' | 'saldoBase' | 'saldoBaseEn'>, movimientos: readonly Movimiento[]): number {
  let total = deuda.saldoBase;
  for (const m of movimientos) {
    if (!esPagoDe(m, deuda.id)) continue;
    if (m.registradoEn !== undefined && m.registradoEn <= deuda.saldoBaseEn) continue;
    total -= m.monto;
  }
  return Math.max(0, total);
}

export function cuotasEstimadas(deuda: Pick<Deuda, 'cuota'>, saldoActual: number): number {
  return saldoActual <= 0 ? 0 : Math.ceil(saldoActual / deuda.cuota);
}

/** Lo que falta de la cuota de esta quincena, sin pasar el saldo. */
export function sugerenciaDePago(deuda: Pick<Deuda, 'cuota'>, saldoActual: number, pagadoEnQuincena: number): number {
  return Math.min(Math.max(0, deuda.cuota - pagadoEnQuincena), saldoActual);
}

export function proximoPago(deuda: Pick<Deuda, 'diaPago'>, hoy: Date = new Date()): string {
  return proximaFecha([deuda.diaPago], hoy);
}

/** Fecha de vencimiento dentro de la quincena (mes de inicio o de fin), o `null`. */
export function venceEnQuincena(diaPago: number, quincena: Quincena): string | null {
  for (const iso of [quincena.desde, quincena.hasta]) {
    const base = parseISO(iso);
    const vence = fechaLocalISO(fechaEnMes(base.getFullYear(), base.getMonth(), diaPago));
    if (vence >= quincena.desde && vence <= quincena.hasta) return vence;
  }
  return null;
}

const enQuincena = (m: Movimiento, q: Quincena) => m.fecha >= q.desde && m.fecha <= q.hasta;

export function pagadoEnQuincena(deuda: Pick<Deuda, 'id'>, movimientos: readonly Movimiento[], quincena: Quincena): number {
  return movimientos.filter((m) => esPagoDe(m, deuda.id) && enQuincena(m, quincena)).reduce((s, m) => s + m.monto, 0);
}

/** Cuotas de las deudas que vencen en `quincena`. `movimientosDeDeudas`: pagos de cualquier fecha. */
export function pendientesDeDeudas(
  deudas: readonly Deuda[],
  quincena: Quincena,
  movimientosDeDeudas: readonly Movimiento[],
): Pendiente[] {
  const resultado: Pendiente[] = [];
  for (const deuda of deudas) {
    if (deuda.archivada) continue;
    const vence = venceEnQuincena(deuda.diaPago, quincena);
    if (!vence) continue;
    // Saldo copiado del extracto después del vencimiento: esa cuota ya está incluida en él.
    if (fechaLocalISO(new Date(deuda.saldoBaseEn)) > vence) continue;
    const propios = movimientosDeDeudas.filter((m) => esPagoDe(m, deuda.id));
    const alInicio = saldo(deuda, propios.filter((m) => m.fecha < quincena.desde));
    if (alInicio === 0) continue;
    const pagos = propios.filter((m) => enQuincena(m, quincena));
    const pendiente: Pendiente = {
      origen: { tipo: 'deuda', id: deuda.id },
      nombre: deuda.nombre,
      categoriaId: ID_DEUDAS,
      icono: ICONO_TIPO_DEUDA[deuda.tipo],
      color: COLOR_DEUDA,
      planeado: Math.min(deuda.cuota, alInicio),
    };
    if (pagos.length > 0) pendiente.pagado = resumirPagos(pagos);
    resultado.push(pendiente);
  }
  return ordenarPendientes(resultado);
}
