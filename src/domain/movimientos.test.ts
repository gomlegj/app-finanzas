import { describe, expect, it } from 'vitest';
import {
  agruparPorFecha,
  normalizarMovimiento,
  sumarPorTipo,
  validarMovimiento,
  type FormularioMovimiento,
  type Movimiento,
} from './movimientos';

const formulario = (cambios: Partial<FormularioMovimiento> = {}): FormularioMovimiento => ({
  tipo: 'gasto',
  monto: 15000,
  categoriaId: 'comida',
  fecha: '2026-10-06',
  nota: '',
  ...cambios,
});

const mov = (id: string, cambios: Partial<Movimiento> = {}): Movimiento => ({
  id,
  tipo: 'gasto',
  monto: 1000,
  categoriaId: 'comida',
  fecha: '2026-10-06',
  ...cambios,
});

describe('validarMovimiento', () => {
  it('acepta un movimiento completo', () => {
    expect(validarMovimiento(formulario())).toEqual({});
  });

  it('exige monto mayor a 0', () => {
    expect(validarMovimiento(formulario({ monto: null })).monto).toBe('Escribe un monto mayor a 0');
    expect(validarMovimiento(formulario({ monto: 0 })).monto).toBe('Escribe un monto mayor a 0');
  });

  it('exige categoría', () => {
    expect(validarMovimiento(formulario({ categoriaId: '' })).categoriaId).toBe('Elige una categoría');
  });

  it('exige fecha con formato YYYY-MM-DD', () => {
    expect(validarMovimiento(formulario({ fecha: '' })).fecha).toBe('Elige una fecha');
    expect(validarMovimiento(formulario({ fecha: '6/10/2026' })).fecha).toBe('Elige una fecha');
  });

  it('limita la nota a 200 caracteres', () => {
    expect(validarMovimiento(formulario({ nota: 'x'.repeat(201) })).nota).toBe('Máximo 200 caracteres');
    expect(validarMovimiento(formulario({ nota: 'x'.repeat(200) })).nota).toBeUndefined();
  });
});

describe('normalizarMovimiento', () => {
  it('recorta la nota', () => {
    expect(normalizarMovimiento(formulario({ nota: '  almuerzo  ' })).nota).toBe('almuerzo');
  });

  it('omite la nota vacía en vez de dejarla undefined o ""', () => {
    const datos = normalizarMovimiento(formulario({ nota: '   ' }));
    expect(datos).not.toHaveProperty('nota');
    expect(datos).toEqual({ tipo: 'gasto', monto: 15000, categoriaId: 'comida', fecha: '2026-10-06' });
  });

  it('lanza si el monto no fue validado', () => {
    expect(() => normalizarMovimiento(formulario({ monto: null }))).toThrow();
  });
});

describe('sumarPorTipo', () => {
  it('suma gastos e ingresos por separado', () => {
    const lista = [mov('a', { monto: 1000 }), mov('b', { monto: 2500 }), mov('c', { tipo: 'ingreso', monto: 50000 })];
    expect(sumarPorTipo(lista)).toEqual({ gastos: 3500, ingresos: 50000 });
  });

  it('devuelve ceros con lista vacía', () => {
    expect(sumarPorTipo([])).toEqual({ gastos: 0, ingresos: 0 });
  });
});

describe('agruparPorFecha', () => {
  it('agrupa por fecha en orden descendente y conserva el orden dentro del día', () => {
    const lista = [
      mov('a', { fecha: '2026-10-05' }),
      mov('b', { fecha: '2026-10-06' }),
      mov('c', { fecha: '2026-10-05' }),
    ];
    const grupos = agruparPorFecha(lista);
    expect(grupos.map((g) => g.fecha)).toEqual(['2026-10-06', '2026-10-05']);
    expect(grupos[1].movimientos.map((m) => m.id)).toEqual(['a', 'c']);
  });
});
