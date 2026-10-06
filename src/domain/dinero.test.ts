import { describe, expect, it } from 'vitest';
import { agruparMiles, formatearMonto, parsearMonto } from './dinero';

const sinEspeciales = (texto: string) => texto.replace(/\s/g, ' ');

describe('formatearMonto', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(sinEspeciales(formatearMonto(15000))).toBe('$ 15.000');
    expect(sinEspeciales(formatearMonto(1500000))).toBe('$ 1.500.000');
  });

  it('agrupa también montos de 4 dígitos', () => {
    expect(sinEspeciales(formatearMonto(1500))).toBe('$ 1.500');
  });

  it('formatea cero', () => {
    expect(sinEspeciales(formatearMonto(0))).toBe('$ 0');
  });
});

describe('parsearMonto', () => {
  it.each([
    ['15000', 15000],
    ['15.000', 15000],
    ['$ 1.500.000', 1500000],
    ['15.000,50', 15000],
    ['  2500 ', 2500],
  ])('interpreta "%s" como %i', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(['', '0', '0.000', 'abc', ',50', '99999999999999999999'])('rechaza "%s"', (texto) => {
    expect(parsearMonto(texto)).toBeNull();
  });
});

describe('agruparMiles', () => {
  it('agrupa mientras se escribe', () => {
    expect(agruparMiles('1500000')).toBe('1.500.000');
    expect(agruparMiles('1.5000')).toBe('15.000');
    expect(agruparMiles('150')).toBe('150');
  });

  it('ignora decimales y texto', () => {
    expect(agruparMiles('15000,5')).toBe('15.000');
    expect(agruparMiles('abc')).toBe('');
    expect(agruparMiles('')).toBe('');
  });

  it('quita ceros a la izquierda', () => {
    expect(agruparMiles('0015')).toBe('15');
  });
});
