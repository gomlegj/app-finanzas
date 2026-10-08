import { describe, expect, it } from 'vitest';
import {
  desplazarQuincena,
  etiquetaQuincena,
  ordenarDiasPago,
  quincenaDe,
  validarDiasPago,
  type DiasPago,
} from './quincena';

const PAGO: DiasPago = [15, 30];

describe('quincenaDe con pago 15 y 30', () => {
  it.each([
    ['2026-10-06', { numero: 2, desde: '2026-09-30', hasta: '2026-10-14' }],
    ['2026-10-14', { numero: 2, desde: '2026-09-30', hasta: '2026-10-14' }],
    ['2026-10-15', { numero: 1, desde: '2026-10-15', hasta: '2026-10-29' }],
    ['2026-10-29', { numero: 1, desde: '2026-10-15', hasta: '2026-10-29' }],
    ['2026-10-30', { numero: 2, desde: '2026-10-30', hasta: '2026-11-14' }],
    ['2026-10-31', { numero: 2, desde: '2026-10-30', hasta: '2026-11-14' }],
  ])('%s', (fecha, esperada) => {
    expect(quincenaDe(fecha, PAGO)).toEqual(esperada);
  });

  it('febrero: el pago del 30 cae el último día del mes', () => {
    expect(quincenaDe('2026-02-20', PAGO)).toEqual({ numero: 1, desde: '2026-02-15', hasta: '2026-02-27' });
    expect(quincenaDe('2026-02-28', PAGO)).toEqual({ numero: 2, desde: '2026-02-28', hasta: '2026-03-14' });
    expect(quincenaDe('2026-03-05', PAGO)).toEqual({ numero: 2, desde: '2026-02-28', hasta: '2026-03-14' });
    expect(quincenaDe('2028-02-29', PAGO)).toEqual({ numero: 2, desde: '2028-02-29', hasta: '2028-03-14' });
  });

  it('cruza el año', () => {
    expect(quincenaDe('2026-12-31', PAGO)).toEqual({ numero: 2, desde: '2026-12-30', hasta: '2027-01-14' });
    expect(quincenaDe('2027-01-10', PAGO)).toEqual({ numero: 2, desde: '2026-12-30', hasta: '2027-01-14' });
  });

  it('acepta Date local aunque sea de noche', () => {
    expect(quincenaDe(new Date(2026, 9, 14, 23, 30), PAGO).hasta).toBe('2026-10-14');
  });
});

describe('quincenaDe con otros días', () => {
  it('pago 1 y 15', () => {
    expect(quincenaDe('2026-10-06', [1, 15])).toEqual({ numero: 1, desde: '2026-10-01', hasta: '2026-10-14' });
    expect(quincenaDe('2026-10-20', [1, 15])).toEqual({ numero: 2, desde: '2026-10-15', hasta: '2026-10-31' });
  });

  it('el orden de los días no importa', () => {
    expect(quincenaDe('2026-10-06', [30, 15])).toEqual(quincenaDe('2026-10-06', [15, 30]));
  });
});

describe('desplazarQuincena', () => {
  const actual = quincenaDe('2026-10-06', PAGO);

  it('avanza y retrocede una quincena', () => {
    expect(desplazarQuincena(actual, 1, PAGO)).toEqual({ numero: 1, desde: '2026-10-15', hasta: '2026-10-29' });
    expect(desplazarQuincena(actual, -1, PAGO)).toEqual({ numero: 1, desde: '2026-09-15', hasta: '2026-09-29' });
  });

  it('avanza varias quincenas y 0 no cambia nada', () => {
    expect(desplazarQuincena(actual, 2, PAGO)).toEqual({ numero: 2, desde: '2026-10-30', hasta: '2026-11-14' });
    expect(desplazarQuincena(actual, 0, PAGO)).toEqual(actual);
  });
});

describe('etiquetaQuincena', () => {
  it('muestra el rango', () => {
    expect(etiquetaQuincena({ numero: 2, desde: '2026-09-30', hasta: '2026-10-14' })).toBe('30 sep – 14 oct');
  });
});

describe('días de pago', () => {
  it('ordena ascendente', () => {
    expect(ordenarDiasPago([30, 15])).toEqual([15, 30]);
  });

  it('valida rango, enteros y que sean distintos', () => {
    expect(validarDiasPago(15, 30)).toBeNull();
    expect(validarDiasPago(0, 15)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15, 32)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15.5, 30)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(Number.NaN, 30)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15, 15)).toBe('Los días de pago deben ser distintos');
  });

  it('exige que el primer pago sea máximo el 27 para que la quincena 1 exista todos los meses', () => {
    expect(validarDiasPago(28, 31)).toBe('El primer día de pago debe ser máximo el 27');
    expect(validarDiasPago(31, 28)).toBe('El primer día de pago debe ser máximo el 27');
    expect(validarDiasPago(27, 30)).toBeNull();
  });

  it('exige al menos 2 días entre pagos, sin importar el orden', () => {
    expect(validarDiasPago(15, 16)).toBe('Deja al menos 2 días entre los pagos');
    expect(validarDiasPago(16, 15)).toBe('Deja al menos 2 días entre los pagos');
    expect(validarDiasPago(30, 15)).toBeNull();
  });
});
