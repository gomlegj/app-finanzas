# Fase 3 — Gastos fijos y presupuesto planeado vs real — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La usuaria registra gastos fijos en Ajustes; Inicio muestra los fijos de la quincena actual (pendientes y pagados, planeado vs real), suma lo comprometido y lo descuenta del disponible; "Pagado" abre el registro rápido prellenado y crea un gasto con `origen`.

**Architecture:** Igual que fases 1 y 2. Lógica nueva en funciones puras (`src/domain/fijos.ts`) con TDD; colección `fijos` y validación de `origen` en reglas de Firestore (probadas en emulador); pendientes calculados en el cliente, nunca guardados.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Tailwind 4, Firebase 12, lucide-react, Vitest, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-14-fase-3-gastos-fijos-design.md` (base: `docs/superpowers/specs/2026-10-06-app-finanzas-design.md` §4.2, §4.3, §5). Rama: `feat/fase-3`, creada desde `feat/fase-2`.

## Global Constraints

- Costo $0, sin Cloud Functions. Montos enteros. Fechas `'YYYY-MM-DD'` locales.
- Pendientes **no se materializan**: se calculan con `fijos` + movimientos de la quincena.
- Un fijo está pagado si hay movimientos con `origen: { tipo: 'fijo', id }` en la quincena; varios pagos se suman.
- Comprometido = suma de `planeado` de los pendientes no pagados. Disponible = ingresos − gastado − comprometido.
- Fijo: `nombre` 1–40, `monto` int > 0, `categoriaId` no vacío, `frecuencia` `'mensual'|'quincenal'`, `quincena` 1|2 solo si mensual, `activo` bool.
- Sin dependencias nuevas.
- Escrituras a Firestore no se esperan en la UI (offline): se lanza la promesa, se muestra el toast de éxito y el error va en `.catch` con toast `'error'`.
- Textos de UI en español; código con nombres en español como el resto del repo.
- Permisos: la usuaria autorizó ejecución directa y commits por tarea; `push`/`merge`/`deploy` e instalar dependencias se preguntan.

## Review Focus

1. **Editar un fijo de mensual a quincenal** → se guarda sin error (el campo `quincena` se borra); las reglas rechazan `quincena` en un quincenal. Prueba de reglas en Task 3; `deleteField` en Task 4.
2. **Fijo pausado** → si ya se pagó en la quincena sigue visible como pagado; si no, desaparece y no suma al comprometido. Pruebas en Task 2.
3. **Editar un pago de un fijo** (cambiar monto o nota) → conserva `origen` y sigue contando como pagado; las reglas impiden quitar o cambiar `origen`. Pruebas de reglas en Task 3.
4. **Movimiento con `origen` de otro tipo y el mismo id** (p. ej. una deuda futura) → no marca el fijo como pagado. Prueba en Task 2.
5. **Registrar el pago como ingreso por error** → no se puede: en modo pago el selector de tipo no aparece. Cambio en Task 6, verificado en Task 8.

---

## Mapa de archivos

```
src/domain/fijos.ts                         src/domain/fijos.test.ts
firestore.rules (fijos, origen)             tests/rules/firestore.rules.test.ts
src/data/fijos.ts (nuevo)
src/data/movimientos.ts (crearMovimiento con origen)
src/data/hooks.ts (+ useFijos)
src/features/ajustes/FijosPage.tsx (nuevo)
src/features/ajustes/FormularioFijo.tsx (nuevo)
src/features/ajustes/AjustesPage.tsx (enlace), src/App.tsx (ruta)
src/features/movimientos/RegistroRapido.tsx (prop prellenado)
src/features/inicio/FijosQuincena.tsx (nuevo)
src/features/inicio/InicioPage.tsx
```

---

### Task 1: Dominio de fijos — tipos, validación, normalización y orden

**Files:**
- Create: `src/domain/fijos.ts`
- Test: `src/domain/fijos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  type Frecuencia = 'mensual' | 'quincenal';
  type NumeroQuincena = 1 | 2;
  interface DatosFijo { nombre: string; monto: number; categoriaId: string; frecuencia: Frecuencia; quincena?: NumeroQuincena; activo: boolean }
  interface Fijo extends DatosFijo { id: string }
  interface FormularioFijo { nombre: string; monto: number | null; categoriaId: string; frecuencia: Frecuencia; quincena: NumeroQuincena; activo: boolean }
  type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId', string>>;
  const MAX_NOMBRE_FIJO = 40;
  function validarFijo(f: FormularioFijo): ErroresFijo;
  function normalizarFijo(f: FormularioFijo): DatosFijo;
  function etiquetaFrecuencia(fijo: DatosFijo): string;   // 'Quincenal' | 'Mensual · Q1' | 'Mensual · Q2'
  function ordenarFijos(fijos: readonly Fijo[]): Fijo[];   // activos primero, luego pausados; por nombre ('es')
  function aplicaEnQuincena(fijo: DatosFijo, numero: NumeroQuincena): boolean;
  ```

- [ ] **Step 1: Write the failing test**

`src/domain/fijos.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  aplicaEnQuincena,
  etiquetaFrecuencia,
  normalizarFijo,
  ordenarFijos,
  validarFijo,
  type Fijo,
  type FormularioFijo,
} from './fijos';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/fijos.test.ts`
Expected: FAIL — `Failed to resolve import "./fijos"`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/fijos.ts`:
```ts
export type Frecuencia = 'mensual' | 'quincenal';
export type NumeroQuincena = 1 | 2;

export interface DatosFijo {
  nombre: string;
  monto: number;
  categoriaId: string;
  frecuencia: Frecuencia;
  /** Solo si `frecuencia === 'mensual'`. */
  quincena?: NumeroQuincena;
  activo: boolean;
}

export interface Fijo extends DatosFijo {
  id: string;
}

export interface FormularioFijo {
  nombre: string;
  monto: number | null;
  categoriaId: string;
  frecuencia: Frecuencia;
  /** Se ignora si la frecuencia es quincenal. */
  quincena: NumeroQuincena;
  activo: boolean;
}

export type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId', string>>;

export const MAX_NOMBRE_FIJO = 40;

export function validarFijo(f: FormularioFijo): ErroresFijo {
  const errores: ErroresFijo = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_FIJO) errores.nombre = `Máximo ${MAX_NOMBRE_FIJO} caracteres`;
  if (f.monto === null || f.monto <= 0) errores.monto = 'Escribe un monto mayor a 0';
  if (!f.categoriaId) errores.categoriaId = 'Elige una categoría';
  return errores;
}

export function normalizarFijo(f: FormularioFijo): DatosFijo {
  if (f.monto === null) throw new Error('normalizarFijo requiere un monto validado');
  const datos: DatosFijo = {
    nombre: f.nombre.trim(),
    monto: f.monto,
    categoriaId: f.categoriaId,
    frecuencia: f.frecuencia,
    activo: f.activo,
  };
  if (f.frecuencia === 'mensual') datos.quincena = f.quincena;
  return datos;
}

export function etiquetaFrecuencia(fijo: DatosFijo): string {
  return fijo.frecuencia === 'quincenal' ? 'Quincenal' : `Mensual · Q${fijo.quincena ?? 1}`;
}

export function aplicaEnQuincena(fijo: DatosFijo, numero: NumeroQuincena): boolean {
  return fijo.frecuencia === 'quincenal' || fijo.quincena === numero;
}

export const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

export function ordenarFijos(fijos: readonly Fijo[]): Fijo[] {
  return [...fijos].sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/fijos.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/domain/fijos.ts src/domain/fijos.test.ts
git commit -m "feat: add fixed expense model, validation and ordering"
```

