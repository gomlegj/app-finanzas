import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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
  it.each(['fijos', 'metas', 'deudas'])('rechaza escribir en %s', async (coleccion) => {
    await assertFails(setDoc(doc(como(ALICIA), `users/${ALICIA}/${coleccion}/x`), { nombre: 'x' }));
  });
});
