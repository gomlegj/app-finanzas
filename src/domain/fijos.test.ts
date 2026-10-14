import { describe, expect, it } from 'vitest';
import {
  aplicaEnQuincena,
  comprometido,
  etiquetaFrecuencia,
  normalizarFijo,
  ordenarFijos,
  pendientesDeQuincena,
  validarFijo,
  type Fijo,
  type FormularioFijo,
} from './fijos';
import type { Movimiento } from './movimientos';

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

const pago = (id: string, fijoId: string, monto: number, fecha = '2026-10-20', cambios: Partial<Movimiento> = {}): Movimiento => ({
  id,
  tipo: 'gasto',
  monto,
  categoriaId: 'servicios',
  fecha,
  origen: { tipo: 'fijo', id: fijoId },
  ...cambios,
});

const Q1 = { numero: 1 } as const;
const Q2 = { numero: 2 } as const;

describe('pendientesDeQuincena', () => {
  it('mensual aparece solo en su quincena; quincenal en ambas', () => {
    const fijos = [fijo('luz'), fijo('arriendo', { frecuencia: 'mensual', quincena: 2 })];
    expect(pendientesDeQuincena(fijos, Q1, []).map((p) => p.origen.id)).toEqual(['luz']);
    expect(pendientesDeQuincena(fijos, Q2, []).map((p) => p.origen.id)).toEqual(['arriendo', 'luz']);
  });

  it('sin pagos queda pendiente con su monto planeado', () => {
    expect(pendientesDeQuincena([fijo('luz', { nombre: 'Luz', monto: 150000, categoriaId: 'servicios' })], Q1, [])).toEqual([
      { origen: { tipo: 'fijo', id: 'luz' }, nombre: 'Luz', categoriaId: 'servicios', planeado: 150000 },
    ]);
  });

  it('suma varios pagos y lista los movimientos del más reciente al más antiguo', () => {
    const movimientos = [pago('m1', 'luz', 100000, '2026-10-16'), pago('m2', 'luz', 62000, '2026-10-25')];
    const [luz] = pendientesDeQuincena([fijo('luz', { monto: 150000 })], Q1, movimientos);
    expect(luz.pagado).toEqual({ monto: 162000, movimientos: ['m2', 'm1'] });
  });

  it('ignora movimientos sin origen o con origen de otro tipo y el mismo id', () => {
    const movimientos = [
      pago('m1', 'luz', 1000, '2026-10-20', { origen: undefined }),
      pago('m2', 'luz', 1000, '2026-10-20', { origen: { tipo: 'deuda', id: 'luz' } }),
      pago('m3', 'otro-fijo', 1000),
    ];
    expect(pendientesDeQuincena([fijo('luz')], Q1, movimientos)[0].pagado).toBeUndefined();
  });

  it('un fijo pausado aparece si ya se pagó y desaparece si no', () => {
    const fijos = [fijo('pagado', { activo: false }), fijo('sinpagar', { activo: false })];
    const lista = pendientesDeQuincena(fijos, Q1, [pago('m1', 'pagado', 1000)]);
    expect(lista.map((p) => p.origen.id)).toEqual(['pagado']);
  });

  it('ordena pendientes primero y pagados después, cada grupo por nombre', () => {
    const fijos = [
      fijo('a', { nombre: 'Internet' }),
      fijo('b', { nombre: 'Agua' }),
      fijo('c', { nombre: 'Celular' }),
      fijo('d', { nombre: 'Arriendo' }),
    ];
    const lista = pendientesDeQuincena(fijos, Q1, [pago('m1', 'b', 1000), pago('m2', 'a', 1000)]);
    expect(lista.map((p) => p.nombre)).toEqual(['Arriendo', 'Celular', 'Agua', 'Internet']);
  });
});

describe('comprometido', () => {
  it('suma lo planeado de los no pagados', () => {
    const fijos = [fijo('a', { monto: 100 }), fijo('b', { monto: 200 }), fijo('c', { monto: 400 })];
    expect(comprometido(pendientesDeQuincena(fijos, Q1, [pago('m1', 'c', 400)]))).toBe(300);
  });

  it('pagar de más o de menos no cambia el comprometido', () => {
    const fijos = [fijo('a', { monto: 100 }), fijo('b', { monto: 200 })];
    expect(comprometido(pendientesDeQuincena(fijos, Q1, [pago('m1', 'a', 999)]))).toBe(200);
    expect(comprometido(pendientesDeQuincena(fijos, Q1, [pago('m1', 'a', 1)]))).toBe(200);
  });

  it('sin fijos es 0', () => {
    expect(comprometido([])).toBe(0);
  });
});