---

### Task 2: Pendientes de la quincena y comprometido

**Files:**
- Modify: `src/domain/fijos.ts` (agregar al final)
- Test: `src/domain/fijos.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `Fijo`, `aplicaEnQuincena`, `porNombre` (Task 1); `Movimiento` de `src/domain/movimientos.ts` (tiene `origen?: { tipo: 'fijo'|'deuda'|'meta'; id: string }`); `Quincena` de `src/domain/quincena.ts` (`numero: 1 | 2`).
- Produces:
  ```ts
  interface Pendiente {
    origen: { tipo: 'fijo'; id: string };
    nombre: string;
    categoriaId: string;
    planeado: number;
    /** Ausente si no está pagado. `movimientos`: ids del más reciente al más antiguo. */
    pagado?: { monto: number; movimientos: string[] };
  }
  function pendientesDeQuincena(fijos: readonly Fijo[], quincena: Pick<Quincena, 'numero'>, movimientos: readonly Movimiento[]): Pendiente[];
  function comprometido(pendientes: readonly Pendiente[]): number;
  ```
  `movimientos` deben ser solo los de la quincena (los que da `useMovimientosEntre`).

- [ ] **Step 1: Write the failing test**

Agregar a `src/domain/fijos.test.ts` (y añadir `comprometido, pendientesDeQuincena` al import de `./fijos`, más `import type { Movimiento } from './movimientos';`):
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/fijos.test.ts`
Expected: FAIL — `pendientesDeQuincena is not a function` (o error de import).

- [ ] **Step 3: Write minimal implementation**

Agregar al inicio de `src/domain/fijos.ts`:
```ts
import type { Movimiento } from './movimientos';
import type { Quincena } from './quincena';
```

