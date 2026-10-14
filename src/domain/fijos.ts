export type Frecuencia = 'mensual' | 'quincenal';
export type NumeroQuincena = 1 | 2;

export interface DatosFijo {
  nombre: string;
  monto: number;
  categoriaId: string;
  frecuencia: Frecuencia;
  /** Solo si `frecuencia === 'mensual'`. */
  quincena?: NumeroQuincena;
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
  activo: boolean;
}

export type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId', string>>;

export const MAX_NOMBRE_FIJO = 40;

export function validarFijo(f: FormularioFijo): ErroresFijo {
  const errores: ErroresFijo = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_FIJO) errores.nombre = `Máximo ${MAX_NOMBRE_FIJO} caracteres`;
  if (f.monto === null || f.monto <= 0) errores.monto = 'Escribe un monto mayor a 0';
  if (!f.categoriaId) errores.categoriaId = 'Elige una categoría';
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
  if (f.frecuencia === 'mensual') datos.quincena = f.quincena;
  return datos;
}

export function etiquetaFrecuencia(fijo: DatosFijo): string {
  return fijo.frecuencia === 'quincenal' ? 'Quincenal' : `Mensual · Q${fijo.quincena ?? 1}`;
}

export function aplicaEnQuincena(fijo: DatosFijo, numero: NumeroQuincena): boolean {
  return fijo.frecuencia === 'quincenal' || fijo.quincena === numero;
}

export const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

export function ordenarFijos(fijos: readonly Fijo[]): Fijo[] {
  return [...fijos].sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}
