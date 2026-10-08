# Fase 2 — Quincenas, resumen y gasto por categoría — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada usuario configura sus días de pago y moneda; la app calcula la quincena actual por día de pago, muestra en Inicio el resumen de la quincena con una dona de gasto por categoría, y Movimientos se puede ver por mes o por quincena.

**Architecture:** Igual que la fase 1. Lógica nueva en funciones puras (`src/domain/quincena.ts`, `src/domain/presupuesto.ts`) con TDD; reglas de Firestore ampliadas para validar el perfil (probadas en emulador); dona dibujada con SVG propio (sin librería de gráficas).

**Tech Stack:** React 19, Vite 8, TypeScript 7, Tailwind 4, Firebase 12, date-fns, Vitest, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-06-app-finanzas-design.md` (§4.1, §4.2, §6, §11 punto 2). Base: rama `feat/fase-1` (plan `docs/superpowers/plans/2026-10-06-fase-1-base-registro.md`).

## Global Constraints

- Costo $0, sin Cloud Functions. Montos enteros. Fechas `'YYYY-MM-DD'` locales.
- Quincena **por día de pago**: empieza el día de pago y termina el día anterior al siguiente pago. Si el día no existe en el mes, se usa el último día del mes. `diasPago` se guarda **ordenado ascendente**; "Q1" empieza en `diasPago[0]`.
- `diasPago` por defecto `[15, 30]`; moneda por defecto `COP`.
- "Comprometido" (spec §4.2) vale 0 en esta fase; los gastos fijos llegan en la fase 3. La función ya lo recibe como parámetro.
- Sin dependencias nuevas.
- Escrituras a Firestore no se esperan en la UI (offline).
- Permisos: la usuaria autorizó ejecución directa y commits por tarea; `push`/`merge`/`deploy` se preguntan.

## Review Focus

1. **Cruce de mes y de año en la quincena** (30 sep → 14 oct, 30 dic → 14 ene) → rango correcto. Pruebas en Task 2.
2. **Febrero con día de pago 30** → la quincena empieza el 28 (o 29 en bisiesto) y no se pierde ni se duplica ningún día. Pruebas en Task 2.
3. **Días de pago inválidos** (0, 32, iguales, decimales, uno solo, desordenados) → la UI lo rechaza con mensaje y las reglas también. Pruebas en Tasks 2 y 4.
4. **Moneda no soportada** escrita en el perfil → las reglas la rechazan, para que `formatearMonto` nunca lance error al pintar. Pruebas en Task 4.
5. **Cambiar de periodo en Movimientos** → nunca se ven los totales del periodo anterior bajo el título del nuevo, y un error de carga no deja "Cargando…" para siempre. Cambio en Task 5, verificado por typecheck + smoke.

---

## Mapa de archivos

```
src/domain/fechas.ts (+ fechaCorta)            src/domain/fechas.test.ts
src/domain/quincena.ts                          src/domain/quincena.test.ts
src/domain/presupuesto.ts                       src/domain/presupuesto.test.ts
src/domain/dinero.ts (+ MONEDAS_DISPONIBLES)    src/domain/dinero.test.ts
firestore.rules (perfil validado)               tests/rules/firestore.rules.test.ts
src/data/usuario.ts (+ actualizarPerfil, diasPago tipado)
src/data/categorias.ts, src/data/movimientos.ts (callback de error)
src/data/hooks.ts (reinicio por clave, estado de error)
src/components/GraficaDona.tsx
src/features/inicio/InicioPage.tsx, src/features/inicio/GastoPorCategoria.tsx
src/features/movimientos/MovimientosPage.tsx
src/features/ajustes/QuincenasPage.tsx, AjustesPage.tsx, src/App.tsx
```

---

### Task 1: `fechaCorta`

**Files:** Modify `src/domain/fechas.ts`, `src/domain/fechas.test.ts`

**Interfaces:**
- Produces: `fechaCorta(iso: string): string` → `'30 sep'`

- [ ] **Step 1: Prueba** — agregar a `src/domain/fechas.test.ts` (y `fechaCorta` al import):

```ts
describe('fechaCorta', () => {
  it('muestra día y mes abreviado', () => {
    expect(fechaCorta('2026-09-30')).toBe('30 sep');
    expect(fechaCorta('2027-01-04')).toBe('4 ene');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/domain/fechas.test.ts` → FAIL (`fechaCorta is not a function`).

- [ ] **Step 3: Implementar** — agregar al final de `src/domain/fechas.ts`:

```ts
export function fechaCorta(iso: string): string {
  const fecha = parseISO(iso);
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}
```

- [ ] **Step 4:** misma prueba → PASS.
- [ ] **Step 5:** commit `feat: add short date label`.

---

### Task 2: Quincenas por día de pago

**Files:** Create `src/domain/quincena.ts`, `src/domain/quincena.test.ts`

**Interfaces:**
- Consumes: `fechaLocalISO`, `fechaCorta` (fechas.ts).
- Produces:
  - `type DiasPago = [number, number]`
  - `DIAS_PAGO_POR_DEFECTO: DiasPago` = `[15, 30]`
  - `interface Quincena { numero: 1 | 2; desde: string; hasta: string }` (ambos inclusive)
  - `ordenarDiasPago(d: DiasPago): DiasPago`
  - `quincenaDe(fecha: Date | string, diasPago: DiasPago): Quincena`
  - `desplazarQuincena(q: Quincena, delta: number, diasPago: DiasPago): Quincena`
  - `etiquetaQuincena(q: Quincena): string` → `'30 sep – 14 oct'`
  - `validarDiasPago(d1: number, d2: number): string | null`

- [ ] **Step 1: Pruebas**

```ts
// src/domain/quincena.test.ts
import { describe, expect, it } from 'vitest';
import {
  desplazarQuincena,
  etiquetaQuincena,
  ordenarDiasPago,
  quincenaDe,
  validarDiasPago,
  type DiasPago,
} from './quincena';

const PAGO: DiasPago = [15, 30];

describe('quincenaDe con pago 15 y 30', () => {
  it.each([
    ['2026-10-06', { numero: 2, desde: '2026-09-30', hasta: '2026-10-14' }],
    ['2026-10-14', { numero: 2, desde: '2026-09-30', hasta: '2026-10-14' }],
    ['2026-10-15', { numero: 1, desde: '2026-10-15', hasta: '2026-10-29' }],
    ['2026-10-29', { numero: 1, desde: '2026-10-15', hasta: '2026-10-29' }],
    ['2026-10-30', { numero: 2, desde: '2026-10-30', hasta: '2026-11-14' }],
    ['2026-10-31', { numero: 2, desde: '2026-10-30', hasta: '2026-11-14' }],
  ])('%s', (fecha, esperada) => {
    expect(quincenaDe(fecha, PAGO)).toEqual(esperada);
  });

  it('febrero: el pago del 30 cae el último día del mes', () => {
    expect(quincenaDe('2026-02-20', PAGO)).toEqual({ numero: 1, desde: '2026-02-15', hasta: '2026-02-27' });
    expect(quincenaDe('2026-02-28', PAGO)).toEqual({ numero: 2, desde: '2026-02-28', hasta: '2026-03-14' });
    expect(quincenaDe('2026-03-05', PAGO)).toEqual({ numero: 2, desde: '2026-02-28', hasta: '2026-03-14' });
    expect(quincenaDe('2028-02-29', PAGO)).toEqual({ numero: 2, desde: '2028-02-29', hasta: '2028-03-14' });
  });

  it('cruza el año', () => {
    expect(quincenaDe('2026-12-31', PAGO)).toEqual({ numero: 2, desde: '2026-12-30', hasta: '2027-01-14' });
    expect(quincenaDe('2027-01-10', PAGO)).toEqual({ numero: 2, desde: '2026-12-30', hasta: '2027-01-14' });
  });

  it('acepta Date local aunque sea de noche', () => {
    expect(quincenaDe(new Date(2026, 9, 14, 23, 30), PAGO).hasta).toBe('2026-10-14');
  });
});

describe('quincenaDe con otros días', () => {
  it('pago 1 y 15', () => {
    expect(quincenaDe('2026-10-06', [1, 15])).toEqual({ numero: 1, desde: '2026-10-01', hasta: '2026-10-14' });
    expect(quincenaDe('2026-10-20', [1, 15])).toEqual({ numero: 2, desde: '2026-10-15', hasta: '2026-10-31' });
  });

  it('el orden de los días no importa', () => {
    expect(quincenaDe('2026-10-06', [30, 15])).toEqual(quincenaDe('2026-10-06', [15, 30]));
  });
});

describe('desplazarQuincena', () => {
  const actual = quincenaDe('2026-10-06', PAGO);

  it('avanza y retrocede una quincena', () => {
    expect(desplazarQuincena(actual, 1, PAGO)).toEqual({ numero: 1, desde: '2026-10-15', hasta: '2026-10-29' });
    expect(desplazarQuincena(actual, -1, PAGO)).toEqual({ numero: 1, desde: '2026-09-15', hasta: '2026-09-29' });
  });

  it('avanza varias quincenas y 0 no cambia nada', () => {
    expect(desplazarQuincena(actual, 2, PAGO)).toEqual({ numero: 2, desde: '2026-10-30', hasta: '2026-11-14' });
    expect(desplazarQuincena(actual, 0, PAGO)).toEqual(actual);
  });
});

describe('etiquetaQuincena', () => {
  it('muestra el rango', () => {
    expect(etiquetaQuincena({ numero: 2, desde: '2026-09-30', hasta: '2026-10-14' })).toBe('30 sep – 14 oct');
  });
});

describe('días de pago', () => {
  it('ordena ascendente', () => {
    expect(ordenarDiasPago([30, 15])).toEqual([15, 30]);
  });

  it('valida rango, enteros y que sean distintos', () => {
    expect(validarDiasPago(15, 30)).toBeNull();
    expect(validarDiasPago(0, 15)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15, 32)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15.5, 30)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(Number.NaN, 30)).toBe('Usa días entre 1 y 31');
    expect(validarDiasPago(15, 15)).toBe('Los días de pago deben ser distintos');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/domain/quincena.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
// src/domain/quincena.ts
import { addDays, lastDayOfMonth, parseISO } from 'date-fns';
import { fechaCorta, fechaLocalISO } from './fechas';

export type DiasPago = [number, number];

export const DIAS_PAGO_POR_DEFECTO: DiasPago = [15, 30];

export interface Quincena {
  numero: 1 | 2;
  /** 'YYYY-MM-DD', inclusive */
  desde: string;
  /** 'YYYY-MM-DD', inclusive */
  hasta: string;
}

/** Día de pago dentro del mes; si el mes es más corto, el último día. `mes` puede salirse de 0–11. */
function diaDePago(anio: number, mes: number, dia: number): Date {
  const ultimo = lastDayOfMonth(new Date(anio, mes, 1));
  return new Date(ultimo.getFullYear(), ultimo.getMonth(), Math.min(dia, ultimo.getDate()));
}

function crear(numero: 1 | 2, inicio: Date, siguienteInicio: Date): Quincena {
  return { numero, desde: fechaLocalISO(inicio), hasta: fechaLocalISO(addDays(siguienteInicio, -1)) };
}

export function ordenarDiasPago([a, b]: DiasPago): DiasPago {
  return a <= b ? [a, b] : [b, a];
}

export function quincenaDe(fecha: Date | string, diasPago: DiasPago): Quincena {
  const base = typeof fecha === 'string' ? parseISO(fecha) : fecha;
  const anio = base.getFullYear();
  const mes = base.getMonth();
  const dia = new Date(anio, mes, base.getDate());
  const [d1, d2] = ordenarDiasPago(diasPago);
  const pago1 = diaDePago(anio, mes, d1);
  const pago2 = diaDePago(anio, mes, d2);

  if (dia >= pago2) return crear(2, pago2, diaDePago(anio, mes + 1, d1));
  if (dia >= pago1) return crear(1, pago1, pago2);
  return crear(2, diaDePago(anio, mes - 1, d2), pago1);
}

export function desplazarQuincena(quincena: Quincena, delta: number, diasPago: DiasPago): Quincena {
  let actual = quincena;
  for (let i = 0; i < Math.abs(delta); i++) {
    actual =
      delta > 0
        ? quincenaDe(addDays(parseISO(actual.hasta), 1), diasPago)
        : quincenaDe(addDays(parseISO(actual.desde), -1), diasPago);
  }
  return actual;
}

export function etiquetaQuincena(quincena: Quincena): string {
  return `${fechaCorta(quincena.desde)} – ${fechaCorta(quincena.hasta)}`;
}

export function validarDiasPago(d1: number, d2: number): string | null {
  const valido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
  if (!valido(d1) || !valido(d2)) return 'Usa días entre 1 y 31';
  if (d1 === d2) return 'Los días de pago deben ser distintos';
  return null;
}
```

- [ ] **Step 4:** misma prueba → PASS; `npm test` todo verde.
- [ ] **Step 5:** commit `feat: add pay-day based fortnight calculation`.

---

### Task 3: Resumen de quincena y gasto por categoría

**Files:** Create `src/domain/presupuesto.ts`, `src/domain/presupuesto.test.ts`

**Interfaces:**
- Consumes: `sumarPorTipo`, `DatosMovimiento` (movimientos.ts).
- Produces:
  - `interface ResumenQuincena { ingresos: number; gastado: number; comprometido: number; disponible: number }`
  - `resumenQuincena(movimientos: readonly DatosMovimiento[], comprometido?: number): ResumenQuincena`
  - `interface GastoCategoria { categoriaId: string; total: number; porcentaje: number }`
  - `gastoPorCategoria(movimientos: readonly DatosMovimiento[]): GastoCategoria[]` (solo gastos, mayor a menor)

- [ ] **Step 1: Pruebas**

```ts
// src/domain/presupuesto.test.ts
import { describe, expect, it } from 'vitest';
import type { DatosMovimiento } from './movimientos';
import { gastoPorCategoria, resumenQuincena } from './presupuesto';

const gasto = (categoriaId: string, monto: number): DatosMovimiento => ({ tipo: 'gasto', monto, categoriaId, fecha: '2026-10-06' });
const ingreso = (monto: number): DatosMovimiento => ({ tipo: 'ingreso', monto, categoriaId: 'salario', fecha: '2026-10-06' });

describe('resumenQuincena', () => {
  it('disponible = ingresos − gastado − comprometido', () => {
    const lista = [ingreso(2000000), gasto('comida', 300000), gasto('transporte', 50000)];
    expect(resumenQuincena(lista, 100000)).toEqual({ ingresos: 2000000, gastado: 350000, comprometido: 100000, disponible: 1550000 });
  });

  it('comprometido es 0 por defecto y el disponible puede ser negativo', () => {
    expect(resumenQuincena([gasto('comida', 1000)])).toEqual({ ingresos: 0, gastado: 1000, comprometido: 0, disponible: -1000 });
  });
});

describe('gastoPorCategoria', () => {
  it('suma solo gastos por categoría, de mayor a menor, con porcentaje', () => {
    const lista = [gasto('comida', 300), gasto('transporte', 100), gasto('comida', 200), ingreso(9999)];
    const resultado = gastoPorCategoria(lista);
    expect(resultado.map((g) => [g.categoriaId, g.total])).toEqual([['comida', 500], ['transporte', 100]]);
    expect(resultado[0].porcentaje).toBeCloseTo(83.33, 2);
    expect(resultado.reduce((s, g) => s + g.porcentaje, 0)).toBeCloseTo(100, 6);
  });

  it('desempata por id para un orden estable', () => {
    expect(gastoPorCategoria([gasto('b', 100), gasto('a', 100)]).map((g) => g.categoriaId)).toEqual(['a', 'b']);
  });

  it('lista vacía o solo ingresos da []', () => {
    expect(gastoPorCategoria([])).toEqual([]);
    expect(gastoPorCategoria([ingreso(5)])).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/domain/presupuesto.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/domain/presupuesto.ts
import { sumarPorTipo, type DatosMovimiento } from './movimientos';

export interface ResumenQuincena {
  ingresos: number;
  gastado: number;
  comprometido: number;
  disponible: number;
}

export function resumenQuincena(movimientos: readonly DatosMovimiento[], comprometido = 0): ResumenQuincena {
  const { ingresos, gastos } = sumarPorTipo(movimientos);
  return { ingresos, gastado: gastos, comprometido, disponible: ingresos - gastos - comprometido };
}

export interface GastoCategoria {
  categoriaId: string;
  total: number;
  porcentaje: number;
}

export function gastoPorCategoria(movimientos: readonly DatosMovimiento[]): GastoCategoria[] {
  const totales = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo === 'gasto') totales.set(m.categoriaId, (totales.get(m.categoriaId) ?? 0) + m.monto);
  }
  const suma = [...totales.values()].reduce((a, b) => a + b, 0);
  return [...totales.entries()]
    .map(([categoriaId, total]) => ({ categoriaId, total, porcentaje: (total / suma) * 100 }))
    .sort((a, b) => b.total - a.total || a.categoriaId.localeCompare(b.categoriaId));
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: add fortnight summary and spending by category`.

---

### Task 4: Monedas, validación del perfil en reglas y `actualizarPerfil`

**Files:** Modify `src/domain/dinero.ts`, `src/domain/dinero.test.ts`, `firestore.rules`, `tests/rules/firestore.rules.test.ts`, `src/data/usuario.ts`

**Interfaces:**
- Produces:
  - `MONEDAS_DISPONIBLES: readonly { codigo: string; nombre: string }[]` (COP, USD, EUR, MXN, PEN, CLP, ARS)
  - `Perfil.diasPago: DiasPago`; `type CambiosPerfil = Partial<Pick<Perfil, 'moneda' | 'diasPago'>>`
  - `actualizarPerfil(uid: string, cambios: CambiosPerfil): Promise<void>`

- [ ] **Step 1: Prueba de monedas** — agregar a `dinero.test.ts` (y `MONEDAS_DISPONIBLES` al import):

```ts
describe('MONEDAS_DISPONIBLES', () => {
  it('todas se pueden formatear y COP va primero', () => {
    expect(MONEDAS_DISPONIBLES[0].codigo).toBe('COP');
    for (const { codigo } of MONEDAS_DISPONIBLES) expect(() => formatearMonto(1000, codigo)).not.toThrow();
  });
});
```

- [ ] **Step 2: Pruebas de reglas** — agregar a `tests/rules/firestore.rules.test.ts` (importar `MONEDAS_DISPONIBLES` desde `'../../src/domain/dinero'`):

```ts
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
  ])('rechaza %s', async (_n, cambio) => {
    await assertFails(setDoc(perfil(ALICIA), { ...base, ...cambio }));
  });
});
```

- [ ] **Step 3:** `npx vitest run src/domain/dinero.test.ts` → FAIL; `npm run test:rules` → FAIL (los `rechaza` pasan hoy porque las reglas aceptan cualquier perfil → `assertFails` falla).

- [ ] **Step 4: Implementar**

`src/domain/dinero.ts` (al inicio):

```ts
export const MONEDAS_DISPONIBLES: readonly { codigo: string; nombre: string }[] = [
  { codigo: 'COP', nombre: 'Peso colombiano' },
  { codigo: 'USD', nombre: 'Dólar estadounidense' },
  { codigo: 'EUR', nombre: 'Euro' },
  { codigo: 'MXN', nombre: 'Peso mexicano' },
  { codigo: 'PEN', nombre: 'Sol peruano' },
  { codigo: 'CLP', nombre: 'Peso chileno' },
  { codigo: 'ARS', nombre: 'Peso argentino' },
];
```

`firestore.rules` — reemplazar `allow read, write: if esDueno(uid);` de `match /users/{uid}` por:

```
      function perfilValido() {
        let d = request.resource.data;
        return (!('moneda' in d) || d.moneda in ['COP', 'USD', 'EUR', 'MXN', 'PEN', 'CLP', 'ARS'])
          && (!('diasPago' in d) || (
            d.diasPago is list && d.diasPago.size() == 2
            && d.diasPago[0] is int && d.diasPago[1] is int
            && d.diasPago[0] >= 1 && d.diasPago[0] <= 31
            && d.diasPago[1] >= 1 && d.diasPago[1] <= 31
            && d.diasPago[0] != d.diasPago[1]));
      }

      allow read, delete: if esDueno(uid);
      allow create, update: if esDueno(uid) && perfilValido();
```

`src/data/usuario.ts` — importar `updateDoc` y `type DiasPago`, cambiar el tipo y agregar:

```ts
export interface Perfil {
  nombre: string;
  email: string;
  moneda: string;
  diasPago: DiasPago;
}

export type CambiosPerfil = Partial<Pick<Perfil, 'moneda' | 'diasPago'>>;

export function actualizarPerfil(uid: string, cambios: CambiosPerfil): Promise<void> {
  return updateDoc(doc(db, 'users', uid), cambios);
}
```

y en `asegurarPerfil` usar `diasPago: DIAS_PAGO_POR_DEFECTO` en lugar de `[15, 30]`.

- [ ] **Step 5:** `npm test` → PASS; `npm run test:rules` → PASS; `npm run typecheck` limpio.
- [ ] **Step 6:** commit `feat: validate profile currency and pay days`.

---

### Task 5: Hooks — reinicio al cambiar de periodo y estado de error

**Files:** Modify `src/data/hooks.ts`, `src/data/usuario.ts`, `src/data/categorias.ts`, `src/data/movimientos.ts`

**Interfaces:**
- Produces: `Escucha<T> = { datos: T; cargando: boolean; error: boolean }`. Las funciones `escucharX(...)` reciben un último parámetro opcional `alFallar?: (error: unknown) => void`.

Sin pruebas unitarias (no hay infraestructura de pruebas de componentes); se verifica con typecheck y el smoke de emulador.

- [ ] **Step 1:** En `escucharPerfil`, `escucharCategorias` y `escucharMovimientosEntre`, agregar el parámetro `alFallar?: (error: unknown) => void` y cambiar el callback de error a:

```ts
    (error) => {
      console.error('Error escuchando <colección>', error);
      alFallar?.(error);
    },
```

- [ ] **Step 2:** Reemplazar `useEscucha` en `src/data/hooks.ts`:

```ts
interface Escucha<T> {
  datos: T;
  cargando: boolean;
  error: boolean;
}

type Suscribir<T> = (alCambiar: (datos: T) => void, alFallar: () => void) => Unsubscribe;

/** Mantiene una suscripción de Firestore viva mientras `clave` no cambie. */
function useEscucha<T>(suscribir: Suscribir<T>, clave: string, inicial: T): Escucha<T> {
  const [estado, setEstado] = useState<Escucha<T>>({ datos: inicial, cargando: true, error: false });

  useEffect(() => {
    // Se descartan los datos anteriores: evita mostrar totales de otro periodo bajo el título nuevo.
    setEstado({ datos: inicial, cargando: true, error: false });
    return suscribir(
      (datos) => setEstado({ datos, cargando: false, error: false }),
      () => setEstado((previo) => ({ ...previo, cargando: false, error: true })),
    );
    // `clave` resume todos los parámetros de `suscribir`.
  }, [clave]);

  return estado;
}
```

y los hooks pasan `(cb, falla) => escucharX(..., cb, falla)`.

- [ ] **Step 3:** `npm run typecheck` limpio; `npm test` verde.
- [ ] **Step 4:** commit `fix: reset subscription data on period change and surface load errors`.

---

### Task 6: Gráfica de dona (SVG)

**Files:** Create `src/components/GraficaDona.tsx`

**Interfaces:**
- Produces: `<GraficaDona segmentos={{ id, valor, color, etiqueta }[]} centro={string} subcentro={string} />`

Antes de escribir: cargar el skill `dataviz` y aplicar sus reglas que no contradigan el spec (los colores son los de cada categoría, elegidos por la usuaria).

- [ ] **Step 1: Implementar**

```tsx
// src/components/GraficaDona.tsx
export interface SegmentoDona {
  id: string;
  valor: number;
  color: string;
  etiqueta: string;
}

interface Props {
  segmentos: readonly SegmentoDona[];
  centro: string;
  subcentro: string;
}

const RADIO = 40;
const GROSOR = 14;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const SEPARACION = 1.2;

export function GraficaDona({ segmentos, centro, subcentro }: Props) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0);
  const separacion = segmentos.length > 1 ? SEPARACION : 0;
  const arcos = segmentos.reduce<{ id: string; color: string; largo: number; inicio: number }[]>((lista, s) => {
    const inicio = lista.length ? lista[lista.length - 1].inicio + lista[lista.length - 1].largo : 0;
    lista.push({ id: s.id, color: s.color, largo: total > 0 ? (s.valor / total) * CIRCUNFERENCIA : 0, inicio });
    return lista;
  }, []);
  const descripcion = segmentos.map((s) => `${s.etiqueta} ${Math.round((s.valor / (total || 1)) * 100)}%`).join(', ');

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Gasto por categoría: ${descripcion || 'sin gastos'}`}>
        <circle cx="50" cy="50" r={RADIO} fill="none" stroke="#e2e8f0" strokeWidth={GROSOR} />
        {arcos.map((a) => (
          <circle
            key={a.id}
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke={a.color}
            strokeWidth={GROSOR}
            strokeDasharray={`${Math.max(a.largo - separacion, 0)} ${CIRCUNFERENCIA}`}
            strokeDashoffset={-a.inicio}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold tabular-nums text-slate-900">{centro}</span>
        <span className="text-xs text-slate-500">{subcentro}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** `npm run typecheck` limpio. **Step 3:** commit `feat: add svg donut chart`.

---

### Task 7: Inicio por quincena

**Files:** Create `src/features/inicio/GastoPorCategoria.tsx`; Modify `src/features/inicio/InicioPage.tsx`

**Interfaces:**
- Consumes: `quincenaDe`, `etiquetaQuincena`, `DIAS_PAGO_POR_DEFECTO` (Task 2); `resumenQuincena`, `gastoPorCategoria` (Task 3); `GraficaDona` (Task 6); hooks con `error` (Task 5).

- [ ] **Step 1: `GastoPorCategoria.tsx`**

```tsx
// src/features/inicio/GastoPorCategoria.tsx
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { GraficaDona } from '../../components/GraficaDona';
import type { Categoria } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Movimiento } from '../../domain/movimientos';
import { gastoPorCategoria } from '../../domain/presupuesto';

interface Props {
  movimientos: readonly Movimiento[];
  categorias: ReadonlyMap<string, Categoria>;
  moneda: string;
}

export function GastoPorCategoria({ movimientos, categorias, moneda }: Props) {
  const gastos = gastoPorCategoria(movimientos);
  const total = gastos.reduce((suma, g) => suma + g.total, 0);

  if (gastos.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">Sin gastos en esta quincena.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <GraficaDona
        segmentos={gastos.map((g) => ({
          id: g.categoriaId,
          valor: g.total,
          color: categorias.get(g.categoriaId)?.color ?? '#94a3b8',
          etiqueta: categorias.get(g.categoriaId)?.nombre ?? 'Sin categoría',
        }))}
        centro={formatearMonto(total, moneda)}
        subcentro="gastado"
      />
      <ul className="w-full space-y-1">
        {gastos.map((g) => {
          const categoria = categorias.get(g.categoriaId);
          return (
            <li key={g.categoriaId} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{categoria?.nombre ?? 'Sin categoría'}</span>
              <span className="text-sm text-slate-400 tabular-nums">{Math.round(g.porcentaje)}%</span>
              <span className="w-28 text-right font-semibold tabular-nums text-slate-800">{formatearMonto(g.total, moneda)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `InicioPage.tsx`**

```tsx
// src/features/inicio/InicioPage.tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import type { Movimiento } from '../../domain/movimientos';
import { resumenQuincena } from '../../domain/presupuesto';
import { DIAS_PAGO_POR_DEFECTO, etiquetaQuincena, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from '../movimientos/RegistroRapido';
import { GastoPorCategoria } from './GastoPorCategoria';

const CANTIDAD_ULTIMOS = 5;

export function InicioPage() {
  const usuario = useUsuario();
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const quincena = quincenaDe(new Date(), perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO);
  const { datos: movimientos, cargando, error } = useMovimientosEntre(usuario.uid, quincena.desde, quincena.hasta);
  const { datos: categorias } = useCategorias(usuario.uid);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const resumen = resumenQuincena(movimientos);
  const ultimos = movimientos.slice(0, CANTIDAD_ULTIMOS);
  const nombre = (perfil?.nombre || usuario.displayName || '').split(' ')[0];

  return (
    <div className="space-y-5">
      <p className="text-slate-500">Hola{nombre ? `, ${nombre}` : ''} 👋</p>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-sm opacity-80">
          Quincena actual · {etiquetaQuincena(quincena)}
        </p>
        <p className="mt-3 text-sm opacity-80">Disponible</p>
        <p className="text-3xl font-bold tabular-nums">{formatearMonto(resumen.disponible, moneda)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="opacity-80">Ingresos</p>
            <p className="font-semibold tabular-nums">{formatearMonto(resumen.ingresos, moneda)}</p>
          </div>
          <div>
            <p className="opacity-80">Gastado</p>
            <p className="font-semibold tabular-nums">{formatearMonto(resumen.gastado, moneda)}</p>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus movimientos. Revisa tu conexión.
        </p>
      )}

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
              <FilaMovimiento key={m.id} movimiento={m} categoria={porId.get(m.categoriaId)} moneda={moneda} onClick={() => setEditando(m)} />
            ))}
          </div>
        )}
      </section>

      <RegistroRapido abierta={editando !== undefined} movimiento={editando} onCerrar={() => setEditando(undefined)} />
    </div>
  );
}
```

- [ ] **Step 3:** `npm run typecheck` limpio. **Step 4:** commit `feat: show current fortnight summary and spending donut on home`.

---

### Task 8: Movimientos por mes o por quincena

**Files:** Modify `src/features/movimientos/MovimientosPage.tsx`

**Interfaces:**
- Consumes: `quincenaDe`, `desplazarQuincena`, `etiquetaQuincena`, `DIAS_PAGO_POR_DEFECTO` (Task 2); hooks con `error` (Task 5).

- [ ] **Step 1:** Cambios en `MovimientosPage.tsx`:
  - Estado nuevo `vista: 'mes' | 'quincena'` (inicial `'quincena'`) y `desplazamiento: number` (quincenas respecto a la actual, inicial 0).
  - `diasPago = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO`; `quincena = desplazarQuincena(quincenaDe(new Date(), diasPago), desplazamiento, diasPago)`.
  - Rango: `vista === 'mes' ? rangoMes(mes.anio, mes.mes) : { desde: quincena.desde, hasta: quincena.hasta }`.
  - Título: mes → `nombreMes(...)`; quincena → `Quincena ${quincena.numero} · ${etiquetaQuincena(quincena)}`.
  - Flechas: en mes mueven `mes`; en quincena mueven `desplazamiento`.
  - Selector segmentado arriba ("Quincena" | "Mes") con el mismo estilo de `SelectorTipo` (`rounded-2xl bg-slate-100 p-1`, botón activo `bg-white shadow-sm text-emerald-600`), `role="radiogroup"`/`role="radio"`.
  - Mensaje de error como en Inicio si `error`; "No hay movimientos en este periodo." en vacío.
  - El filtro por categoría incluye también las **archivadas** (al final, con sufijo " (archivada)") — cierra el pendiente menor de la fase 1.

Código completo del componente:

```tsx
// src/features/movimientos/MovimientosPage.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { TarjetaResumen } from '../../components/TarjetaResumen';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { categoriasActivas } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import { desplazarMes, etiquetaFecha, mesActual, nombreMes, rangoMes, type MesAnio } from '../../domain/fechas';
import { agruparPorFecha, sumarPorTipo, type Movimiento } from '../../domain/movimientos';
import { DIAS_PAGO_POR_DEFECTO, desplazarQuincena, etiquetaQuincena, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from './RegistroRapido';

type Vista = 'quincena' | 'mes';

const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'quincena', etiqueta: 'Quincena' },
  { valor: 'mes', etiqueta: 'Mes' },
];

export function MovimientosPage() {
  const usuario = useUsuario();
  const [vista, setVista] = useState<Vista>('quincena');
  const [mes, setMes] = useState<MesAnio>(() => mesActual());
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';
  const diasPago = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const quincena = desplazarQuincena(quincenaDe(new Date(), diasPago), desplazamiento, diasPago);

  const { desde, hasta } = vista === 'mes' ? rangoMes(mes.anio, mes.mes) : quincena;
  const titulo = vista === 'mes' ? nombreMes(mes.anio, mes.mes) : `Quincena ${quincena.numero} · ${etiquetaQuincena(quincena)}`;

  const { datos: movimientos, cargando, error } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const filtrados = categoriaFiltro ? movimientos.filter((m) => m.categoriaId === categoriaFiltro) : movimientos;
  const totales = sumarPorTipo(filtrados);
  const grupos = agruparPorFecha(filtrados);
  const archivadas = categorias.filter((c) => c.archivada);

  function mover(delta: number) {
    if (vista === 'mes') setMes((m) => desplazarMes(m, delta));
    else setDesplazamiento((d) => d + delta);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Ver por">
        {VISTAS.map((v) => (
          <button
            key={v.valor}
            type="button"
            role="radio"
            aria-checked={vista === v.valor}
            onClick={() => setVista(v.valor)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              vista === v.valor ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 shadow-sm">
        <button type="button" aria-label="Periodo anterior" onClick={() => mover(-1)} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-center font-semibold text-slate-900">{titulo}</span>
        <button type="button" aria-label="Periodo siguiente" onClick={() => mover(1)} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronRight size={20} />
        </button>
      </div>

      <select
        aria-label="Filtrar por categoría"
        value={categoriaFiltro}
        onChange={(e) => setCategoriaFiltro(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
      >
        <option value="">Todas las categorías</option>
        {[...categoriasActivas(categorias, 'gasto'), ...categoriasActivas(categorias, 'ingreso')].map((c) => (
          <option key={c.id} value={c.id}>
            {c.icono} {c.nombre}
          </option>
        ))}
        {archivadas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icono} {c.nombre} (archivada)
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <TarjetaResumen etiqueta="Ingresos" valor={formatearMonto(totales.ingresos, moneda)} colorValor="text-emerald-600" />
        <TarjetaResumen etiqueta="Gastos" valor={formatearMonto(totales.gastos, moneda)} colorValor="text-rose-600" />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus movimientos. Revisa tu conexión.
        </p>
      ) : cargando ? (
        <p className="py-10 text-center text-slate-400">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="py-10 text-center text-slate-400">No hay movimientos en este periodo.</p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.fecha}>
            <h3 className="mb-1 px-2 text-sm font-medium text-slate-500">{etiquetaFecha(grupo.fecha)}</h3>
            <div className="rounded-2xl bg-white p-1 shadow-sm">
              {grupo.movimientos.map((m) => (
                <FilaMovimiento key={m.id} movimiento={m} categoria={porId.get(m.categoriaId)} moneda={moneda} onClick={() => setEditando(m)} />
              ))}
            </div>
          </section>
        ))
      )}

      <RegistroRapido abierta={editando !== undefined} movimiento={editando} onCerrar={() => setEditando(undefined)} />
    </div>
  );
}
```

- [ ] **Step 2:** `npm run typecheck` limpio. **Step 3:** commit `feat: browse movements by fortnight or month`.

---

### Task 9: Ajustes → Quincenas y moneda

**Files:** Create `src/features/ajustes/QuincenasPage.tsx`; Modify `src/features/ajustes/AjustesPage.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `validarDiasPago`, `ordenarDiasPago`, `quincenaDe`, `etiquetaQuincena`, `DIAS_PAGO_POR_DEFECTO` (Task 2); `MONEDAS_DISPONIBLES` (Task 4); `actualizarPerfil` (Task 4); `usePerfil`.
- Produces: ruta `/ajustes/quincenas`.

- [ ] **Step 1: `QuincenasPage.tsx`**

```tsx
// src/features/ajustes/QuincenasPage.tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { MensajeError } from '../../components/MensajeError';
import { useToast } from '../../components/toastContexto';
import { usePerfil } from '../../data/hooks';
import { actualizarPerfil, type Perfil } from '../../data/usuario';
import { MONEDAS_DISPONIBLES } from '../../domain/dinero';
import { DIAS_PAGO_POR_DEFECTO, etiquetaQuincena, ordenarDiasPago, quincenaDe, validarDiasPago } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';

export function QuincenasPage() {
  const usuario = useUsuario();
  const { datos: perfil, cargando } = usePerfil(usuario.uid);

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Quincenas y moneda</h2>
      {cargando ? <p className="py-6 text-center text-slate-400">Cargando…</p> : <Formulario key={usuario.uid} perfil={perfil} />}
    </div>
  );
}

function Formulario({ perfil }: { perfil: Perfil | null }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [inicial1, inicial2] = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const [dia1, setDia1] = useState(String(inicial1));
  const [dia2, setDia2] = useState(String(inicial2));
  const [moneda, setMoneda] = useState(perfil?.moneda ?? 'COP');
  const [error, setError] = useState<string | null>(null);

  const d1 = Number(dia1);
  const d2 = Number(dia2);
  const problema = validarDiasPago(d1, d2);
  const vista = problema ? null : quincenaDe(new Date(), [d1, d2]);

  function guardar(e: FormEvent) {
    e.preventDefault();
    setError(problema);
    if (problema) return;
    actualizarPerfil(usuario.uid, { diasPago: ordenarDiasPago([d1, d2]), moneda }).catch(() =>
      mostrar('No se pudieron guardar los ajustes', 'error'),
    );
    mostrar('Ajustes guardados');
  }

  return (
    <form onSubmit={guardar} className="space-y-5 rounded-2xl bg-white p-4 shadow-sm" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">¿Qué días te pagan?</legend>
        <div className="grid grid-cols-2 gap-3">
          {[
            { valor: dia1, cambiar: setDia1, etiqueta: 'Primer pago' },
            { valor: dia2, cambiar: setDia2, etiqueta: 'Segundo pago' },
          ].map((campo) => (
            <label key={campo.etiqueta} className="block">
              <span className="mb-1 block text-xs text-slate-500">{campo.etiqueta}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={campo.valor}
                onChange={(e) => campo.cambiar(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-lg font-semibold"
              />
            </label>
          ))}
        </div>
        <MensajeError mensaje={error ?? undefined} />
        <p className="mt-2 text-sm text-slate-500">
          {vista ? (
            <>
              Tu quincena actual sería <strong className="text-slate-700">{etiquetaQuincena(vista)}</strong>.
            </>
          ) : (
            'Si el mes no tiene ese día, se usa el último día del mes.'
          )}
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Moneda</span>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          {MONEDAS_DISPONIBLES.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nombre} ({m.codigo})
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: `AjustesPage.tsx`** — dentro del bloque de enlaces, antes de "Categorías", agregar (e importar `CalendarDays`):

```tsx
        <Link to="/ajustes/quincenas" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <CalendarDays size={20} className="text-emerald-600" />
          <span className="flex-1 font-medium text-slate-800">Quincenas y moneda</span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
```

- [ ] **Step 3: `App.tsx`** — importar `QuincenasPage` y agregar `<Route path="ajustes/quincenas" element={<QuincenasPage />} />` después de la ruta `ajustes`.

- [ ] **Step 4:** `npm run typecheck` limpio; `npm test` verde; `npm run build` OK.
- [ ] **Step 5:** commit `feat: let users set pay days and currency`.

---

### Task 10: Verificación de integración

**Files:** solo `.superpowers/smoke.test.ts` (ignorado por git)

- [ ] **Step 1:** Extender el smoke de emulador: `updateDoc` del perfil con `{ diasPago: [1, 15], moneda: 'USD' }` → OK; con `{ moneda: 'XYZ' }` → rechazado; consulta de movimientos del rango de `quincenaDe('2026-10-06', [15, 30])` devuelve solo los del rango.
- [ ] **Step 2:** Con emuladores arriba: `npx vitest run --config .superpowers/smoke.config.ts` → PASS. `npm test`, `npm run test:rules`, `npm run build` → verdes.
- [ ] **Step 3:** Sin commit (archivo ignorado). Registrar en el ledger.
