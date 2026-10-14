import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { MONEDAS_DISPONIBLES } from '../../src/domain/dinero';

const ALICIA = 'alicia';
const BETO = 'beto';

const movimiento = { tipo: 'gasto', monto: 15000, categoriaId: 'comida', fecha: '2026-10-06' };
const categoria = {
  nombre: 'Mascotas',
  icono: '🐶',
  color: '#f97316',
  tipo: 'gasto',
  orden: 20,
  sistema: false,
  archivada: false,
};

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finanzas',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const como = (uid: string) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

async function sembrar(ruta: string, datos: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ruta), datos);
  });
}

describe('perfil', () => {
  it('la dueña lee y escribe su perfil', async () => {
    const db = como(ALICIA);
    await assertSucceeds(setDoc(doc(db, 'users', ALICIA), { nombre: 'Alicia' }));
    await assertSucceeds(getDoc(doc(db, 'users', ALICIA)));
  });

  it('otro usuario no puede leer ni escribir el perfil', async () => {
    await sembrar(`users/${ALICIA}`, { nombre: 'Alicia' });
    await assertFails(getDoc(doc(como(BETO), 'users', ALICIA)));
    await assertFails(setDoc(doc(como(BETO), 'users', ALICIA), { nombre: 'Hackeado' }));
  });

  it('sin sesión no se puede leer', async () => {
    await sembrar(`users/${ALICIA}`, { nombre: 'Alicia' });
    await assertFails(getDoc(doc(anonimo(), 'users', ALICIA)));
  });
});

describe('movimientos', () => {
  const ruta = (uid: string, id = 'm1') => `users/${uid}/movimientos/${id}`;

  it('crea un movimiento válido, con y sin nota', async () => {
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA)), movimiento));
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'm2')), { ...movimiento, nota: 'almuerzo' }));
  });

  it.each([
    ['monto 0', { monto: 0 }],
    ['monto negativo', { monto: -100 }],
    ['monto decimal', { monto: 150.5 }],
    ['monto como texto', { monto: '15000' }],
    ['tipo inválido', { tipo: 'transferencia' }],
    ['fecha mal formada', { fecha: '6/10/2026' }],
    ['sin categoría', { categoriaId: '' }],
    ['nota de más de 200 caracteres', { nota: 'x'.repeat(201) }],
  ])('rechaza %s', async (_nombre, cambio) => {
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...movimiento, ...cambio }));
  });

  it('la dueña edita y borra', async () => {
    await sembrar(ruta(ALICIA), movimiento);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { monto: 20000 }));
    await assertSucceeds(deleteDoc(doc(como(ALICIA), ruta(ALICIA))));
  });

  it('otro usuario no lee, crea ni borra movimientos ajenos', async () => {
    await sembrar(ruta(ALICIA), movimiento);
    await assertFails(getDoc(doc(como(BETO), ruta(ALICIA))));
    await assertFails(setDoc(doc(como(BETO), ruta(ALICIA, 'm9')), movimiento));
    await assertFails(deleteDoc(doc(como(BETO), ruta(ALICIA))));
  });
});

describe('categorías', () => {
  const ruta = (uid: string, id = 'c1') => `users/${uid}/categorias/${id}`;

  it('crea una categoría válida', async () => {
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA)), categoria));
  });

  it('rechaza nombre vacío o tipo inválido', async () => {
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...categoria, nombre: '' }));
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...categoria, tipo: 'otro' }));
  });

  it('no permite borrar categorías (se archivan)', async () => {
    await sembrar(ruta(ALICIA), categoria);
    await assertFails(deleteDoc(doc(como(ALICIA), ruta(ALICIA))));
  });

  it('permite archivar una categoría normal', async () => {
    await sembrar(ruta(ALICIA), categoria);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { archivada: true }));
  });

  it('no permite archivar una categoría de sistema ni quitarle la marca', async () => {
    await sembrar(ruta(ALICIA, 'ahorro'), { ...categoria, nombre: 'Ahorro', sistema: true });
    await assertFails(updateDoc(doc(como(ALICIA), ruta(ALICIA, 'ahorro')), { archivada: true }));
    await assertFails(updateDoc(doc(como(ALICIA), ruta(ALICIA, 'ahorro')), { sistema: false }));
  });

  it('otro usuario no lee categorías ajenas', async () => {
    await sembrar(ruta(ALICIA), categoria);
    await assertFails(getDoc(doc(como(BETO), ruta(ALICIA))));
  });
});

describe('colecciones de fases futuras', () => {
  it.each(['metas', 'deudas'])('rechaza escribir en %s', async (coleccion) => {
    await assertFails(setDoc(doc(como(ALICIA), `users/${ALICIA}/${coleccion}/x`), { nombre: 'x' }));
  });
});

