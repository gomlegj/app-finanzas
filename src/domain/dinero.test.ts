import { describe, expect, it } from 'vitest';
import { MONEDAS_DISPONIBLES, actualizarTextoMonto, agruparMiles, formatearMonto, parsearMonto } from './dinero';

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

describe('actualizarTextoMonto', () => {
  const teclear = (teclas: string) => [...teclas].reduce((texto, tecla) => actualizarTextoMonto(texto + tecla), '');

  it('agrupa miles tecla por tecla', () => {
    expect(teclear('1500000')).toBe('1.500.000');
  });

  it('conserva la parte decimal visible tecla por tecla, sin sumarla a los miles', () => {
    expect(teclear('15000,50')).toBe('15.000,50');
    expect(parsearMonto(teclear('15000,50'))).toBe(15000);
  });

  it('admite una sola coma y máximo 2 decimales', () => {
    expect(teclear('15000,5,0')).toBe('15.000,50');
    expect(teclear('15000,999')).toBe('15.000,99');
  });

  it('interpreta comas de miles al pegar (1,500,000)', () => {
    expect(actualizarTextoMonto('1,500,000')).toBe('1.500.000');
  });

  it('al pegar con decimales los conserva visibles', () => {
    expect(actualizarTextoMonto('15.000,50')).toBe('15.000,50');
  });
});

describe('MONEDAS_DISPONIBLES', () => {
  it('todas se pueden formatear y COP va primero', () => {
    expect(MONEDAS_DISPONIBLES[0].codigo).toBe('COP');
    for (const { codigo } of MONEDAS_DISPONIBLES) expect(() => formatearMonto(1000, codigo)).not.toThrow();
  });
});
