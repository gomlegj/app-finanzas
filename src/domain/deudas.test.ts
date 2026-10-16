import { describe, expect, it } from 'vitest';
import {
  cuotasEstimadas,
  normalizarDeuda,
  pagadoEnQuincena,
  pendientesDeDeudas,
  proximoPago,
  saldo,
  sugerenciaDePago,
  validarDeuda,
  validarSaldo,
  venceEnQuincena,
  type Deuda,
  type FormularioDeuda,
} from './deudas';
import type { Movimiento } from './movimientos';
import { quincenaDe } from './quincena';

const BASE_EN = 1_000_000;

const formulario = (cambios: Partial<FormularioDeuda> = {}): FormularioDeuda => ({
  nombre: 'Visa',
  tipo: 'tarjeta',
  saldo: 2000000,
  cuota: 300000,
  diaPago: 5,
  ...cambios,
});

const deuda = (id: string, cambios: Partial<Deuda> = {}): Deuda => ({
  id,
  nombre: id,
  tipo: 'tarjeta',
  cuota: 300000,
  diaPago: 5,
  saldoBase: 1000000,
  saldoBaseEn: BASE_EN,
  archivada: false,
  ...cambios,
});

const pago = (id: string, deudaId: string, monto: number, fecha = '2026-11-05', registradoEn?: number): Movimiento => ({
  id,
  tipo: 'gasto',
  monto,
  categoriaId: 'deudas',
  fecha,
  origen: { tipo: 'deuda', id: deudaId },
  ...(registradoEn === undefined ? {} : { registradoEn }),
});

describe('validarDeuda', () => {
  it('acepta una deuda completa', () => {
    expect(validarDeuda(formulario(), { creando: true })).toEqual({});
  });

  it('exige nombre, cuota y día válidos', () => {
    expect(validarDeuda(formulario({ nombre: ' ' }), { creando: true }).nombre).toBe('Escribe un nombre');
    expect(validarDeuda(formulario({ nombre: 'x'.repeat(41) }), { creando: true }).nombre).toBe('Máximo 40 caracteres');
    expect(validarDeuda(formulario({ cuota: null }), { creando: true }).cuota).toBe('Escribe una cuota mayor a 0');
    expect(validarDeuda(formulario({ cuota: 0 }), { creando: true }).cuota).toBe('Escribe una cuota mayor a 0');
    for (const diaPago of [null, 0, 32, 5.5]) {
      expect(validarDeuda(formulario({ diaPago }), { creando: true }).diaPago).toBe('Usa un día entre 1 y 31');
    }
  });

  it('el saldo se exige al crear y no al editar', () => {
    expect(validarDeuda(formulario({ saldo: null }), { creando: true }).saldo).toBe('Escribe un saldo mayor a 0');
    expect(validarDeuda(formulario({ saldo: 0 }), { creando: true }).saldo).toBe('Escribe un saldo mayor a 0');
    expect(validarDeuda(formulario({ saldo: null }), { creando: false })).toEqual({});
  });
});

describe('normalizarDeuda', () => {
  it('recorta el nombre y deja solo los campos editables', () => {
    expect(normalizarDeuda(formulario({ nombre: ' Visa ' }))).toEqual({ nombre: 'Visa', tipo: 'tarjeta', cuota: 300000, diaPago: 5 });
  });

  it('lanza si la cuota o el día no fueron validados', () => {
    expect(() => normalizarDeuda(formulario({ cuota: null }))).toThrow();
    expect(() => normalizarDeuda(formulario({ diaPago: null }))).toThrow();
  });
});

describe('validarSaldo', () => {
  it('acepta 0 o más', () => {
    expect(validarSaldo(0)).toBeNull();
    expect(validarSaldo(500000)).toBeNull();
    expect(validarSaldo(null)).toBe('Escribe el saldo (puede ser 0)');
  });
});

describe('saldo', () => {
  it('resta solo los pagos registrados después del saldo base', () => {
    const movimientos = [
      pago('antes', 'v', 999999, '2026-10-16', BASE_EN - 1),
      pago('igual', 'v', 999999, '2026-10-16', BASE_EN),
      pago('despues', 'v', 300000, '2026-11-05', BASE_EN + 1),
    ];
    expect(saldo(deuda('v'), movimientos)).toBe(700000);
  });

  it('un pago aún sin sincronizar cuenta como posterior', () => {
    expect(saldo(deuda('v'), [pago('p', 'v', 100000)])).toBe(900000);
  });

  it('ignora otras deudas, otros orígenes e ingresos', () => {
    const movimientos = [
      pago('a', 'otra', 500000, '2026-11-05', BASE_EN + 1),
      { ...pago('b', 'v', 500000, '2026-11-05', BASE_EN + 1), origen: { tipo: 'meta' as const, id: 'v' } },
      { ...pago('c', 'v', 500000, '2026-11-05', BASE_EN + 1), tipo: 'ingreso' as const },
    ];
    expect(saldo(deuda('v'), movimientos)).toBe(1000000);
  });

  it('nunca baja de 0', () => {
    expect(saldo(deuda('v'), [pago('p', 'v', 5000000, '2026-11-05', BASE_EN + 1)])).toBe(0);
  });
});