Agregar al final de `src/domain/fijos.ts`:
```ts
export interface Pendiente {
  origen: { tipo: 'fijo'; id: string };
  nombre: string;
  categoriaId: string;
  planeado: number;
  /** Ausente si no está pagado. `movimientos`: ids del más reciente al más antiguo. */
  pagado?: { monto: number; movimientos: string[] };
}

/** `movimientos` deben ser solo los de `quincena`. */
export function pendientesDeQuincena(
  fijos: readonly Fijo[],
  quincena: Pick<Quincena, 'numero'>,
  movimientos: readonly Movimiento[],
): Pendiente[] {
  const pagos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    if (m.origen?.tipo !== 'fijo') continue;
    const lista = pagos.get(m.origen.id);
    if (lista) lista.push(m);
    else pagos.set(m.origen.id, [m]);
  }

  const resultado: Pendiente[] = [];
  for (const fijo of fijos) {
    if (!aplicaEnQuincena(fijo, quincena.numero)) continue;
    const lista = pagos.get(fijo.id);
    // Pausado y sin pagar: ya no se espera. Pausado pero pagado: se conserva lo ocurrido.
    if (!fijo.activo && !lista) continue;
    const pendiente: Pendiente = {
      origen: { tipo: 'fijo', id: fijo.id },
      nombre: fijo.nombre,
      categoriaId: fijo.categoriaId,
      planeado: fijo.monto,
    };
    if (lista) {
      const recientes = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
      pendiente.pagado = {
        monto: lista.reduce((suma, m) => suma + m.monto, 0),
        movimientos: recientes.map((m) => m.id),
      };
    }
    resultado.push(pendiente);
  }

  return resultado.sort((a, b) => Number(a.pagado !== undefined) - Number(b.pagado !== undefined) || porNombre(a, b));
}

export function comprometido(pendientes: readonly Pendiente[]): number {
  return pendientes.reduce((suma, p) => (p.pagado ? suma : suma + p.planeado), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/fijos.test.ts`
Expected: PASS. Luego `npm test` completo: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fijos.ts src/domain/fijos.test.ts
git commit -m "feat: compute fortnight fixed expenses and committed amount"
```

---

### Task 3: Reglas de Firestore — `fijos` y `origen` en movimientos

**Files:**
- Modify: `firestore.rules` (bloque `match /movimientos/{id}` y nuevo `match /fijos/{id}` dentro de `match /users/{uid}`)
- Test: `tests/rules/firestore.rules.test.ts`

**Interfaces:**
- Consumes: forma de `DatosFijo` (Task 1) y `OrigenMovimiento`.
- Produces: escrituras permitidas para `users/{uid}/fijos/{id}` y `origen` validado e inmutable.

- [ ] **Step 1: Write the failing test**

En `tests/rules/firestore.rules.test.ts`:

1. Cambiar el bloque `colecciones de fases futuras` para que ya no incluya `fijos`:
```ts
describe('colecciones de fases futuras', () => {
  it.each(['metas', 'deudas'])('rechaza escribir en %s', async (coleccion) => {
    await assertFails(setDoc(doc(como(ALICIA), `users/${ALICIA}/${coleccion}/x`), { nombre: 'x' }));
  });
});
```

2. Agregar al final:
```ts
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
```

3. Agregar `deleteField` al import de `firebase/firestore`:
```ts
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — los casos de `fijos` que esperan éxito fallan (la colección no tiene reglas) y los de `origen` inválido/inmutable pasan la escritura cuando deberían fallar.

- [ ] **Step 3: Write minimal implementation**

En `firestore.rules`, reemplazar el bloque `match /movimientos/{id} { ... }` completo por:
```
      match /movimientos/{id} {
        function origenValido(d) {
          return !('origen' in d) || (
            d.origen is map
            && d.origen.keys().hasOnly(['tipo', 'id'])
            && d.origen.tipo in ['fijo', 'deuda', 'meta']
            && d.origen.id is string && d.origen.id.size() > 0);
        }

        function movimientoValido() {
          let d = request.resource.data;
          return d.tipo in ['gasto', 'ingreso']
            && d.monto is int && d.monto > 0
            && d.categoriaId is string && d.categoriaId.size() > 0
            && d.fecha is string && d.fecha.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            && (!('nota' in d) || (d.nota is string && d.nota.size() <= 200))
            && origenValido(d);
        }

        allow read, delete: if esDueno(uid);
        allow create: if esDueno(uid) && movimientoValido();
        // El origen une el pago con su fijo/deuda/meta: no se cambia al editar.
        allow update: if esDueno(uid) && movimientoValido()
          && request.resource.data.get('origen', null) == resource.data.get('origen', null);
      }

      match /fijos/{id} {
        function fijoValido() {
          let d = request.resource.data;
          return d.nombre is string && d.nombre.size() > 0 && d.nombre.size() <= 40
            && d.monto is int && d.monto > 0
            && d.categoriaId is string && d.categoriaId.size() > 0
            && d.activo is bool
            && ((d.frecuencia == 'mensual' && 'quincena' in d && d.quincena is int && d.quincena in [1, 2])
              || (d.frecuencia == 'quincenal' && !('quincena' in d)));
        }

        allow read, delete: if esDueno(uid);
        allow create, update: if esDueno(uid) && fijoValido();
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (todas, incluidas las previas de perfil, movimientos y categorías).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat: allow fixed expenses and validate movement origin in rules"
```

---

### Task 4: Capa de datos — fijos, `useFijos` y movimientos con origen

**Files:**
- Create: `src/data/fijos.ts`
- Modify: `src/data/hooks.ts`, `src/data/movimientos.ts:43-45`

