import { describe, expect, it } from 'vitest';
import { desplazarMes, etiquetaFecha, fechaConAnio, fechaCorta, fechaEnMes, fechaLocalISO, mesActual, nombreMes, rangoMes } from './fechas';

describe('fechaLocalISO', () => {
  it('usa la fecha local aunque sea de noche', () => {
    expect(fechaLocalISO(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });

  it('rellena mes y día con ceros', () => {
    expect(fechaLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('etiquetaFecha', () => {
  const hoy = new Date(2026, 9, 6, 10, 0);

  it('dice Hoy y Ayer', () => {
    expect(etiquetaFecha('2026-10-06', hoy)).toBe('Hoy');
    expect(etiquetaFecha('2026-10-05', hoy)).toBe('Ayer');
  });

  it('muestra día de la semana, día y mes', () => {
    expect(etiquetaFecha('2026-10-01', hoy)).toBe('jue 1 oct');
  });

  it('agrega el año si es otro año', () => {
    expect(etiquetaFecha('2025-12-31', hoy)).toBe('mié 31 dic 2025');
  });
});

describe('meses', () => {
  it('mesActual toma año y mes de la fecha', () => {
    expect(mesActual(new Date(2026, 9, 6))).toEqual({ anio: 2026, mes: 9 });
  });

  it('desplazarMes cruza años', () => {
    expect(desplazarMes({ anio: 2026, mes: 0 }, -1)).toEqual({ anio: 2025, mes: 11 });
    expect(desplazarMes({ anio: 2026, mes: 11 }, 1)).toEqual({ anio: 2027, mes: 0 });
    expect(desplazarMes({ anio: 2026, mes: 5 }, 0)).toEqual({ anio: 2026, mes: 5 });
  });

  it('rangoMes cubre el mes completo, incluso febrero bisiesto', () => {
    expect(rangoMes(2026, 1)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoMes(2028, 1)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoMes(2026, 11)).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
  });

  it('nombreMes', () => {
    expect(nombreMes(2026, 9)).toBe('Octubre 2026');
  });
});

describe('fechaCorta', () => {
  it('muestra día y mes abreviado', () => {
    expect(fechaCorta('2026-09-30')).toBe('30 sep');
    expect(fechaCorta('2027-01-04')).toBe('4 ene');
  });
});

describe('fechaConAnio', () => {
  it('día, mes corto y año', () => {
    expect(fechaConAnio('2027-06-15')).toBe('15 jun 2027');
    expect(fechaConAnio('2026-12-01')).toBe('1 dic 2026');
  });
});

describe('fechaEnMes', () => {
  it('ajusta al último día si el día no existe y acepta meses fuera de rango', () => {
    expect(fechaLocalISO(fechaEnMes(2026, 1, 30))).toBe('2026-02-28');
    expect(fechaLocalISO(fechaEnMes(2028, 1, 30))).toBe('2028-02-29');
    expect(fechaLocalISO(fechaEnMes(2026, 10, 31))).toBe('2026-11-30');
    expect(fechaLocalISO(fechaEnMes(2026, 12, 5))).toBe('2027-01-05');
    expect(fechaLocalISO(fechaEnMes(2026, 9, 15))).toBe('2026-10-15');
  });
});
