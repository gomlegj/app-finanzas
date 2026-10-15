import type { Movimiento } from './movimientos';
import type { Quincena } from './quincena';

export type Frecuencia = 'mensual' | 'quincenal';
export type NumeroQuincena = 1 | 2;

export interface DatosFijo {
  nombre: string;
  monto: number;
  categoriaId: string;
  frecuencia: Frecuencia;
  /** Solo si `frecuencia === 'mensual'`. */
  quincena?: NumeroQuincena;
  /** Día en que vence (1–31), solo si es mensual. Solo para el recordatorio. */
  diaPago?: number;
  activo: boolean;
}

export interface Fijo extends DatosFijo {
  id: string;
}

export interface FormularioFijo {
  nombre: string;
  monto: number | null;
  categoriaId: string;
  frecuencia: Frecuencia;
  /** Se ignora si la frecuencia es quincenal. */
  quincena: NumeroQuincena;
  /** `null` = sin día. Se ignora si la frecuencia es quincenal. */
  diaPago: number | null;
  activo: boolean;
}

export type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId' | 'diaPago', string>>;

export const MAX_NOMBRE_FIJO = 40;

export function validarFijo(f: FormularioFijo): ErroresFijo {
  const errores: ErroresFijo = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_FIJO) errores.nombre = `Máximo ${MAX_NOMBRE_FIJO} caracteres`;
  if (f.monto === null || f.monto <= 0) errores.monto = 'Escribe un monto mayor a 0';
  if (!f.categoriaId) errores.categoriaId = 'Elige una categoría';
  const diaValido = f.diaPago === null || (Number.isInteger(f.diaPago) && f.diaPago >= 1 && f.diaPago <= 31);
  if (f.frecuencia === 'mensual' && !diaValido) errores.diaPago = 'Usa un día entre 1 y 31';
  return errores;
}

export function normalizarFijo(f: FormularioFijo): DatosFijo {
  if (f.monto === null) throw new Error('normalizarFijo requiere un monto validado');
  const datos: DatosFijo = {
    nombre: f.nombre.trim(),
    monto: f.monto,
    categoriaId: f.categoriaId,
    frecuencia: f.frecuencia,
    activo: f.activo,
  };
  if (f.frecuencia === 'mensual') {
    datos.quincena = f.quincena;
    if (f.diaPago !== null) datos.diaPago = f.diaPago;
  }
  return datos;
}

export function etiquetaFrecuencia(fijo: DatosFijo): string {
  return fijo.frecuencia === 'quincenal' ? 'Quincenal' : `Mensual · Q${fijo.quincena ?? 1}`;
}

export function etiquetaVencimiento(fijo: DatosFijo): string | null {
  return fijo.diaPago ? `vence el ${fijo.diaPago}` : null;
}

export function aplicaEnQuincena(fijo: DatosFijo, numero: NumeroQuincena): boolean {
  return fijo.frecuencia === 'quincenal' || fijo.quincena === numero;
}

export const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

export function ordenarFijos(fijos: readonly Fijo[]): Fijo[] {
  return [...fijos].sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}

export interface Pendiente {
  origen: { tipo: 'fijo' | 'meta'; id: string };
  nombre: string;
  categoriaId: string;
  /** Solo metas: se muestran con su propio ícono y color. */
  icono?: string;
  color?: string;
  planeado: number;
  /** Ausente si no está pagado. `movimientos`: ids del más reciente al más antiguo. */
  pagado?: { monto: number; movimientos: string[] };
}

export function resumirPagos(movimientos: readonly Movimiento[]): { monto: number; movimientos: string[] } {
  const recientes = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { monto: movimientos.reduce((suma, m) => suma + m.monto, 0), movimientos: recientes.map((m) => m.id) };
}

/** Sin pagar primero, luego pagados; cada grupo por nombre. */
export function ordenarPendientes(lista: readonly Pendiente[]): Pendiente[] {
  return [...lista].sort((a, b) => Number(a.pagado !== undefined) - Number(b.pagado !== undefined) || porNombre(a, b));
}

/** `movimientos` deben ser solo los de `quincena`. */
export function pendientesDeQuincena(
  fijos: readonly Fijo[],
  quincena: Pick<Quincena, 'numero'>,
  movimientos: readonly Movimiento[],
): Pendiente[] {
  const pagos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    // Un pago siempre es gasto; si se editó a ingreso deja de contar como pago.
    if (m.tipo !== 'gasto' || m.origen?.tipo !== 'fijo') continue;
    const lista = pagos.get(m.origen.id);
    if (lista) lista.push(m);
    else pagos.set(m.origen.id, [m]);
  }

  const resultado: Pendiente[] = [];
  for (const fijo of fijos) {
    if (!aplicaEnQuincena(fijo, quincena.numero)) continue;
    const lista = pagos.get(fijo.id);
    // Pausado y sin pagar: ya no se espera. Pausado pero pagado: se conserva lo ocurrido.
    if (!fijo.activo && !lista) continue;
    const pendiente: Pendiente = {
      origen: { tipo: 'fijo', id: fijo.id },
      nombre: fijo.nombre,
      categoriaId: fijo.categoriaId,
      planeado: fijo.monto,
    };
    if (lista) pendiente.pagado = resumirPagos(lista);
    resultado.push(pendiente);
  }

  return ordenarPendientes(resultado);
}

export function comprometido(pendientes: readonly Pendiente[]): number {
  return pendientes.reduce((suma, p) => (p.pagado ? suma : suma + p.planeado), 0);
}