**Interfaces:**
- Consumes: `DatosFijo`, `Fijo` (Task 1); `OrigenMovimiento` de `src/domain/movimientos.ts`.
- Produces:
  ```ts
  function escucharFijos(uid: string, alCambiar: (fijos: Fijo[]) => void, alFallar?: (error: unknown) => void): Unsubscribe;
  function crearFijo(uid: string, datos: DatosFijo): Promise<void>;
  function actualizarFijo(uid: string, id: string, datos: DatosFijo): Promise<void>; // borra `quincena` si no viene
  function borrarFijo(uid: string, id: string): Promise<void>;
  function useFijos(uid: string): Escucha<Fijo[]>; // { datos, cargando, error }
  function crearMovimiento(uid: string, datos: DatosMovimiento, origen?: OrigenMovimiento): Promise<void>;
  ```

- [ ] **Step 1: Crear `src/data/fijos.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosFijo, Fijo } from '../domain/fijos';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'fijos');

export function escucharFijos(
  uid: string,
  alCambiar: (fijos: Fijo[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosFijo) }))),
    (error) => {
      console.error('Error escuchando gastos fijos', error);
      alFallar?.(error);
    },
  );
}

export async function crearFijo(uid: string, datos: DatosFijo): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, creadoEn: serverTimestamp() });
}

/** Reemplaza los datos editables; si pasa a quincenal se borra `quincena` (las reglas lo exigen). */
export function actualizarFijo(uid: string, id: string, datos: DatosFijo): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos, quincena: datos.quincena ?? deleteField() });
}

export function borrarFijo(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(coleccion(uid), id));
}
```

- [ ] **Step 2: Agregar `useFijos` a `src/data/hooks.ts`**

Agregar imports:
```ts
import type { Fijo } from '../domain/fijos';
import { escucharFijos } from './fijos';
```
Agregar al final:
```ts
export function useFijos(uid: string): Escucha<Fijo[]> {
  return useEscucha<Fijo[]>((cb, falla) => escucharFijos(uid, cb, falla), `fijos:${uid}`, SIN_DATOS);
}
```

- [ ] **Step 3: `crearMovimiento` acepta `origen`**

En `src/data/movimientos.ts`, cambiar el import de tipos y `crearMovimiento`:
```ts
import type { DatosMovimiento, Movimiento, OrigenMovimiento } from '../domain/movimientos';
```
```ts
export async function crearMovimiento(uid: string, datos: DatosMovimiento, origen?: OrigenMovimiento): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, ...(origen ? { origen } : {}), creadoEn: serverTimestamp() });
}
```
`actualizarMovimiento` no cambia: `updateDoc` no toca `origen`.

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test`
Expected: sin errores; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/fijos.ts src/data/hooks.ts src/data/movimientos.ts
git commit -m "feat: add fixed expenses data layer and movement origin on create"
```

---

### Task 5: Ajustes → Gastos fijos

**Files:**
- Create: `src/features/ajustes/FormularioFijo.tsx`, `src/features/ajustes/FijosPage.tsx`
- Modify: `src/features/ajustes/AjustesPage.tsx` (enlace), `src/App.tsx` (ruta)

**Interfaces:**
- Consumes: `useFijos`, `crearFijo`, `actualizarFijo`, `borrarFijo` (Task 4); `validarFijo`, `normalizarFijo`, `ordenarFijos`, `etiquetaFrecuencia`, `MAX_NOMBRE_FIJO`, tipos (Task 1); `useCategorias`, `usePerfil`; `categoriasActivas`; `HojaInferior({ abierta, titulo, onCerrar, children })`; `BurbujaCategoria({ icono, color, grande? })`; `MensajeError({ mensaje? })`; `useToast().mostrar(mensaje, tipo?)`; `actualizarTextoMonto`, `agruparMiles`, `parsearMonto`, `formatearMonto(monto, moneda)`.
- Produces: ruta `/ajustes/fijos`.

