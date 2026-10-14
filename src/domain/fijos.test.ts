import { describe, expect, it } from 'vitest';
import {
  aplicaEnQuincena,
  etiquetaFrecuencia,
  normalizarFijo,
  ordenarFijos,
  validarFijo,
  type Fijo,
  type FormularioFijo,
} from './fijos';

const formulario = (cambios: Partial<FormularioFijo> = {}): FormularioFijo => ({
  nombre: 'Arriendo',
  monto: 900000,
  categoriaId: 'arriendo',
  frecuencia: 'mensual',
  quincena: 1,
  activo: true,
  ...cambios,
});

const fijo = (id: string, cambios: Partial<Fijo> = {}): Fijo => ({
  id,
  nombre: id,
  monto: 1000,
  categoriaId: 'servicios',
  frecuencia: 'quincenal',
  activo: true,
  ...cambios,
});

describe('validarFijo', () => {
  it('acepta un fijo completo', () => {
    expect(validarFijo(formulario())).toEqual({});
  });

  it('exige nombre sin contar espacios y con máximo 40 caracteres', () => {
    expect(validarFijo(formulario({ nombre: '   ' })).nombre).toBe('Escribe un nombre');
    expect(validarFijo(formulario({ nombre: 'x'.repeat(41) })).nombre).toBe('Máximo 40 caracteres');
    expect(validarFijo(formulario({ nombre: ` ${'x'.repeat(40)} ` }))).toEqual({});
  });

  it('exige monto mayor a 0 y categoría', () => {
    expect(validarFijo(formulario({ monto: null })).monto).toBe('Escribe un monto mayor a 0');
    expect(validarFijo(formulario({ monto: 0 })).monto).toBe('Escribe un monto mayor a 0');
    expect(validarFijo(formulario({ categoriaId: '' })).categoriaId).toBe('Elige una categoría');
  });
});

describe('normalizarFijo', () => {
  it('recorta el nombre y guarda la quincena si es mensual', () => {
    expect(normalizarFijo(formulario({ nombre: '  Arriendo ', quincena: 2 }))).toEqual({
      nombre: 'Arriendo',
      monto: 900000,
      categoriaId: 'arriendo',
      frecuencia: 'mensual',
      quincena: 2,
      activo: true,
    });
  });

  it('no guarda quincena si es quincenal', () => {
    expect(normalizarFijo(formulario({ frecuencia: 'quincenal', quincena: 2 }))).not.toHaveProperty('quincena');
  });

  it('lanza si el monto no fue validado', () => {
    expect(() => normalizarFijo(formulario({ monto: null }))).toThrow();
  });
});

describe('etiquetaFrecuencia', () => {
  it('describe la frecuencia', () => {
    expect(etiquetaFrecuencia(fijo('a'))).toBe('Quincenal');
    expect(etiquetaFrecuencia(fijo('a', { frecuencia: 'mensual', quincena: 1 }))).toBe('Mensual · Q1');
    expect(etiquetaFrecuencia(fijo('a', { frecuencia: 'mensual', quincena: 2 }))).toBe('Mensual · Q2');
  });
});

describe('aplicaEnQuincena', () => {
  it('quincenal aplica en ambas; mensual solo en la suya', () => {
    expect(aplicaEnQuincena(fijo('a'), 1)).toBe(true);
    expect(aplicaEnQuincena(fijo('a'), 2)).toBe(true);
    const mensual = fijo('b', { frecuencia: 'mensual', quincena: 2 });
    expect(aplicaEnQuincena(mensual, 1)).toBe(false);
    expect(aplicaEnQuincena(mensual, 2)).toBe(true);
  });
});

describe('ordenarFijos', () => {
  it('activos primero y pausados al final, cada grupo por nombre en español', () => {
    const lista = [
      fijo('1', { nombre: 'Gimnasio', activo: false }),
      fijo('2', { nombre: 'Internet' }),
      fijo('3', { nombre: 'Arriendo' }),
      fijo('4', { nombre: 'Ánimo' }),
      fijo('5', { nombre: 'Agua', activo: false }),
    ];
    expect(ordenarFijos(lista).map((f) => f.nombre)).toEqual(['Ánimo', 'Arriendo', 'Internet', 'Agua', 'Gimnasio']);
  });

  it('no modifica la lista original', () => {
    const lista = [fijo('b'), fijo('a')];
    ordenarFijos(lista);
    expect(lista.map((f) => f.id)).toEqual(['b', 'a']);
  });
});
