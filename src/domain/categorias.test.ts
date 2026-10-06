import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_POR_DEFECTO,
  categoriasActivas,
  siguienteOrden,
  validarNombreCategoria,
  type Categoria,
} from './categorias';

const cat = (cambios: Partial<Categoria>): Categoria => ({
  id: 'x',
  nombre: 'X',
  icono: '📦',
  color: '#94a3b8',
  tipo: 'gasto',
  orden: 0,
  sistema: false,
  archivada: false,
  ...cambios,
});

describe('CATEGORIAS_POR_DEFECTO', () => {
  it('tiene ids únicos', () => {
    const ids = CATEGORIAS_POR_DEFECTO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('incluye Ahorro y Deudas como categorías de sistema', () => {
    const sistema = CATEGORIAS_POR_DEFECTO.filter((c) => c.sistema).map((c) => c.id).sort();
    expect(sistema).toEqual(['ahorro', 'deudas']);
  });

  it('incluye gastos e ingresos', () => {
    expect(CATEGORIAS_POR_DEFECTO.some((c) => c.tipo === 'gasto')).toBe(true);
    expect(CATEGORIAS_POR_DEFECTO.some((c) => c.tipo === 'ingreso')).toBe(true);
  });
});

describe('categoriasActivas', () => {
  it('filtra por tipo, oculta archivadas y ordena por orden', () => {
    const lista = [
      cat({ id: 'b', orden: 2 }),
      cat({ id: 'a', orden: 1 }),
      cat({ id: 'arch', orden: 0, archivada: true }),
      cat({ id: 'ing', tipo: 'ingreso', orden: 0 }),
    ];
    expect(categoriasActivas(lista, 'gasto').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('no modifica la lista original', () => {
    const lista = [cat({ id: 'b', orden: 2 }), cat({ id: 'a', orden: 1 })];
    categoriasActivas(lista, 'gasto');
    expect(lista.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('validarNombreCategoria', () => {
  const existentes = [cat({ id: 'comida', nombre: 'Comida' }), cat({ id: 'sal', nombre: 'Salario', tipo: 'ingreso' })];

  it('exige nombre', () => {
    expect(validarNombreCategoria('', existentes, 'gasto')).toBe('Escribe un nombre');
    expect(validarNombreCategoria('   ', existentes, 'gasto')).toBe('Escribe un nombre');
  });

  it('limita a 40 caracteres', () => {
    expect(validarNombreCategoria('a'.repeat(41), existentes, 'gasto')).toBe('Máximo 40 caracteres');
    expect(validarNombreCategoria('a'.repeat(40), existentes, 'gasto')).toBeNull();
  });

  it('no permite repetidos del mismo tipo, sin importar mayúsculas ni espacios', () => {
    expect(validarNombreCategoria(' comida ', existentes, 'gasto')).toBe('Ya existe una categoría con ese nombre');
  });

  it('permite el mismo nombre en otro tipo', () => {
    expect(validarNombreCategoria('Salario', existentes, 'gasto')).toBeNull();
  });

  it('permite conservar el nombre al editar la misma categoría', () => {
    expect(validarNombreCategoria('Comida', existentes, 'gasto', 'comida')).toBeNull();
  });
});

describe('siguienteOrden', () => {
  it('es uno más que el mayor del mismo tipo', () => {
    const lista = [cat({ orden: 3 }), cat({ orden: 7 }), cat({ orden: 50, tipo: 'ingreso' })];
    expect(siguienteOrden(lista, 'gasto')).toBe(8);
  });

  it('es 0 si no hay categorías de ese tipo', () => {
    expect(siguienteOrden([], 'ingreso')).toBe(0);
  });
});