- [ ] **Step 1: Crear `src/features/ajustes/FormularioFijo.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { MensajeError } from '../../components/MensajeError';
import { useToast } from '../../components/toastContexto';
import { actualizarFijo, borrarFijo, crearFijo } from '../../data/fijos';
import { categoriasActivas, type Categoria } from '../../domain/categorias';
import { actualizarTextoMonto, agruparMiles, parsearMonto } from '../../domain/dinero';
import {
  MAX_NOMBRE_FIJO,
  normalizarFijo,
  validarFijo,
  type ErroresFijo,
  type Fijo,
  type Frecuencia,
  type NumeroQuincena,
} from '../../domain/fijos';
import { useUsuario } from '../auth/contexto';

interface Props {
  fijo?: Fijo;
  categorias: readonly Categoria[];
  onListo: () => void;
}

export function FormularioFijo({ fijo, categorias, onListo }: Props) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(fijo?.nombre ?? '');
  const [montoTexto, setMontoTexto] = useState(fijo ? agruparMiles(String(fijo.monto)) : '');
  const [categoriaId, setCategoriaId] = useState(fijo?.categoriaId ?? '');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(fijo?.frecuencia ?? 'mensual');
  const [quincena, setQuincena] = useState<NumeroQuincena>(fijo?.quincena ?? 1);
  const [activo, setActivo] = useState(fijo?.activo ?? true);
  const [errores, setErrores] = useState<ErroresFijo>({});

  // Al editar, la categoría actual se muestra aunque esté archivada.
  const actual = categorias.find((c) => c.id === categoriaId);
  const opciones = categoriasActivas(categorias, 'gasto');
  if (actual?.archivada && actual.tipo === 'gasto') opciones.push(actual);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const formulario = { nombre, monto: parsearMonto(montoTexto), categoriaId, frecuencia, quincena, activo };
    const encontrados = validarFijo(formulario);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarFijo(formulario);
    const operacion = fijo ? actualizarFijo(usuario.uid, fijo.id, datos) : crearFijo(usuario.uid, datos);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar el gasto fijo', 'error'));
    mostrar(fijo ? 'Gasto fijo actualizado' : 'Gasto fijo creado');
    onListo();
  }

  function borrar() {
    if (!fijo || !window.confirm(`¿Eliminar "${fijo.nombre}"? Los pagos ya registrados se conservan.`)) return;
    borrarFijo(usuario.uid, fijo.id).catch(() => mostrar('No se pudo eliminar el gasto fijo', 'error'));
    mostrar('Gasto fijo eliminado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Nombre</span>
        <input
          autoFocus
          value={nombre}
          maxLength={MAX_NOMBRE_FIJO}
          placeholder="Ej. Arriendo, Internet"
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        />
        <MensajeError mensaje={errores.nombre} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Monto planeado</span>
        <div className="flex items-baseline gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <span className="text-slate-400">$</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(actualizarTextoMonto(e.target.value))}
            className="w-full min-w-0 bg-transparent tabular-nums outline-none"
          />
        </div>
        <MensajeError mensaje={errores.monto} />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">Categoría</legend>
        <div className="grid grid-cols-4 gap-2">
          {opciones.map((c) => {
            const elegida = c.id === categoriaId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={elegida}
                onClick={() => setCategoriaId(c.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-center transition ${
                  elegida ? 'bg-emerald-50 ring-2 ring-emerald-500' : 'hover:bg-slate-50'
                }`}
              >
                <BurbujaCategoria icono={c.icono} color={c.color} />
                <span className="line-clamp-2 text-xs leading-tight text-slate-700">{c.nombre}</span>
              </button>
            );
          })}
        </div>
        <MensajeError mensaje={errores.categoriaId} />
      </fieldset>

      <Segmentado
        etiqueta="Frecuencia"
        valor={frecuencia}
        onCambio={setFrecuencia}
        opciones={[
          { valor: 'mensual', etiqueta: 'Mensual' },
          { valor: 'quincenal', etiqueta: 'Cada quincena' },
        ]}
      />

      {frecuencia === 'mensual' && (
        <Segmentado
          etiqueta="¿En qué quincena se paga?"
          valor={quincena}
          onCambio={setQuincena}
          opciones={[
            { valor: 1, etiqueta: 'Quincena 1' },
            { valor: 2, etiqueta: 'Quincena 2' },
          ]}
        />
      )}

      <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
        <span>
          <span className="block font-medium text-slate-800">Activo</span>
          <span className="block text-sm text-slate-500">Si lo pausas, deja de aparecer en Inicio.</span>
        </span>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
      </label>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {fijo && (
        <button
          type="button"
          onClick={borrar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={18} />
          Eliminar gasto fijo
        </button>
      )}
    </form>
  );
}

interface PropsSegmentado<T extends string | number> {
  etiqueta: string;
  valor: T;
  onCambio: (valor: T) => void;
  opciones: { valor: T; etiqueta: string }[];
}

function Segmentado<T extends string | number>({ etiqueta, valor, onCambio, opciones }: PropsSegmentado<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">{etiqueta}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup">
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onCambio(opcion.valor)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                activa ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 2: Crear `src/features/ajustes/FijosPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Pencil } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { useCategorias, useFijos, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import { etiquetaFrecuencia, ordenarFijos, type Fijo } from '../../domain/fijos';
import { useUsuario } from '../auth/contexto';
import { FormularioFijo } from './FormularioFijo';

export function FijosPage() {
  const usuario = useUsuario();
  const { datos: fijos, cargando, error } = useFijos(usuario.uid);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const [editando, setEditando] = useState<Fijo | 'nuevo' | null>(null);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const lista = ordenarFijos(fijos);

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Gastos fijos</h2>
      <p className="text-sm text-slate-500">Lo que pagas siempre. Aparece en Inicio en la quincena que le toca.</p>

      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus gastos fijos. Revisa tu conexión.
        </p>
      ) : cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : (
        lista.length > 0 && (
          <ul className="rounded-2xl bg-white p-1 shadow-sm">
            {lista.map((f) => {
              const categoria = porId.get(f.categoriaId);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(f)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50 ${
                      f.activo ? '' : 'opacity-50'
                    }`}
                  >
                    <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{f.nombre}</span>
                      <span className="block text-sm text-slate-500">
                        {etiquetaFrecuencia(f)}
                        {f.activo ? '' : ' · Pausado'}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-800">{formatearMonto(f.monto, moneda)}</span>
                    <Pencil size={16} className="text-slate-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nuevo gasto fijo
      </button>

      <HojaInferior
        abierta={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}
        onCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioFijo
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            fijo={editando === 'nuevo' ? undefined : editando}
            categorias={categorias}
            onListo={() => setEditando(null)}
          />
        )}
      </HojaInferior>
    </div>
  );
}
```

- [ ] **Step 3: Ruta y enlace**

En `src/App.tsx`, importar `import { FijosPage } from './features/ajustes/FijosPage';` y agregar debajo de la ruta de categorías:
```tsx
        <Route path="ajustes/fijos" element={<FijosPage />} />
