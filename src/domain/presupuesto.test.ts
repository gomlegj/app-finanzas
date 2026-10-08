import { describe, expect, it } from 'vitest';
import type { DatosMovimiento } from './movimientos';
import { gastoPorCategoria, resumenQuincena } from './presupuesto';

const gasto = (categoriaId: string, monto: number): DatosMovimiento => ({ tipo: 'gasto', monto, categoriaId, fecha: '2026-10-06' });
const ingreso = (monto: number): DatosMovimiento => ({ tipo: 'ingreso', monto, categoriaId: 'salario', fecha: '2026-10-06' });

describe('resumenQuincena', () => {
  it('disponible = ingresos − gastado − comprometido', () => {
    const lista = [ingreso(2000000), gasto('comida', 300000), gasto('transporte', 50000)];
    expect(resumenQuincena(lista, 100000)).toEqual({ ingresos: 2000000, gastado: 350000, comprometido: 100000, disponible: 1550000 });
  });

  it('comprometido es 0 por defecto y el disponible puede ser negativo', () => {
    expect(resumenQuincena([gasto('comida', 1000)])).toEqual({ ingresos: 0, gastado: 1000, comprometido: 0, disponible: -1000 });
  });
});

describe('gastoPorCategoria', () => {
  it('suma solo gastos por categoría, de mayor a menor, con porcentaje', () => {
    const lista = [gasto('comida', 300), gasto('transporte', 100), gasto('comida', 200), ingreso(9999)];
    const resultado = gastoPorCategoria(lista);
    expect(resultado.map((g) => [g.categoriaId, g.total])).toEqual([['comida', 500], ['transporte', 100]]);
    expect(resultado[0].porcentaje).toBeCloseTo(83.33, 2);
    expect(resultado.reduce((s, g) => s + g.porcentaje, 0)).toBeCloseTo(100, 6);
  });

  it('desempata por id para un orden estable', () => {
    expect(gastoPorCategoria([gasto('b', 100), gasto('a', 100)]).map((g) => g.categoriaId)).toEqual(['a', 'b']);
  });

  it('lista vacía o solo ingresos da []', () => {
    expect(gastoPorCategoria([])).toEqual([]);
    expect(gastoPorCategoria([ingreso(5)])).toEqual([]);
  });
});
