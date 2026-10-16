export type TipoCategoria = 'gasto' | 'ingreso';

export interface DatosCategoria {
  nombre: string;
  icono: string;
  color: string;
  tipo: TipoCategoria;
  orden: number;
  sistema: boolean;
  archivada: boolean;
}

export interface Categoria extends DatosCategoria {
  id: string;
}

const MAX_NOMBRE = 40;

export const ID_AHORRO = 'ahorro';
export const ID_RETIRO_AHORRO = 'retiro-ahorro';
export const ID_DEUDAS = 'deudas';

function crear(tipo: TipoCategoria, id: string, nombre: string, icono: string, color: string, orden: number, sistema = false): Categoria {
  return { id, nombre, icono, color, tipo, orden, sistema, archivada: false };
}

export const CATEGORIAS_POR_DEFECTO: readonly Categoria[] = [
  crear('gasto', 'comida', 'Comida', '🍔', '#f97316', 0),
  crear('gasto', 'transporte', 'Transporte / Pasajes', '🚌', '#3b82f6', 1),
  crear('gasto', 'arriendo', 'Arriendo', '🏠', '#8b5cf6', 2),
  crear('gasto', 'servicios', 'Servicios', '💡', '#eab308', 3),
  crear('gasto', 'salud', 'Salud', '🩺', '#ef4444', 4),
  crear('gasto', 'entretenimiento', 'Entretenimiento', '🎬', '#ec4899', 5),
  crear('gasto', 'ropa', 'Ropa', '👕', '#14b8a6', 6),
  crear('gasto', 'educacion', 'Educación', '📚', '#6366f1', 7),
  crear('gasto', ID_DEUDAS, 'Deudas', '💳', '#64748b', 8, true),
  crear('gasto', ID_AHORRO, 'Ahorro', '🐿️', '#10b981', 9, true),
  crear('gasto', 'otros-gasto', 'Otros', '📦', '#94a3b8', 10),
  crear('ingreso', 'salario', 'Salario', '💼', '#10b981', 0),
  crear('ingreso', 'extra', 'Extra', '✨', '#f59e0b', 1),
  crear('ingreso', 'otros-ingreso', 'Otros', '💰', '#84cc16', 2),
  crear('ingreso', ID_RETIRO_AHORRO, 'Retiro de ahorro', '💸', '#10b981', 3, true),
];

export const ICONOS_DISPONIBLES: readonly string[] = [
  '🍔', '🛒', '☕', '🚌', '🚕', '⛽', '🏠',
  '💡', '📱', '🩺', '💊', '🎬', '🎮', '👕',
  '💇', '📚', '🎁', '🐶', '✈️', '💳', '🐿️',
  '📦', '💼', '✨', '💰', '🏦', '🧾', '❤️',
];

export const COLORES_DISPONIBLES: readonly string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#94a3b8',
];

export function categoriasActivas(categorias: readonly Categoria[], tipo: TipoCategoria): Categoria[] {
  return categorias.filter((c) => c.tipo === tipo && !c.archivada).sort((a, b) => a.orden - b.orden);
}

export function validarNombreCategoria(
  nombre: string,
  existentes: readonly Categoria[],
  tipo: TipoCategoria,
  idActual?: string,
): string | null {
  const limpio = nombre.trim();
  if (!limpio) return 'Escribe un nombre';
  if (limpio.length > MAX_NOMBRE) return `Máximo ${MAX_NOMBRE} caracteres`;
  const clave = limpio.toLocaleLowerCase('es');
  const repetida = existentes.some(
    (c) => c.tipo === tipo && c.id !== idActual && c.nombre.trim().toLocaleLowerCase('es') === clave,
  );
  return repetida ? 'Ya existe una categoría con ese nombre' : null;
}

export function siguienteOrden(categorias: readonly Categoria[], tipo: TipoCategoria): number {
  return Math.max(-1, ...categorias.filter((c) => c.tipo === tipo).map((c) => c.orden)) + 1;
}