```

En `src/features/ajustes/AjustesPage.tsx`, agregar `Repeat` al import de `lucide-react`:
```ts
import { CalendarDays, ChevronRight, LogOut, Repeat, Tags, UserRound } from 'lucide-react';
```
y agregar después del enlace de Categorías:
```tsx
        <Link to="/ajustes/fijos" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <Repeat size={20} className="text-emerald-600" />
          <span className="flex-1 font-medium text-slate-800">Gastos fijos</span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/ajustes/FormularioFijo.tsx src/features/ajustes/FijosPage.tsx src/features/ajustes/AjustesPage.tsx src/App.tsx
git commit -m "feat: manage fixed expenses in settings"
```

---

### Task 6: Registro rápido prellenado para pagar un fijo

**Files:**
- Modify: `src/features/movimientos/RegistroRapido.tsx`

**Interfaces:**
- Consumes: `crearMovimiento(uid, datos, origen?)` (Task 4); `OrigenMovimiento`.
- Produces:
  ```ts
  export interface Prellenado { monto: number; categoriaId: string; nota: string; origen: OrigenMovimiento }
  // RegistroRapido props: { abierta: boolean; onCerrar: () => void; movimiento?: Movimiento; prellenado?: Prellenado }
  ```
  Con `prellenado` (y sin `movimiento`): tipo gasto fijo (sin selector de tipo), monto/categoría/nota prellenados, fecha hoy; al guardar crea el movimiento con `origen`.

- [ ] **Step 1: Cambiar props y título**

Reemplazar el bloque desde `interface Props` hasta el final de `RegistroRapido` por:
```tsx
export interface Prellenado {
  monto: number;
  categoriaId: string;
  nota: string;
  origen: OrigenMovimiento;
}

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  movimiento?: Movimiento;
  /** Para registrar el pago de un pendiente (fijo, y luego deuda o meta). Se ignora si hay `movimiento`. */
  prellenado?: Prellenado;
}

export function RegistroRapido({ abierta, onCerrar, movimiento, prellenado }: Props) {
  const pago = movimiento ? undefined : prellenado;
  const titulo = movimiento ? 'Editar movimiento' : pago ? 'Registrar pago' : 'Nuevo movimiento';
  const clave = movimiento?.id ?? (pago ? `pago:${pago.origen.id}` : 'nuevo');
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={titulo}>
      <FormularioMovimiento key={clave} movimiento={movimiento} prellenado={pago} onListo={onCerrar} />
    </HojaInferior>
  );
}
```

Agregar `type OrigenMovimiento` al import de `../../domain/movimientos`.

- [ ] **Step 2: Estado inicial y guardado con origen**

Cambiar la firma y los `useState` iniciales de `FormularioMovimiento`:
```tsx
function FormularioMovimiento({
  movimiento,
  prellenado,
  onListo,
}: {
  movimiento?: Movimiento;
  prellenado?: Prellenado;
  onListo: () => void;
}) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: categorias } = useCategorias(usuario.uid);

  const montoInicial = movimiento?.monto ?? prellenado?.monto;
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? 'gasto');
  const [montoTexto, setMontoTexto] = useState(montoInicial ? agruparMiles(String(montoInicial)) : '');
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoriaId ?? prellenado?.categoriaId ?? '');
  const [fecha, setFecha] = useState(movimiento?.fecha ?? fechaLocalISO());
  const [nota, setNota] = useState(movimiento?.nota ?? prellenado?.nota ?? '');
  const [errores, setErrores] = useState<ErroresMovimiento>({});
```

En `guardar`, cambiar la creación:
```tsx
    const operacion = movimiento
      ? actualizarMovimiento(usuario.uid, movimiento.id, datos)
      : crearMovimiento(usuario.uid, datos, prellenado?.origen);
