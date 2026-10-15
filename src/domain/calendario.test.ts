import { describe, expect, it } from 'vitest';
import { diasRecordatorio, enlaceCalendario, proximaFecha, reglaRecurrencia } from './calendario';
import { formatearMonto } from './dinero';
import type { DatosFijo } from './fijos';

const mensual = (diaPago?: number): DatosFijo => ({
  nombre: 'Internet',
  monto: 80000,
  categoriaId: 'servicios',
  frecuencia: 'mensual',
  quincena: 1,
  activo: true,
  ...(diaPago === undefined ? {} : { diaPago }),
});

const quincenal: DatosFijo = { nombre: 'Mercado', monto: 300000, categoriaId: 'comida', frecuencia: 'quincenal', activo: true };

describe('diasRecordatorio', () => {
  it('mensual usa su día; sin día no hay recordatorio', () => {
    expect(diasRecordatorio(mensual(5), [15, 30])).toEqual([5]);
    expect(diasRecordatorio(mensual(), [15, 30])).toBeNull();
  });

  it('quincenal usa los días de pago ordenados', () => {
    expect(diasRecordatorio(quincenal, [30, 15])).toEqual([15, 30]);
  });
});

describe('reglaRecurrencia', () => {
  it('un día hasta el 28 se repite ese día', () => {
    expect(reglaRecurrencia([5])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=5');
    expect(reglaRecurrencia([28])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28');
  });

  it('días 29 a 31 caen en el último día existente', () => {
    expect(reglaRecurrencia([29])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1');
    expect(reglaRecurrencia([30])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1');
    expect(reglaRecurrencia([31])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  });

  it('dos días hasta el 28 se listan tal cual', () => {
    expect(reglaRecurrencia([1, 15])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15');
  });

  it('dos días con el segundo después del 28 toman el primero y el último existente', () => {
    expect(reglaRecurrencia([15, 30])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=15,28,29,30;BYSETPOS=1,-1');
    expect(reglaRecurrencia([10, 31])).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=10,28,29,30,31;BYSETPOS=1,-1');
  });
});

describe('proximaFecha', () => {
  const dia = (iso: string) => new Date(`${iso}T10:00:00`);

  it('si hoy es el día, empieza hoy', () => {
    expect(proximaFecha([15], dia('2026-10-15'))).toBe('2026-10-15');
  });

  it('busca más adelante en el mes o pasa al siguiente', () => {
    expect(proximaFecha([20], dia('2026-10-15'))).toBe('2026-10-20');
    expect(proximaFecha([5], dia('2026-10-15'))).toBe('2026-11-05');
  });

  it('con dos días toma el más cercano', () => {
    expect(proximaFecha([15, 30], dia('2026-10-16'))).toBe('2026-10-30');
    expect(proximaFecha([15, 30], dia('2026-10-31'))).toBe('2026-11-15');
  });

  it('ajusta días que no existen al último del mes', () => {
    expect(proximaFecha([30], dia('2026-02-10'))).toBe('2026-02-28');
    expect(proximaFecha([30], dia('2028-02-10'))).toBe('2028-02-29');
    expect(proximaFecha([31], dia('2026-04-05'))).toBe('2026-04-30');
  });

  it('pasa de diciembre a enero', () => {
    expect(proximaFecha([5], dia('2026-12-20'))).toBe('2027-01-05');
  });
});

describe('enlaceCalendario', () => {
  it('arma un evento de día completo con repetición', () => {
    const url = new URL(enlaceCalendario({ nombre: 'Agua & luz #2', monto: 80000 }, [5], 'COP', new Date('2026-10-15T10:00:00')));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Pagar Agua & luz #2');
    expect(url.searchParams.get('details')).toBe(`Monto planeado: ${formatearMonto(80000, 'COP')}`);
    expect(url.searchParams.get('dates')).toBe('20261105/20261106');
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=5');
  });

  it('el fin del evento cruza de mes y año correctamente', () => {
    const url = new URL(enlaceCalendario({ nombre: 'Arriendo', monto: 1 }, [31], 'COP', new Date('2026-12-20T10:00:00')));
    expect(url.searchParams.get('dates')).toBe('20261231/20270101');
  });
});
