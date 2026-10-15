import { describe, expect, it } from 'vitest';
import {
  ahorrado,
  cuotaDeQuincena,
  cumplida,
  fechaEstimada,
  normalizarMeta,
  progreso,
  validarMeta,
  type FormularioMeta,
  type Meta,
} from './metas';
import type { Movimiento } from './movimientos';
import { quincenaDe } from './quincena';

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

const DIAS: [number, number] = [15, 30];
const Q_OCT = quincenaDe('2026-10-15', DIAS); // 15 oct → 29 oct

describe('cuotaDeQuincena', () => {
  it('modo cuota: la cuota, pero nunca más de lo que falta', () => {
    const m = meta('a', { objetivo: 1000000, cuotaQuincenal: 150000 });
    expect(cuotaDeQuincena(m, 0, Q_OCT, DIAS)).toBe(150000);
    expect(cuotaDeQuincena(m, 900000, Q_OCT, DIAS)).toBe(100000);
    expect(cuotaDeQuincena(m, 1000000, Q_OCT, DIAS)).toBe(0);
  });

  it('modo fecha: reparte lo que falta entre las quincenas restantes, cruzando de año', () => {
    // 15–29 oct, 30 oct–14 nov, 15–29 nov, 30 nov–14 dic, 15–29 dic, 30 dic–14 ene (contiene 31 dic) → 6
    const m = meta('a', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2026-12-31', objetivo: 600000 });
    expect(cuotaDeQuincena(m, 0, Q_OCT, DIAS)).toBe(100000);
  });

  it('modo fecha redondea hacia arriba', () => {
    const m = meta('a', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2026-11-10', objetivo: 100001 });
    expect(cuotaDeQuincena(m, 0, Q_OCT, DIAS)).toBe(50001);
  });

  it('modo fecha en febrero (pago del 30 cae el 28)', () => {
    const qFeb = quincenaDe('2026-02-20', DIAS); // 15 feb → 27 feb
    const m = meta('a', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2026-03-10', objetivo: 200000 });
    expect(cuotaDeQuincena(m, 0, qFeb, DIAS)).toBe(100000);
  });

  it('si la fecha cae en la quincena actual o ya pasó, toca todo lo que falta', () => {
    const enEsta = meta('a', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2026-10-20', objetivo: 500000 });
    const vencida = meta('b', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2026-09-01', objetivo: 500000 });
    expect(cuotaDeQuincena(enEsta, 100000, Q_OCT, DIAS)).toBe(400000);
    expect(cuotaDeQuincena(vencida, 100000, Q_OCT, DIAS)).toBe(400000);
  });
});

describe('fechaEstimada', () => {
  it('modo cuota: fin de la quincena en que se llega', () => {
    const m = meta('a', { objetivo: 600000, cuotaQuincenal: 150000 });
    expect(fechaEstimada(m, 0, Q_OCT, DIAS)).toBe('2026-12-14'); // 4 quincenas
    expect(fechaEstimada(m, 500000, Q_OCT, DIAS)).toBe('2026-10-29'); // falta 100.000 → esta misma
  });

  it('sin faltante o en modo fecha no hay fecha estimada', () => {
    expect(fechaEstimada(meta('a', { objetivo: 600000 }), 600000, Q_OCT, DIAS)).toBeNull();
    const porFecha = meta('b', { modo: 'fecha', cuotaQuincenal: undefined, fechaObjetivo: '2027-01-01' });
    expect(fechaEstimada(porFecha, 0, Q_OCT, DIAS)).toBeNull();
  });
});