```

- [ ] **Step 3: Ocultar el selector de tipo al pagar**

Reemplazar `<SelectorTipo valor={tipo} onCambio={cambiarTipo} />` por:
```tsx
      {/* Un pago siempre es gasto: cambiarlo a ingreso rompería planeado vs real. */}
      {!prellenado && <SelectorTipo valor={tipo} onCambio={cambiarTipo} />}
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test`
Expected: sin errores. (`MovimientosPage` e `InicioPage` siguen compilando porque `prellenado` es opcional.)

- [ ] **Step 5: Commit**

```bash
git add src/features/movimientos/RegistroRapido.tsx
git commit -m "feat: prefill quick entry to pay a pending item"
```

---

### Task 7: Inicio — comprometido y "Fijos de esta quincena"

**Files:**
- Create: `src/features/inicio/FijosQuincena.tsx`
- Modify: `src/features/inicio/InicioPage.tsx`

**Interfaces:**
- Consumes: `useFijos` (Task 4); `pendientesDeQuincena`, `comprometido`, `Pendiente` (Task 2); `RegistroRapido`, `Prellenado` (Task 6); `resumenQuincena(movimientos, comprometido)` existente.
- Produces: `FijosQuincena` con props
  ```ts
  { pendientes: readonly Pendiente[]; categorias: ReadonlyMap<string, Categoria>; moneda: string;
    cargando: boolean; error: boolean; onPagar: (p: Pendiente) => void; onAbrirPago: (movimientoId: string) => void }
  ```

- [ ] **Step 1: Crear `src/features/inicio/FijosQuincena.tsx`**

```tsx
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import type { Categoria } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Pendiente } from '../../domain/fijos';

interface Props {
  pendientes: readonly Pendiente[];
  categorias: ReadonlyMap<string, Categoria>;
  moneda: string;
  cargando: boolean;
  error: boolean;
  onPagar: (pendiente: Pendiente) => void;
  onAbrirPago: (movimientoId: string) => void;
}

