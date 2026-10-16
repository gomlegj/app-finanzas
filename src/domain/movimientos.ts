import type { TipoCategoria } from './categorias';

export type TipoMovimiento = TipoCategoria;

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  monto: number;
  categoriaId: string;
  /** 'YYYY-MM-DD' en hora local */
  fecha: string;
  nota?: string;
}

export interface OrigenMovimiento {
  tipo: 'fijo' | 'deuda' | 'meta';
  id: string;
}

export interface Movimiento extends DatosMovimiento {
  id: string;
  origen?: OrigenMovimiento;
  /** Momento de registro (ms) según el servidor; ausente si aún no se sincroniza. */
  registradoEn?: number;
}

export interface FormularioMovimiento {
  tipo: TipoMovimiento;
  monto: number | null;
  categoriaId: string;
  fecha: string;
  nota: string;
}

export type ErroresMovimiento = Partial<Record<'monto' | 'categoriaId' | 'fecha' | 'nota', string>>;

export const MAX_NOTA = 200;

export function validarMovimiento(f: FormularioMovimiento): ErroresMovimiento {
  const errores: ErroresMovimiento = {};
  if (f.monto === null || f.monto <= 0) errores.monto = 'Escribe un monto mayor a 0';
  if (!f.categoriaId) errores.categoriaId = 'Elige una categoría';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) errores.fecha = 'Elige una fecha';
  if (f.nota.trim().length > MAX_NOTA) errores.nota = `Máximo ${MAX_NOTA} caracteres`;
  return errores;
}

export function normalizarMovimiento(f: FormularioMovimiento): DatosMovimiento {
  if (f.monto === null) throw new Error('normalizarMovimiento requiere un monto validado');
  const datos: DatosMovimiento = { tipo: f.tipo, monto: f.monto, categoriaId: f.categoriaId, fecha: f.fecha };
  const nota = f.nota.trim();
  if (nota) datos.nota = nota;
  return datos;
}

export function sumarPorTipo(movimientos: readonly DatosMovimiento[]): { gastos: number; ingresos: number } {
  const totales = { gastos: 0, ingresos: 0 };
  for (const m of movimientos) {
    if (m.tipo === 'gasto') totales.gastos += m.monto;
    else totales.ingresos += m.monto;
  }
  return totales;
}

export interface GrupoFecha {
  fecha: string;
  movimientos: Movimiento[];
}

export function agruparPorFecha(movimientos: readonly Movimiento[]): GrupoFecha[] {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    const grupo = grupos.get(m.fecha);
    if (grupo) grupo.push(m);
    else grupos.set(m.fecha, [m]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, lista]) => ({ fecha, movimientos: lista }));
}
