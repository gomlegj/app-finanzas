import { sumarPorTipo, type DatosMovimiento } from './movimientos';

export interface ResumenQuincena {
  ingresos: number;
  gastado: number;
  comprometido: number;
  disponible: number;
}

export function resumenQuincena(movimientos: readonly DatosMovimiento[], comprometido = 0): ResumenQuincena {
  const { ingresos, gastos } = sumarPorTipo(movimientos);
  return { ingresos, gastado: gastos, comprometido, disponible: ingresos - gastos - comprometido };
}

export interface GastoCategoria {
  categoriaId: string;
  total: number;
  porcentaje: number;
}

export function gastoPorCategoria(movimientos: readonly DatosMovimiento[]): GastoCategoria[] {
  const totales = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo === 'gasto') totales.set(m.categoriaId, (totales.get(m.categoriaId) ?? 0) + m.monto);
  }
  const suma = [...totales.values()].reduce((a, b) => a + b, 0);
  return [...totales.entries()]
    .map(([categoriaId, total]) => ({ categoriaId, total, porcentaje: (total / suma) * 100 }))
    .sort((a, b) => b.total - a.total || a.categoriaId.localeCompare(b.categoriaId));
}
