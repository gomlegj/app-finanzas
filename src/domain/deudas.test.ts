import { describe, expect, it } from 'vitest';
import {
  cuotasEstimadas,
  normalizarDeuda,
  saldo,
  sugerenciaDePago,
  validarDeuda,
  validarSaldo,
  type Deuda,
  type FormularioDeuda,
} from './deudas';
import type { Movimiento } from './movimientos';

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