describe('perfil validado', () => {
  const perfil = (uid: string) => doc(como(uid), 'users', uid);
  const base = { nombre: 'Alicia', email: 'a@x.com', moneda: 'COP', diasPago: [15, 30] };

  it('acepta perfil completo y cambios válidos', async () => {
    await assertSucceeds(setDoc(perfil(ALICIA), base));
    await assertSucceeds(updateDoc(perfil(ALICIA), { diasPago: [1, 15] }));
  });

  it.each(MONEDAS_DISPONIBLES.map((m) => m.codigo))('acepta la moneda %s', async (codigo) => {
    await assertSucceeds(setDoc(perfil(ALICIA), { ...base, moneda: codigo }));
  });

  it.each([
    ['moneda desconocida', { moneda: 'XYZ' }],
    ['día 0', { diasPago: [0, 15] }],
    ['día 32', { diasPago: [15, 32] }],
    ['días iguales', { diasPago: [15, 15] }],
    ['un solo día', { diasPago: [15] }],
    ['día decimal', { diasPago: [15.5, 30] }],
    ['días como texto', { diasPago: '15,30' }],
    ['días desordenados', { diasPago: [30, 15] }],
    ['primer día después del 27', { diasPago: [28, 31] }],
    ['pagos separados 1 día', { diasPago: [15, 16] }],
  ])('rechaza %s', async (_n, cambio) => {
    await assertFails(setDoc(perfil(ALICIA), { ...base, ...cambio }));
  });
});

describe('fijos', () => {
  const ruta = (uid: string, id = 'f1') => `users/${uid}/fijos/${id}`;
  const mensual = { nombre: 'Arriendo', monto: 900000, categoriaId: 'arriendo', frecuencia: 'mensual', quincena: 1, activo: true };
  const quincenal = { nombre: 'Mercado', monto: 300000, categoriaId: 'comida', frecuencia: 'quincenal', activo: true };

  it('crea fijos mensuales (Q1 y Q2) y quincenales', async () => {
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'a')), mensual));
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'b')), { ...mensual, quincena: 2 }));
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'c')), quincenal));
  });

  it.each([
    ['nombre vacío', { nombre: '' }],
    ['nombre de 41 caracteres', { nombre: 'x'.repeat(41) }],
    ['monto 0', { monto: 0 }],
    ['monto decimal', { monto: 1.5 }],
    ['sin categoría', { categoriaId: '' }],
    ['frecuencia inválida', { frecuencia: 'anual' }],
    ['quincena 3', { quincena: 3 }],
    ['activo como texto', { activo: 'si' }],
  ])('rechaza mensual con %s', async (_n, cambio) => {
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...mensual, ...cambio }));
  });

  it('rechaza mensual sin quincena y quincenal con quincena', async () => {
    const sinQuincena = { nombre: 'Arriendo', monto: 900000, categoriaId: 'arriendo', frecuencia: 'mensual', activo: true };
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), sinQuincena));
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...quincenal, quincena: 1 }));
  });

  it('pasa de mensual a quincenal solo si borra la quincena', async () => {
    await sembrar(ruta(ALICIA), mensual);
    await assertFails(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { frecuencia: 'quincenal' }));
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { frecuencia: 'quincenal', quincena: deleteField() }));
  });

  it('la dueña pausa y borra', async () => {
    await sembrar(ruta(ALICIA), mensual);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { activo: false }));
    await assertSucceeds(deleteDoc(doc(como(ALICIA), ruta(ALICIA))));
  });

  it('otro usuario no lee, crea ni borra fijos ajenos', async () => {
    await sembrar(ruta(ALICIA), mensual);
    await assertFails(getDoc(doc(como(BETO), ruta(ALICIA))));
    await assertFails(setDoc(doc(como(BETO), ruta(ALICIA, 'f9')), mensual));
    await assertFails(deleteDoc(doc(como(BETO), ruta(ALICIA))));
  });
});

describe('origen de movimientos', () => {
  const ruta = (id = 'm1') => `users/${ALICIA}/movimientos/${id}`;
  const conOrigen = { ...movimiento, origen: { tipo: 'fijo', id: 'f1' } };

  it('acepta origen fijo, deuda o meta', async () => {
    for (const tipo of ['fijo', 'deuda', 'meta']) {
      await assertSucceeds(setDoc(doc(como(ALICIA), ruta(tipo)), { ...movimiento, origen: { tipo, id: 'x' } }));
    }
  });

  it.each([
    ['tipo inválido', { tipo: 'otro', id: 'f1' }],
    ['id vacío', { tipo: 'fijo', id: '' }],
    ['sin id', { tipo: 'fijo' }],
    ['campos de más', { tipo: 'fijo', id: 'f1', extra: true }],
    ['texto en vez de mapa', 'fijo:f1'],
  ])('rechaza origen con %s', async (_n, origen) => {
    await assertFails(setDoc(doc(como(ALICIA), ruta()), { ...movimiento, origen }));
  });

  it('editar monto o nota conserva el origen', async () => {
    await sembrar(ruta(), conOrigen);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta()), { monto: 99000, nota: 'subió' }));
  });

  it('no permite cambiar, quitar ni agregar el origen al editar', async () => {
    await sembrar(ruta(), conOrigen);
    await assertFails(updateDoc(doc(como(ALICIA), ruta()), { origen: { tipo: 'fijo', id: 'f2' } }));
    await assertFails(updateDoc(doc(como(ALICIA), ruta()), { origen: deleteField() }));
    await sembrar(ruta('m2'), movimiento);
    await assertFails(updateDoc(doc(como(ALICIA), ruta('m2')), { origen: { tipo: 'fijo', id: 'f1' } }));
  });
});