describe('cuotasEstimadas y sugerenciaDePago', () => {
  it('cuotas = saldo / cuota hacia arriba', () => {
    expect(cuotasEstimadas(deuda('v'), 1000000)).toBe(4);
    expect(cuotasEstimadas(deuda('v'), 900000)).toBe(3);
    expect(cuotasEstimadas(deuda('v'), 0)).toBe(0);
  });

  it('sugiere lo que falta de la cuota, sin pasar el saldo', () => {
    expect(sugerenciaDePago(deuda('v'), 1000000, 0)).toBe(300000);
    expect(sugerenciaDePago(deuda('v'), 1000000, 100000)).toBe(200000);
    expect(sugerenciaDePago(deuda('v'), 1000000, 400000)).toBe(0);
    expect(sugerenciaDePago(deuda('v'), 150000, 0)).toBe(150000);
  });
});

const DIAS: [number, number] = [15, 30];
const Q_FIN_OCT = quincenaDe('2026-11-02', DIAS); // 30 oct → 14 nov
const Q_MED_NOV = quincenaDe('2026-11-20', DIAS); // 15 nov → 29 nov

describe('proximoPago', () => {
  it('hoy, más adelante o el mes siguiente, ajustando fin de mes', () => {
    const dia = (iso: string) => new Date(`${iso}T10:00:00`);
    expect(proximoPago(deuda('v', { diaPago: 15 }), dia('2026-10-15'))).toBe('2026-10-15');
    expect(proximoPago(deuda('v', { diaPago: 5 }), dia('2026-10-16'))).toBe('2026-11-05');
    expect(proximoPago(deuda('v', { diaPago: 31 }), dia('2026-11-02'))).toBe('2026-11-30');
    expect(proximoPago(deuda('v', { diaPago: 30 }), dia('2026-02-01'))).toBe('2026-02-28');
    expect(proximoPago(deuda('v', { diaPago: 5 }), dia('2026-12-20'))).toBe('2027-01-05');
  });
});

describe('venceEnQuincena', () => {
  it('encuentra el vencimiento en una quincena que cruza de mes', () => {
    expect(venceEnQuincena(5, Q_FIN_OCT)).toBe('2026-11-05');
    expect(venceEnQuincena(31, Q_FIN_OCT)).toBe('2026-10-31');
    expect(venceEnQuincena(20, Q_FIN_OCT)).toBeNull();
  });

  it('día 31 en noviembre vence el 30', () => {
    const qFinNov = quincenaDe('2026-11-30', DIAS); // 30 nov → 14 dic
    expect(venceEnQuincena(31, qFinNov)).toBe('2026-11-30');
    expect(venceEnQuincena(31, Q_MED_NOV)).toBeNull();
  });
});

describe('pagadoEnQuincena', () => {
  it('suma pagos de esa deuda dentro de la quincena', () => {
    const movimientos = [pago('a', 'v', 100000, '2026-11-01'), pago('b', 'v', 50000, '2026-11-14'), pago('c', 'v', 9, '2026-11-15')];
    expect(pagadoEnQuincena(deuda('v'), movimientos, Q_FIN_OCT)).toBe(150000);
  });
});

describe('pendientesDeDeudas', () => {
  it('aparece en la quincena de su vencimiento con ícono del tipo', () => {
    const [p] = pendientesDeDeudas([deuda('v', { nombre: 'Visa', tipo: 'tarjeta', diaPago: 5 })], Q_FIN_OCT, []);
    expect(p).toEqual({
      origen: { tipo: 'deuda', id: 'v' },
      nombre: 'Visa',
      categoriaId: 'deudas',
      icono: '💳',
      color: '#64748b',
      planeado: 300000,
    });
    expect(pendientesDeDeudas([deuda('v', { diaPago: 5 })], Q_MED_NOV, [])).toEqual([]);
  });

  it('la cuota no pasa del saldo al inicio de la quincena', () => {
    const [p] = pendientesDeDeudas([deuda('v', { saldoBase: 120000 })], Q_FIN_OCT, []);
    expect(p.planeado).toBe(120000);
  });

  it('pagos dentro de la quincena la marcan pagada sin cambiar lo planeado', () => {
    const movimientos = [pago('a', 'v', 100000, '2026-11-01', BASE_EN + 1), pago('b', 'v', 200000, '2026-11-05', BASE_EN + 2)];
    const [p] = pendientesDeDeudas([deuda('v')], Q_FIN_OCT, movimientos);
    expect(p.planeado).toBe(300000);
    expect(p.pagado).toEqual({ monto: 300000, movimientos: ['b', 'a'] });
  });

  it('omite archivadas y deudas ya saldadas antes de la quincena', () => {
    const saldada = deuda('s', { saldoBase: 100000 });
    const previos = [pago('p', 's', 100000, '2026-10-20', BASE_EN + 1)];
    expect(pendientesDeDeudas([deuda('arch', { archivada: true }), saldada], Q_FIN_OCT, previos)).toEqual([]);
  });
});