export function FijosQuincena({ pendientes, categorias, moneda, cargando, error, onPagar, onAbrirPago }: Props) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-slate-900">Fijos de esta quincena</h2>
      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus fijos.
        </p>
      ) : cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
          No tienes gastos fijos en esta quincena.{' '}
          <Link to="/ajustes/fijos" className="font-medium text-emerald-600">
            Agrégalos en Ajustes
          </Link>
        </div>
      ) : (
        <ul className="rounded-2xl bg-white p-1 shadow-sm">
          {pendientes.map((p) => {
            const categoria = categorias.get(p.categoriaId);
            const burbuja = <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />;
            const { pagado } = p;
            return (
              <li key={p.origen.id}>
                {pagado ? (
                  <button
                    type="button"
                    onClick={() => onAbrirPago(pagado.movimientos[0])}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
                  >
                    {burbuja}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-medium text-slate-500">
                        <Check size={16} className="shrink-0 text-emerald-600" aria-label="Pagado" />
                        <span className="truncate">{p.nombre}</span>
                      </span>
                      <Diferencia planeado={p.planeado} real={pagado.monto} moneda={moneda} />
                    </span>
                    <span className="font-semibold tabular-nums text-slate-500">{formatearMonto(pagado.monto, moneda)}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2.5">
                    {burbuja}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{p.nombre}</span>
                      <span className="block text-sm tabular-nums text-slate-500">{formatearMonto(p.planeado, moneda)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onPagar(p)}
                      className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Pagado
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Diferencia({ planeado, real, moneda }: { planeado: number; real: number; moneda: string }) {
  const diferencia = real - planeado;
  if (diferencia === 0) return null;
  const deMas = diferencia > 0;
  return (
    <span className={`block text-sm tabular-nums ${deMas ? 'text-amber-600' : 'text-emerald-600'}`}>
      {deMas ? '+' : '−'}
      {formatearMonto(Math.abs(diferencia), moneda)} vs. planeado
    </span>
  );
}
```

- [ ] **Step 2: Reescribir `src/features/inicio/InicioPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { useCategorias, useFijos, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import { comprometido, pendientesDeQuincena, type Pendiente } from '../../domain/fijos';
import type { Movimiento } from '../../domain/movimientos';
import { resumenQuincena } from '../../domain/presupuesto';
import { DIAS_PAGO_POR_DEFECTO, etiquetaQuincena, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido, type Prellenado } from '../movimientos/RegistroRapido';
import { FijosQuincena } from './FijosQuincena';
import { GastoPorCategoria } from './GastoPorCategoria';

const CANTIDAD_ULTIMOS = 5;

type Hoja = { movimiento: Movimiento } | { prellenado: Prellenado } | null;

export function InicioPage() {
  const usuario = useUsuario();
  const [hoja, setHoja] = useState<Hoja>(null);

  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const quincena = quincenaDe(new Date(), perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO);
  const { datos: movimientos, cargando, error } = useMovimientosEntre(usuario.uid, quincena.desde, quincena.hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const fijos = useFijos(usuario.uid);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const pendientes = pendientesDeQuincena(fijos.datos, quincena, movimientos);
  const resumen = resumenQuincena(movimientos, comprometido(pendientes));
  const ultimos = movimientos.slice(0, CANTIDAD_ULTIMOS);
  const nombre = (perfil?.nombre || usuario.displayName || '').split(' ')[0];

  function pagar(p: Pendiente) {
    setHoja({ prellenado: { monto: p.planeado, categoriaId: p.categoriaId, nota: p.nombre, origen: p.origen } });
  }

  function abrirPago(movimientoId: string) {
    const encontrado = movimientos.find((m) => m.id === movimientoId);
    if (encontrado) setHoja({ movimiento: encontrado });
  }

  return (
    <div className="space-y-5">
      <p className="text-slate-500">Hola{nombre ? `, ${nombre}` : ''} 👋</p>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-sm opacity-80">Quincena actual · {etiquetaQuincena(quincena)}</p>
        <p className="mt-3 text-sm opacity-80">Disponible</p>
        <p className="text-3xl font-bold tabular-nums">{formatearMonto(resumen.disponible, moneda)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0">
            <p className="opacity-80">Ingresos</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.ingresos, moneda)}</p>
          </div>
          <div className="min-w-0">
            <p className="opacity-80">Gastado</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.gastado, moneda)}</p>
          </div>
          <div className="min-w-0">
            <p className="opacity-80">Comprometido</p>
            <p className="truncate font-semibold tabular-nums">{formatearMonto(resumen.comprometido, moneda)}</p>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus movimientos. Revisa tu conexión.
        </p>
      )}

      <FijosQuincena
        pendientes={pendientes}
        categorias={porId}
        moneda={moneda}
        cargando={fijos.cargando || cargando}
        error={fijos.error}
        onPagar={pagar}
        onAbrirPago={abrirPago}
      />

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">¿En qué se fue?</h2>
        {cargando ? (
          <p className="py-6 text-center text-slate-400">Cargando…</p>
        ) : (
          <GastoPorCategoria movimientos={movimientos} categorias={porId} moneda={moneda} />
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Últimos movimientos</h2>
          <Link to="/movimientos" className="text-sm font-medium text-emerald-600">
            Ver todos
          </Link>
        </div>
        {cargando ? (
          <p className="py-6 text-center text-slate-400">Cargando…</p>
        ) : ultimos.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
            Aún no tienes movimientos en esta quincena.
            <br />
            Toca <strong className="text-emerald-600">+</strong> para registrar el primero.
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-1 shadow-sm">
            {ultimos.map((m) => (
              <FilaMovimiento
                key={m.id}
                movimiento={m}
                categoria={porId.get(m.categoriaId)}
                moneda={moneda}
                onClick={() => setHoja({ movimiento: m })}
              />
            ))}
          </div>
        )}
      </section>

      <RegistroRapido
        abierta={hoja !== null}
        movimiento={hoja && 'movimiento' in hoja ? hoja.movimiento : undefined}
        prellenado={hoja && 'prellenado' in hoja ? hoja.prellenado : undefined}
        onCerrar={() => setHoja(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/inicio/FijosQuincena.tsx src/features/inicio/InicioPage.tsx
git commit -m "feat: show fortnight fixed expenses and committed amount on home"
```

---

### Task 8: Verificación de integración

**Files:** ninguno (solo correcciones si algo falla, cada una con su commit `fix:`).

- [ ] **Step 1: Checks automáticos**

Run: `npm run typecheck && npm test && npm run test:rules && npm run build`
Expected: todo PASS.

- [ ] **Step 2: Prueba manual con emuladores** (`npm run emuladores` en una terminal, `npm run dev:emu` en otra; la usuaria abre la app en el navegador o celular)

Checklist:
1. Ajustes → Gastos fijos: crear "Arriendo" mensual Q1 de 900.000 y "Internet" quincenal de 80.000. Aparecen en la lista con su etiqueta.
2. Editar "Arriendo" a quincenal y guardar → sin toast de error; la etiqueta cambia a "Quincenal". Volver a mensual Q1.
3. Inicio: los fijos que aplican a la quincena actual aparecen como pendientes; "Comprometido" = suma de sus montos; "Disponible" lo descuenta.
4. Tocar "Pagado" en Internet → la hoja dice "Registrar pago", sin selector Gasto/Ingreso, con 80.000, categoría y nota "Internet". Cambiar a 85.000 y guardar → la fila pasa a pagados con ✓, 85.000 y "+5.000 vs. planeado" en ámbar; Comprometido baja 80.000.
5. Tocar la fila pagada → abre "Editar movimiento"; cambiar la nota y guardar → sigue pagado.
6. Borrar ese movimiento → Internet vuelve a pendiente.
7. Pausar un fijo sin pagar → desaparece de Inicio y del comprometido. Pausar uno pagado → sigue visible como pagado.
8. Eliminar un fijo pagado → pide confirmación; el movimiento sigue en Movimientos.
9. Con un fijo de categoría archivada: al editarlo la categoría sigue marcada.

- [ ] **Step 3: Reportar**

Resumen a la usuaria con lo verificado y lo que no se pudo verificar. No hacer `push` ni `merge` sin permiso.
