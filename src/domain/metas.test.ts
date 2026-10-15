import { describe, expect, it } from 'vitest';
import { ahorrado, cumplida, normalizarMeta, progreso, validarMeta, type FormularioMeta, type Meta } from './metas';
import type { Movimiento } from './movimientos';

const HOY = { hoy: '2026-10-15', creando: true };

const formulario = (cambios: Partial<FormularioMeta> = {}): FormularioMeta => ({
  nombre: 'Viaje',
  icono: '✈️',
  color: '#3b82f6',
  objetivo: 3000000,
  ahorroInicial: null,
  modo: 'fecha',
  fechaObjetivo: '2027-06-15',
  cuotaQuincenal: null,
  ...cambios,
});

const meta = (id: string, cambios: Partial<Meta> = {}): Meta => ({
  id,
  nombre: id,
  icono: '✈️',
  color: '#3b82f6',
  objetivo: 1000000,
  ahorroInicial: 0,
  modo: 'cuota',
  cuotaQuincenal: 150000,
  archivada: false,
  ...cambios,
});

const mov = (id: string, metaId: string, tipo: 'gasto' | 'ingreso', monto: number, fecha = '2026-10-20'): Movimiento => ({
  id,
  tipo,
  monto,
  categoriaId: tipo === 'gasto' ? 'ahorro' : 'retiro-ahorro',
  fecha,
  origen: { tipo: 'meta', id: metaId },
});

describe('validarMeta', () => {
  it('acepta una meta por fecha y una por cuota', () => {
    expect(validarMeta(formulario(), HOY)).toEqual({});
    expect(validarMeta(formulario({ modo: 'cuota', fechaObjetivo: '', cuotaQuincenal: 150000 }), HOY)).toEqual({});
  });

  it('exige nombre y objetivo', () => {
    expect(validarMeta(formulario({ nombre: '  ' }), HOY).nombre).toBe('Escribe un nombre');
    expect(validarMeta(formulario({ nombre: 'x'.repeat(41) }), HOY).nombre).toBe('Máximo 40 caracteres');
    expect(validarMeta(formulario({ objetivo: null }), HOY).objetivo).toBe('Escribe un objetivo mayor a 0');
    expect(validarMeta(formulario({ objetivo: 0 }), HOY).objetivo).toBe('Escribe un objetivo mayor a 0');
  });

  it('el ahorro inicial debe ser menor que el objetivo', () => {
    expect(validarMeta(formulario({ ahorroInicial: 3000000 }), HOY).ahorroInicial).toBe('Debe ser menor que el objetivo');
    expect(validarMeta(formulario({ ahorroInicial: 2999999 }), HOY)).toEqual({});
  });

  it('modo fecha exige una fecha futura solo al crear', () => {
    expect(validarMeta(formulario({ fechaObjetivo: '' }), HOY).fechaObjetivo).toBe('Elige una fecha');
    expect(validarMeta(formulario({ fechaObjetivo: '2026-10-15' }), HOY).fechaObjetivo).toBe('Elige una fecha futura');
    expect(validarMeta(formulario({ fechaObjetivo: '2026-10-01' }), { hoy: '2026-10-15', creando: false })).toEqual({});
  });

  it('modo cuota exige cuota mayor a 0', () => {
    const f = formulario({ modo: 'cuota', fechaObjetivo: '' });
    expect(validarMeta({ ...f, cuotaQuincenal: null }, HOY).cuotaQuincenal).toBe('Escribe una cuota mayor a 0');
    expect(validarMeta({ ...f, cuotaQuincenal: 0 }, HOY).cuotaQuincenal).toBe('Escribe una cuota mayor a 0');
  });
});

describe('normalizarMeta', () => {
  it('recorta el nombre, pone ahorro inicial 0 si está vacío y deja solo el campo del modo', () => {
    expect(normalizarMeta(formulario({ nombre: ' Viaje ', cuotaQuincenal: 5 }))).toEqual({
      nombre: 'Viaje',
      icono: '✈️',
      color: '#3b82f6',
      objetivo: 3000000,
      ahorroInicial: 0,
      modo: 'fecha',
      fechaObjetivo: '2027-06-15',
    });
    const porCuota = normalizarMeta(formulario({ modo: 'cuota', cuotaQuincenal: 150000, ahorroInicial: 200000 }));
    expect(porCuota).toMatchObject({ modo: 'cuota', cuotaQuincenal: 150000, ahorroInicial: 200000 });
    expect(porCuota).not.toHaveProperty('fechaObjetivo');
  });

  it('lanza si el objetivo no fue validado', () => {
    expect(() => normalizarMeta(formulario({ objetivo: null }))).toThrow();
  });
});

describe('ahorrado', () => {
  it('suma ahorro inicial y abonos, y resta retiros, solo de esa meta', () => {
    const movimientos = [
      mov('m1', 'viaje', 'gasto', 100000),
      mov('m2', 'viaje', 'gasto', 50000),
      mov('m3', 'viaje', 'ingreso', 30000),
      mov('m4', 'otra', 'gasto', 999999),
      { ...mov('m5', 'viaje', 'gasto', 777), origen: { tipo: 'fijo' as const, id: 'viaje' } },
      { ...mov('m6', 'viaje', 'gasto', 888), origen: undefined },
    ];
    expect(ahorrado(meta('viaje', { ahorroInicial: 200000 }), movimientos)).toBe(320000);
  });
});

describe('progreso y cumplida', () => {
  it('progreso entero entre 0 y 100', () => {
    expect(progreso(meta('a'), 0)).toBe(0);
    expect(progreso(meta('a'), 333333)).toBe(33);
    expect(progreso(meta('a'), 999999)).toBe(99);
    expect(progreso(meta('a'), 1500000)).toBe(100);
    expect(progreso(meta('a'), -5000)).toBe(0);
  });

  it('cumplida cuando lo ahorrado llega al objetivo', () => {
    expect(cumplida(meta('a'), 999999)).toBe(false);
    expect(cumplida(meta('a'), 1000000)).toBe(true);
  });
});
