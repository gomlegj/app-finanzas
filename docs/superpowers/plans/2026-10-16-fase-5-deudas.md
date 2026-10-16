# Fase 5 — Deudas y tarjetas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deudas (tarjeta, préstamo, otro) con saldo calculado desde un saldo base + pagos registrados después, Pagar cuota, Actualizar saldo, cuotas como pendientes de la quincena de vencimiento, y pantalla Deudas en la barra inferior.

**Architecture:** Lógica pura en `src/domain/deudas.ts` con TDD (y `fechaEnMes` movido a `fechas.ts`); colección `deudas` en reglas (emulador); los movimientos exponen `registradoEn` (ms, desde `creadoEn`); componentes compartidos `CampoMonto` y `Segmentado` extraídos de formularios existentes.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Tailwind 4, Firebase 12, date-fns, lucide-react, Vitest, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-16-fase-5-deudas-design.md`. Rama: `feat/fase-5` (desde `main`).

## Global Constraints

- Costo $0, sin servidor, sin dependencias nuevas. Montos enteros. Fechas `'YYYY-MM-DD'` locales.
- Compras con tarjeta no se registran; solo el pago de cuota es gasto (categoría de sistema `deudas`).
- Saldo = `max(0, saldoBase − Σ pagos (gasto, origen deuda) con registradoEn > saldoBaseEn)`; sin `registradoEn` cuenta como posterior. **No se guarda.**
- `saldoBaseEn` = `Date.now()` al crear o al actualizar el saldo.
- Pendiente: solo si la fecha de pago (día ajustado al último del mes) cae en la quincena; planeado = `min(cuota, saldoAlInicio)` (pagos con `fecha < quincena.desde`).
- Deudas no se borran (se archivan). Editar una deuda no cambia el saldo.
- Íconos: tarjeta 💳, préstamo 🏦, otro 📄; color `#64748b`. Nada de 🐷.
- **Commits sin mencionar a Claude** (sin `Co-Authored-By` ni "Generated with").
- Escrituras a Firestore no se esperan en la UI (offline).
- Permisos: la usuaria autorizó ejecución directa y commits por tarea; `push`/`merge` e instalar dependencias se preguntan.

## Review Focus

1. **Actualizar el saldo el mismo día de un pago ya registrado** → ese pago no se vuelve a restar; un pago registrado después sí. Prueba en Task 2.
2. **Pago hecho sin conexión (sin `creadoEn` del servidor)** → cuenta como posterior al saldo base. Prueba en Task 2.
3. **Quincena que cruza de mes (30 oct–14 nov) y deuda con día 5** → la cuota aparece en esa quincena. Prueba en Task 3.
4. **Día de pago 31 en noviembre o 30 en febrero** → vence el último día del mes, no desaparece. Prueba en Task 3.
5. **Editar nombre/cuota/día de una deuda** → el saldo no cambia (solo "Actualizar saldo" lo cambia). Código en Task 5 (`actualizarDeuda` solo envía campos editables); verificación manual en Task 9.

---

## Mapa de archivos

```
src/domain/fechas.ts (+ fechaEnMes)           src/domain/fechas.test.ts
src/domain/calendario.ts (usa fechaEnMes)
src/domain/categorias.ts (+ ID_DEUDAS)
src/domain/movimientos.ts (Movimiento.registradoEn)
src/domain/fijos.ts (Pendiente.origen + 'deuda')
src/domain/deudas.ts (nuevo)                    src/domain/deudas.test.ts (nuevo)
firestore.rules (deudas)                        tests/rules/firestore.rules.test.ts
src/data/movimientos.ts (registradoEn, escucharMovimientosPorOrigen), src/data/deudas.ts (nuevo), src/data/hooks.ts
src/components/CampoMonto.tsx, src/components/Segmentado.tsx (nuevos)
src/features/metas/FormularioMeta.tsx, src/features/ajustes/FormularioFijo.tsx (usan los compartidos)
src/features/deudas/DeudasPage.tsx, TarjetaDeuda.tsx, FormularioDeuda.tsx, ActualizarSaldo.tsx, prellenados.ts (nuevos)
src/components/BottomNav.tsx, src/App.tsx
src/features/inicio/InicioPage.tsx, src/features/inicio/PendientesQuincena.tsx
```

---

### Task 1: `fechaEnMes` compartida

**Files:**
- Modify: `src/domain/fechas.ts`, `src/domain/calendario.ts`
- Test: `src/domain/fechas.test.ts`

**Interfaces:**
- Produces: `function fechaEnMes(anio: number, mes: number, dia: number): Date;` — `mes` puede salirse de 0–11; si el día no existe, el último del mes.

- [ ] **Step 1: Write the failing test**

En `src/domain/fechas.test.ts`, agregar `fechaEnMes` al import de `./fechas` y:
```ts
describe('fechaEnMes', () => {
  it('ajusta al último día si el día no existe y acepta meses fuera de rango', () => {
    expect(fechaLocalISO(fechaEnMes(2026, 1, 30))).toBe('2026-02-28');
    expect(fechaLocalISO(fechaEnMes(2028, 1, 30))).toBe('2028-02-29');
    expect(fechaLocalISO(fechaEnMes(2026, 10, 31))).toBe('2026-11-30');
    expect(fechaLocalISO(fechaEnMes(2026, 12, 5))).toBe('2027-01-05');
    expect(fechaLocalISO(fechaEnMes(2026, 9, 15))).toBe('2026-10-15');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/fechas.test.ts`
Expected: FAIL — `fechaEnMes is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `src/domain/fechas.ts`, al final:
```ts
/** Fecha del `dia` en el mes indicado (`mes` puede salirse de 0–11); si el día no existe, el último del mes. */
export function fechaEnMes(anio: number, mes: number, dia: number): Date {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(dia, ultimo));
}
```
En `src/domain/calendario.ts`: cambiar `import { fechaLocalISO } from './fechas';` por `import { fechaEnMes, fechaLocalISO } from './fechas';`, borrar la función privada `enMes` (con su comentario) y reemplazar su uso `enMes(` por `fechaEnMes(`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/fechas.test.ts src/domain/calendario.test.ts` → PASS. Luego `npm run typecheck && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fechas.ts src/domain/fechas.test.ts src/domain/calendario.ts
git commit -m "refactor: share last-day-of-month date helper"
```

---

### Task 2: Dominio de deudas — modelo, validación y saldo

**Files:**
- Create: `src/domain/deudas.ts`
- Modify: `src/domain/categorias.ts` (+ `ID_DEUDAS`), `src/domain/movimientos.ts` (+ `registradoEn`)
- Test: `src/domain/deudas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // categorias.ts
  export const ID_DEUDAS = 'deudas';
  // movimientos.ts — Movimiento gana:
  /** Momento de registro (ms) según el servidor; ausente si aún no se sincroniza. */
  registradoEn?: number;
  // deudas.ts
  type TipoDeuda = 'tarjeta' | 'prestamo' | 'otro';
  interface DatosDeudaEditable { nombre: string; tipo: TipoDeuda; cuota: number; diaPago: number }
  interface DatosDeuda extends DatosDeudaEditable { saldoBase: number; saldoBaseEn: number; archivada: boolean }
  interface Deuda extends DatosDeuda { id: string }
  interface FormularioDeuda { nombre: string; tipo: TipoDeuda; saldo: number | null; cuota: number | null; diaPago: number | null }
  type ErroresDeuda = Partial<Record<'nombre' | 'saldo' | 'cuota' | 'diaPago', string>>;
  const MAX_NOMBRE_DEUDA = 40;
  const ICONO_TIPO_DEUDA: Record<TipoDeuda, string>;    // 💳 🏦 📄
  const ETIQUETA_TIPO_DEUDA: Record<TipoDeuda, string>; // Tarjeta, Préstamo, Otro
  const COLOR_DEUDA = '#64748b';
  function validarDeuda(f: FormularioDeuda, opciones: { creando: boolean }): ErroresDeuda;
  function normalizarDeuda(f: FormularioDeuda): DatosDeudaEditable;
  function validarSaldo(monto: number | null): string | null;
  function saldo(deuda: Pick<Deuda, 'id' | 'saldoBase' | 'saldoBaseEn'>, movimientos: readonly Movimiento[]): number;
  function cuotasEstimadas(deuda: Pick<Deuda, 'cuota'>, saldoActual: number): number;
  function sugerenciaDePago(deuda: Pick<Deuda, 'cuota'>, saldoActual: number, pagadoEnQuincena: number): number;
  ```

- [ ] **Step 1: Write the failing test**

`src/domain/deudas.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/deudas.test.ts`
Expected: FAIL — `Cannot find module './deudas'`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/categorias.ts`, después de `ID_RETIRO_AHORRO`:
```ts
export const ID_DEUDAS = 'deudas';
```
y cambiar `crear('gasto', 'deudas', 'Deudas', ...` por `crear('gasto', ID_DEUDAS, 'Deudas', ...` (resto igual).

`src/domain/movimientos.ts`, en `interface Movimiento` (después de `origen?`):
```ts
  /** Momento de registro (ms) según el servidor; ausente si aún no se sincroniza. */
  registradoEn?: number;
```

`src/domain/deudas.ts`:
```ts
import type { Movimiento } from './movimientos';

export type TipoDeuda = 'tarjeta' | 'prestamo' | 'otro';

export interface DatosDeudaEditable {
  nombre: string;
  tipo: TipoDeuda;
  cuota: number;
  /** Día del mes en que vence la cuota (1–31). */
  diaPago: number;
}

export interface DatosDeuda extends DatosDeudaEditable {
  /** Último saldo conocido (al crear o al actualizar con el extracto). */
  saldoBase: number;
  /** Momento (ms) en que se registró `saldoBase`. */
  saldoBaseEn: number;
  archivada: boolean;
}

export interface Deuda extends DatosDeuda {
  id: string;
}

export interface FormularioDeuda {
  nombre: string;
  tipo: TipoDeuda;
  /** Solo al crear. */
  saldo: number | null;
  cuota: number | null;
  diaPago: number | null;
}

export type ErroresDeuda = Partial<Record<'nombre' | 'saldo' | 'cuota' | 'diaPago', string>>;

export const MAX_NOMBRE_DEUDA = 40;

export const ICONO_TIPO_DEUDA: Record<TipoDeuda, string> = { tarjeta: '💳', prestamo: '🏦', otro: '📄' };
export const ETIQUETA_TIPO_DEUDA: Record<TipoDeuda, string> = { tarjeta: 'Tarjeta', prestamo: 'Préstamo', otro: 'Otro' };
export const COLOR_DEUDA = '#64748b';

export function validarDeuda(f: FormularioDeuda, { creando }: { creando: boolean }): ErroresDeuda {
  const errores: ErroresDeuda = {};
  const nombre = f.nombre.trim();
  if (!nombre) errores.nombre = 'Escribe un nombre';
  else if (nombre.length > MAX_NOMBRE_DEUDA) errores.nombre = `Máximo ${MAX_NOMBRE_DEUDA} caracteres`;
  if (creando && (f.saldo === null || f.saldo <= 0)) errores.saldo = 'Escribe un saldo mayor a 0';
  if (f.cuota === null || f.cuota <= 0) errores.cuota = 'Escribe una cuota mayor a 0';
  if (f.diaPago === null || !Number.isInteger(f.diaPago) || f.diaPago < 1 || f.diaPago > 31) {
    errores.diaPago = 'Usa un día entre 1 y 31';
  }
  return errores;
}

export function normalizarDeuda(f: FormularioDeuda): DatosDeudaEditable {
  if (f.cuota === null || f.diaPago === null) throw new Error('normalizarDeuda requiere cuota y día validados');
  return { nombre: f.nombre.trim(), tipo: f.tipo, cuota: f.cuota, diaPago: f.diaPago };
}

export function validarSaldo(monto: number | null): string | null {
  return monto === null || monto < 0 ? 'Escribe el saldo (puede ser 0)' : null;
}

export const esPagoDe = (m: Movimiento, deudaId: string) =>
  m.tipo === 'gasto' && m.origen?.tipo === 'deuda' && m.origen.id === deudaId;

/** Saldo base menos los pagos registrados después de él (los no sincronizados cuentan). Nunca < 0. */
export function saldo(deuda: Pick<Deuda, 'id' | 'saldoBase' | 'saldoBaseEn'>, movimientos: readonly Movimiento[]): number {
  let total = deuda.saldoBase;
  for (const m of movimientos) {
    if (!esPagoDe(m, deuda.id)) continue;
    if (m.registradoEn !== undefined && m.registradoEn <= deuda.saldoBaseEn) continue;
    total -= m.monto;
  }
  return Math.max(0, total);
}

export function cuotasEstimadas(deuda: Pick<Deuda, 'cuota'>, saldoActual: number): number {
  return saldoActual <= 0 ? 0 : Math.ceil(saldoActual / deuda.cuota);
}

/** Lo que falta de la cuota de esta quincena, sin pasar el saldo. */
export function sugerenciaDePago(deuda: Pick<Deuda, 'cuota'>, saldoActual: number, pagadoEnQuincena: number): number {
  return Math.min(Math.max(0, deuda.cuota - pagadoEnQuincena), saldoActual);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/deudas.test.ts` → PASS. Luego `npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/deudas.ts src/domain/deudas.test.ts src/domain/categorias.ts src/domain/movimientos.ts
git commit -m "feat: add debt model, validation and derived balance"
```

---

### Task 3: Vencimiento, próximo pago y pendientes de deudas

**Files:**
- Modify: `src/domain/deudas.ts`, `src/domain/fijos.ts`
- Test: `src/domain/deudas.test.ts`

**Interfaces:**
- Consumes: Task 1 (`fechaEnMes`), Task 2; `proximaFecha(dias, hoy)` de `src/domain/calendario.ts`; `ordenarPendientes`, `resumirPagos`, `Pendiente` de `src/domain/fijos.ts`; `ID_DEUDAS`.
- Produces:
  ```ts
  // fijos.ts: Pendiente.origen.tipo: 'fijo' | 'meta' | 'deuda'
  function proximoPago(deuda: Pick<Deuda, 'diaPago'>, hoy?: Date): string;
  function venceEnQuincena(diaPago: number, quincena: Quincena): string | null;
  function pagadoEnQuincena(deuda: Pick<Deuda, 'id'>, movimientos: readonly Movimiento[], quincena: Quincena): number;
  function pendientesDeDeudas(deudas: readonly Deuda[], quincena: Quincena, movimientosDeDeudas: readonly Movimiento[]): Pendiente[];
  ```

- [ ] **Step 1: Write the failing test**

En `src/domain/deudas.test.ts`, agregar `pagadoEnQuincena, pendientesDeDeudas, proximoPago, venceEnQuincena,` al import de `./deudas`, `import { quincenaDe } from './quincena';` y al final:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/deudas.test.ts`
Expected: FAIL — `proximoPago is not a function` (y demás).

- [ ] **Step 3: Write minimal implementation**

En `src/domain/fijos.ts`, en `Pendiente`:
```ts
  origen: { tipo: 'fijo' | 'meta' | 'deuda'; id: string };
```

En `src/domain/deudas.ts`, agregar imports:
```ts
import { parseISO } from 'date-fns';
import { proximaFecha } from './calendario';
import { ID_DEUDAS } from './categorias';
import { fechaEnMes, fechaLocalISO } from './fechas';
import { ordenarPendientes, resumirPagos, type Pendiente } from './fijos';
import type { Quincena } from './quincena';
```
y al final:
```ts
export function proximoPago(deuda: Pick<Deuda, 'diaPago'>, hoy: Date = new Date()): string {
  return proximaFecha([deuda.diaPago], hoy);
}

/** Fecha de vencimiento dentro de la quincena (mes de inicio o de fin), o `null`. */
export function venceEnQuincena(diaPago: number, quincena: Quincena): string | null {
  for (const iso of [quincena.desde, quincena.hasta]) {
    const base = parseISO(iso);
    const vence = fechaLocalISO(fechaEnMes(base.getFullYear(), base.getMonth(), diaPago));
    if (vence >= quincena.desde && vence <= quincena.hasta) return vence;
  }
  return null;
}

const enQuincena = (m: Movimiento, q: Quincena) => m.fecha >= q.desde && m.fecha <= q.hasta;

export function pagadoEnQuincena(deuda: Pick<Deuda, 'id'>, movimientos: readonly Movimiento[], quincena: Quincena): number {
  return movimientos.filter((m) => esPagoDe(m, deuda.id) && enQuincena(m, quincena)).reduce((s, m) => s + m.monto, 0);
}

/** Cuotas de las deudas que vencen en `quincena`. `movimientosDeDeudas`: pagos de cualquier fecha. */
export function pendientesDeDeudas(
  deudas: readonly Deuda[],
  quincena: Quincena,
  movimientosDeDeudas: readonly Movimiento[],
): Pendiente[] {
  const resultado: Pendiente[] = [];
  for (const deuda of deudas) {
    if (deuda.archivada || !venceEnQuincena(deuda.diaPago, quincena)) continue;
    const propios = movimientosDeDeudas.filter((m) => esPagoDe(m, deuda.id));
    const alInicio = saldo(deuda, propios.filter((m) => m.fecha < quincena.desde));
    if (alInicio === 0) continue;
    const pagos = propios.filter((m) => enQuincena(m, quincena));
    const pendiente: Pendiente = {
      origen: { tipo: 'deuda', id: deuda.id },
      nombre: deuda.nombre,
      categoriaId: ID_DEUDAS,
      icono: ICONO_TIPO_DEUDA[deuda.tipo],
      color: COLOR_DEUDA,
      planeado: Math.min(deuda.cuota, alInicio),
    };
    if (pagos.length > 0) pendiente.pagado = resumirPagos(pagos);
    resultado.push(pendiente);
  }
  return ordenarPendientes(resultado);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/deudas.test.ts` → PASS. Luego `npm run typecheck && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/deudas.ts src/domain/deudas.test.ts src/domain/fijos.ts
git commit -m "feat: add debt installments as fortnight pending items"
```

---

### Task 4: Reglas — deudas

**Files:**
- Modify: `firestore.rules`
- Test: `tests/rules/firestore.rules.test.ts`

- [ ] **Step 1: Write the failing test**

En `tests/rules/firestore.rules.test.ts`:
1. Borrar el bloque completo `describe('colecciones de fases futuras', ...)`.
2. Agregar al final:
```ts
describe('deudas', () => {
  const ruta = (uid: string, id = 'd1') => `users/${uid}/deudas/${id}`;
  const deuda = {
    nombre: 'Visa', tipo: 'tarjeta', saldoBase: 2000000, saldoBaseEn: 1760000000000,
    cuota: 300000, diaPago: 5, archivada: false,
  };

  it('crea deudas de cada tipo', async () => {
    for (const tipo of ['tarjeta', 'prestamo', 'otro']) {
      await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, tipo)), { ...deuda, tipo }));
    }
  });

  it.each([
    ['nombre vacío', { nombre: '' }],
    ['tipo inválido', { tipo: 'hipoteca' }],
    ['saldo negativo', { saldoBase: -1 }],
    ['saldo decimal', { saldoBase: 10.5 }],
    ['momento del saldo en 0', { saldoBaseEn: 0 }],
    ['cuota 0', { cuota: 0 }],
    ['día 0', { diaPago: 0 }],
    ['día 32', { diaPago: 32 }],
    ['archivada como texto', { archivada: 'no' }],
  ])('rechaza %s', async (_n, cambio) => {
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), { ...deuda, ...cambio }));
  });

  it('acepta saldo 0 al actualizar', async () => {
    await sembrar(ruta(ALICIA), deuda);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { saldoBase: 0, saldoBaseEn: 1760000000001 }));
  });

  it('la dueña archiva pero no borra', async () => {
    await sembrar(ruta(ALICIA), deuda);
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { archivada: true }));
    await assertFails(deleteDoc(doc(como(ALICIA), ruta(ALICIA))));
  });

  it('otro usuario no lee ni escribe deudas ajenas', async () => {
    await sembrar(ruta(ALICIA), deuda);
    await assertFails(getDoc(doc(como(BETO), ruta(ALICIA))));
    await assertFails(setDoc(doc(como(BETO), ruta(ALICIA, 'd9')), deuda));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — creaciones y actualizaciones de deudas rechazadas (sin reglas).

- [ ] **Step 3: Write minimal implementation**

En `firestore.rules`, después del bloque `match /metas/{id} { ... }`:
```
      match /deudas/{id} {
        function deudaValida() {
          let d = request.resource.data;
          return d.nombre is string && d.nombre.size() > 0 && d.nombre.size() <= 40
            && d.tipo in ['tarjeta', 'prestamo', 'otro']
            && d.saldoBase is int && d.saldoBase >= 0
            && d.saldoBaseEn is int && d.saldoBaseEn > 0
            && d.cuota is int && d.cuota > 0
            && d.diaPago is int && d.diaPago >= 1 && d.diaPago <= 31
            && d.archivada is bool;
        }

        allow read: if esDueno(uid);
        allow create, update: if esDueno(uid) && deudaValida();
        // Se archivan: borrar dejaría pagos sin su deuda.
        allow delete: if false;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:rules && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat: allow debts in rules"
```

---

### Task 5: Capa de datos — `registradoEn`, movimientos por origen y deudas

**Files:**
- Create: `src/data/deudas.ts`
- Modify: `src/data/movimientos.ts`, `src/data/hooks.ts`

**Interfaces:**
- Consumes: `Deuda`, `DatosDeuda`, `DatosDeudaEditable` (Task 2); `Movimiento.registradoEn` (Task 2).
- Produces:
  ```ts
  function escucharMovimientosPorOrigen(uid: string, tipo: 'meta' | 'deuda', alCambiar: (m: Movimiento[]) => void, alFallar?: (e: unknown) => void): Unsubscribe;
  function escucharDeudas(uid, alCambiar, alFallar?): Unsubscribe;
  function crearDeuda(uid: string, datos: DatosDeudaEditable, saldoActual: number): Promise<void>;
  function actualizarDeuda(uid: string, id: string, datos: DatosDeudaEditable): Promise<void>; // no toca el saldo
  function actualizarSaldo(uid: string, id: string, saldoActual: number): Promise<void>;
  function archivarDeuda(uid: string, id: string, archivada: boolean): Promise<void>;
  function useDeudas(uid: string): Escucha<Deuda[]>;
  function useMovimientosDeDeudas(uid: string): Escucha<Movimiento[]>;
  // useMovimientosDeMetas se mantiene (usa escucharMovimientosPorOrigen(uid, 'meta', ...)).
  ```

- [ ] **Step 1: Movimientos con `registradoEn` y por origen**

En `src/data/movimientos.ts`:
- Agregar `type DocumentData, type QueryDocumentSnapshot, type Timestamp` al import de `firebase/firestore`.
- Después de `const coleccion = ...`:
```ts
function aMovimiento(d: QueryDocumentSnapshot<DocumentData>): Movimiento {
  const { creadoEn, ...datos } = d.data() as Omit<Movimiento, 'id' | 'registradoEn'> & { creadoEn?: Timestamp | null };
  // `creadoEn` es null mientras el servidor no confirma la escritura (p. ej. sin conexión).
  return { id: d.id, ...datos, ...(creadoEn ? { registradoEn: creadoEn.toMillis() } : {}) };
}
```
- En `escucharMovimientosEntre`, reemplazar `snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Movimiento, 'id'>) }))` por `snap.docs.map(aMovimiento)`.
- Reemplazar la función completa `escucharMovimientosDeMetas` por:
```ts
/** Todos los movimientos ligados a metas o deudas, de cualquier fecha: saldos y ahorros se calculan con ellos. */
export function escucharMovimientosPorOrigen(
  uid: string,
  tipo: 'meta' | 'deuda',
  alCambiar: (movimientos: Movimiento[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(coleccion(uid), where('origen.tipo', '==', tipo)),
    (snap) => alCambiar(snap.docs.map(aMovimiento)),
    (error) => {
      console.error(`Error escuchando movimientos de ${tipo}`, error);
      alFallar?.(error);
    },
  );
}
```

- [ ] **Step 2: Datos de deudas**

`src/data/deudas.ts`:
```ts
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc, type Unsubscribe } from 'firebase/firestore';
import type { DatosDeuda, DatosDeudaEditable, Deuda } from '../domain/deudas';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'deudas');

export function escucharDeudas(
  uid: string,
  alCambiar: (deudas: Deuda[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosDeuda) }))),
    (error) => {
      console.error('Error escuchando deudas', error);
      alFallar?.(error);
    },
  );
}

export async function crearDeuda(uid: string, datos: DatosDeudaEditable, saldoActual: number): Promise<void> {
  await addDoc(coleccion(uid), {
    ...datos,
    saldoBase: saldoActual,
    saldoBaseEn: Date.now(),
    archivada: false,
    creadoEn: serverTimestamp(),
  });
}

/** Solo campos editables: el saldo cambia únicamente con `actualizarSaldo`. */
export function actualizarDeuda(uid: string, id: string, datos: DatosDeudaEditable): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos });
}

/** Nuevo saldo (p. ej. del extracto); desde ahora solo cuentan los pagos registrados después. */
export function actualizarSaldo(uid: string, id: string, saldoActual: number): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { saldoBase: saldoActual, saldoBaseEn: Date.now() });
}

export function archivarDeuda(uid: string, id: string, archivada: boolean): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { archivada });
}
```

- [ ] **Step 3: Hooks**

En `src/data/hooks.ts`:
- Imports: `import type { Deuda } from '../domain/deudas';`, `import { escucharDeudas } from './deudas';`, y cambiar `import { escucharMovimientosDeMetas, escucharMovimientosEntre } from './movimientos';` por `import { escucharMovimientosEntre, escucharMovimientosPorOrigen } from './movimientos';`.
- En `useMovimientosDeMetas`, reemplazar `escucharMovimientosDeMetas(uid, cb, falla)` por `escucharMovimientosPorOrigen(uid, 'meta', cb, falla)`.
- Al final:
```ts
export function useDeudas(uid: string): Escucha<Deuda[]> {
  return useEscucha<Deuda[]>((cb, falla) => escucharDeudas(uid, cb, falla), `deudas:${uid}`, SIN_DATOS);
}

export function useMovimientosDeDeudas(uid: string): Escucha<Movimiento[]> {
  return useEscucha<Movimiento[]>(
    (cb, falla) => escucharMovimientosPorOrigen(uid, 'deuda', cb, falla),
    `movimientos-deudas:${uid}`,
    SIN_DATOS,
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores. `grep -rn "escucharMovimientosDeMetas" src` → sin resultados.

- [ ] **Step 5: Commit**

```bash
git add src/data/deudas.ts src/data/movimientos.ts src/data/hooks.ts
git commit -m "feat: add debts data layer and movement registration time"
```

---

### Task 6: Componentes compartidos `CampoMonto` y `Segmentado`

**Files:**
- Create: `src/components/CampoMonto.tsx`, `src/components/Segmentado.tsx`
- Modify: `src/features/metas/FormularioMeta.tsx`, `src/features/ajustes/FormularioFijo.tsx`

**Interfaces:**
- Produces:
  ```ts
  function CampoMonto(props: { etiqueta: string; valor: string; onCambio: (texto: string) => void; error?: string }): JSX.Element;
  function Segmentado<T extends string | number>(props: { etiqueta: string; valor: T; onCambio: (v: T) => void; opciones: { valor: T; etiqueta: string }[] }): JSX.Element;
  ```

- [ ] **Step 1: Crear `src/components/CampoMonto.tsx`**

Mover la función `CampoMonto` de `src/features/metas/FormularioMeta.tsx` (al final del archivo) a este archivo, exportada, con sus imports:
```tsx
import { actualizarTextoMonto } from '../domain/dinero';
import { MensajeError } from './MensajeError';

interface Props {
  etiqueta: string;
  valor: string;
  onCambio: (texto: string) => void;
  error?: string;
}

export function CampoMonto({ etiqueta, valor, onCambio, error }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</span>
      <div className="flex items-baseline gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-slate-400">$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={valor}
          onChange={(e) => onCambio(actualizarTextoMonto(e.target.value))}
          className="w-full min-w-0 bg-transparent tabular-nums outline-none"
        />
      </div>
      <MensajeError mensaje={error} />
    </label>
  );
}
```
En `FormularioMeta.tsx`: borrar la función `CampoMonto` local, agregar `import { CampoMonto } from '../../components/CampoMonto';` y quitar `actualizarTextoMonto` del import de `../../domain/dinero` si queda sin uso.

- [ ] **Step 2: Crear `src/components/Segmentado.tsx`**

Mover `PropsSegmentado` y `Segmentado` de `src/features/ajustes/FormularioFijo.tsx` a este archivo, exportando `Segmentado`, y admitir 2 o más opciones:
```tsx
interface Props<T extends string | number> {
  etiqueta: string;
  valor: T;
  onCambio: (valor: T) => void;
  opciones: { valor: T; etiqueta: string }[];
}

export function Segmentado<T extends string | number>({ etiqueta, valor, onCambio, opciones }: Props<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">{etiqueta}</legend>
      <div
        className="grid gap-1 rounded-2xl bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
        role="radiogroup"
      >
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
En `FormularioFijo.tsx`: borrar `PropsSegmentado` y `Segmentado` locales y agregar `import { Segmentado } from '../../components/Segmentado';`.

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/CampoMonto.tsx src/components/Segmentado.tsx src/features/metas/FormularioMeta.tsx src/features/ajustes/FormularioFijo.tsx
git commit -m "refactor: share amount field and segmented control"
```

---

### Task 7: Pantalla Deudas y barra inferior

**Files:**
- Create: `src/features/deudas/prellenados.ts`, `FormularioDeuda.tsx`, `ActualizarSaldo.tsx`, `TarjetaDeuda.tsx`, `DeudasPage.tsx`
- Modify: `src/components/BottomNav.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 5, 6; `Prellenado` y `RegistroRapido` de `src/features/movimientos/RegistroRapido.tsx`; `HojaInferior`, `BurbujaCategoria`, `useToast`, `fechaCorta`.

- [ ] **Step 1: Prellenado de pago**

`src/features/deudas/prellenados.ts`:
```ts
import { ID_DEUDAS } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Deuda } from '../../domain/deudas';
import type { Prellenado } from '../movimientos/RegistroRapido';

export function prellenadoPagoDeuda(deuda: Deuda, sugerido: number, saldoActual: number, moneda: string): Prellenado {
  return {
    tipo: 'gasto',
    monto: sugerido > 0 ? sugerido : undefined,
    categoriaId: ID_DEUDAS,
    nota: deuda.nombre,
    origen: { tipo: 'deuda', id: deuda.id },
    titulo: 'Pagar cuota',
    montoMaximo: { valor: saldoActual, mensaje: `Solo debes ${formatearMonto(saldoActual, moneda)}` },
  };
}
```

- [ ] **Step 2: Formulario de deuda**

`src/features/deudas/FormularioDeuda.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Archive } from 'lucide-react';
import { CampoMonto } from '../../components/CampoMonto';
import { MensajeError } from '../../components/MensajeError';
import { Segmentado } from '../../components/Segmentado';
import { useToast } from '../../components/toastContexto';
import { actualizarDeuda, archivarDeuda, crearDeuda } from '../../data/deudas';
import {
  ETIQUETA_TIPO_DEUDA,
  MAX_NOMBRE_DEUDA,
  normalizarDeuda,
  validarDeuda,
  type Deuda,
  type ErroresDeuda,
  type TipoDeuda,
} from '../../domain/deudas';
import { agruparMiles, parsearMonto } from '../../domain/dinero';
import { useUsuario } from '../auth/contexto';

const TIPOS: TipoDeuda[] = ['tarjeta', 'prestamo', 'otro'];

export function FormularioDeuda({ deuda, onListo }: { deuda?: Deuda; onListo: () => void }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(deuda?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoDeuda>(deuda?.tipo ?? 'tarjeta');
  const [saldoTexto, setSaldoTexto] = useState('');
  const [cuotaTexto, setCuotaTexto] = useState(deuda ? agruparMiles(String(deuda.cuota)) : '');
  const [diaTexto, setDiaTexto] = useState(deuda ? String(deuda.diaPago) : '');
  const [errores, setErrores] = useState<ErroresDeuda>({});

  function guardar(e: FormEvent) {
    e.preventDefault();
    const formulario = {
      nombre,
      tipo,
      saldo: parsearMonto(saldoTexto),
      cuota: parsearMonto(cuotaTexto),
      diaPago: diaTexto === '' ? null : Number(diaTexto),
    };
    const encontrados = validarDeuda(formulario, { creando: !deuda });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarDeuda(formulario);
    const operacion = deuda
      ? actualizarDeuda(usuario.uid, deuda.id, datos)
      : crearDeuda(usuario.uid, datos, formulario.saldo ?? 0);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar la deuda', 'error'));
    mostrar(deuda ? 'Deuda actualizada' : 'Deuda creada');
    onListo();
  }

  function archivar() {
    if (!deuda) return;
    archivarDeuda(usuario.uid, deuda.id, true).catch(() => mostrar('No se pudo archivar la deuda', 'error'));
    mostrar('Deuda archivada');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Nombre</span>
        <input
          value={nombre}
          maxLength={MAX_NOMBRE_DEUDA}
          placeholder="Ej. Visa, Préstamo carro"
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        />
        <MensajeError mensaje={errores.nombre} />
      </label>

      <Segmentado
        etiqueta="Tipo"
        valor={tipo}
        onCambio={setTipo}
        opciones={TIPOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_DEUDA[t] }))}
      />

      {!deuda && <CampoMonto etiqueta="Saldo actual" valor={saldoTexto} onCambio={setSaldoTexto} error={errores.saldo} />}
      <CampoMonto etiqueta="Cuota" valor={cuotaTexto} onCambio={setCuotaTexto} error={errores.cuota} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Día de pago</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej. 5"
          value={diaTexto}
          onChange={(e) => setDiaTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 tabular-nums"
        />
        <MensajeError mensaje={errores.diaPago} />
      </label>

      {deuda && <p className="text-sm text-slate-500">Para cambiar el saldo usa "Actualizar saldo" en la tarjeta.</p>}

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {deuda && (
        <button
          type="button"
          onClick={archivar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-slate-500 hover:bg-slate-100"
        >
          <Archive size={18} />
          Archivar deuda
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Actualizar saldo**

`src/features/deudas/ActualizarSaldo.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { CampoMonto } from '../../components/CampoMonto';
import { useToast } from '../../components/toastContexto';
import { actualizarSaldo } from '../../data/deudas';
import { validarSaldo, type Deuda } from '../../domain/deudas';
import { agruparMiles, parsearMonto } from '../../domain/dinero';
import { useUsuario } from '../auth/contexto';

export function ActualizarSaldo({ deuda, saldoActual, onListo }: { deuda: Deuda; saldoActual: number; onListo: () => void }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [texto, setTexto] = useState(agruparMiles(String(saldoActual)));
  const [error, setError] = useState<string | null>(null);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(texto);
    const problema = validarSaldo(monto);
    setError(problema);
    if (problema || monto === null) return;
    actualizarSaldo(usuario.uid, deuda.id, monto).catch(() => mostrar('No se pudo actualizar el saldo', 'error'));
    mostrar('Saldo actualizado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <p className="text-sm text-slate-600">
        Copia el saldo de tu extracto. Desde ahora solo se restarán los pagos que registres después.
      </p>
      <CampoMonto etiqueta="Saldo actual" valor={texto} onCambio={setTexto} error={error ?? undefined} />
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

- [ ] **Step 4: Tarjeta y página**

`src/features/deudas/TarjetaDeuda.tsx`:
```tsx
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { COLOR_DEUDA, cuotasEstimadas, ICONO_TIPO_DEUDA, type Deuda } from '../../domain/deudas';
import { formatearMonto } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';

interface Props {
  deuda: Deuda;
  saldo: number;
  pagadoEnQuincena: number;
  proximoPago: string;
  moneda: string;
  /** Falló la carga de pagos: no se muestran ni se permiten acciones sobre el saldo. */
  sinDatos: boolean;
  onPagar: () => void;
  onActualizarSaldo: () => void;
  onEditar: () => void;
  onArchivar: () => void;
}

export function TarjetaDeuda({
  deuda,
  saldo,
  pagadoEnQuincena,
  proximoPago,
  moneda,
  sinDatos,
  onPagar,
  onActualizarSaldo,
  onEditar,
  onArchivar,
}: Props) {
  const pagada = !sinDatos && saldo === 0;
  const cuotas = cuotasEstimadas(deuda, saldo);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <button type="button" onClick={onEditar} className="flex w-full items-center gap-3 text-left">
        <BurbujaCategoria icono={ICONO_TIPO_DEUDA[deuda.tipo]} color={COLOR_DEUDA} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{deuda.nombre}</span>
          <span className="block text-sm text-slate-500">
            Cuota {formatearMonto(deuda.cuota, moneda)} · día {deuda.diaPago} · próximo pago {fechaCorta(proximoPago)}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-bold tabular-nums text-slate-900">
            {sinDatos ? '—' : formatearMonto(saldo, moneda)}
          </span>
          {!sinDatos && cuotas > 0 && (
            <span className="block text-xs text-slate-500">≈ {cuotas} {cuotas === 1 ? 'cuota' : 'cuotas'}</span>
          )}
        </span>
      </button>

      {sinDatos && <p className="mt-2 text-sm text-rose-700">No se pudo calcular tu saldo</p>}
      {pagada && <p className="mt-2 text-sm font-medium text-emerald-700">🎉 ¡Pagada!</p>}
      {!sinDatos && pagadoEnQuincena > 0 && !pagada && (
        <p className="mt-2 text-sm font-medium text-emerald-700">
          ✓ Pagaste {formatearMonto(pagadoEnQuincena, moneda)} esta quincena
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {pagada ? (
          <button type="button" onClick={onArchivar} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700">
            Archivar
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={sinDatos}
              onClick={onPagar}
              className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Pagar cuota
            </button>
            <button
              type="button"
              disabled={sinDatos}
              onClick={onActualizarSaldo}
              className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Actualizar saldo
            </button>
          </>
        )}
      </div>
    </article>
  );
}
```

`src/features/deudas/DeudasPage.tsx`:
```tsx
import { useState } from 'react';
import { ArchiveRestore, ChevronDown } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { useToast } from '../../components/toastContexto';
import { archivarDeuda } from '../../data/deudas';
import { useDeudas, useMovimientosDeDeudas, usePerfil } from '../../data/hooks';
import {
  COLOR_DEUDA,
  ICONO_TIPO_DEUDA,
  pagadoEnQuincena,
  proximoPago,
  saldo,
  sugerenciaDePago,
  type Deuda,
} from '../../domain/deudas';
import { formatearMonto } from '../../domain/dinero';
import { DIAS_PAGO_POR_DEFECTO, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido, type Prellenado } from '../movimientos/RegistroRapido';
import { ActualizarSaldo } from './ActualizarSaldo';
import { FormularioDeuda } from './FormularioDeuda';
import { prellenadoPagoDeuda } from './prellenados';
import { TarjetaDeuda } from './TarjetaDeuda';

const porNombre = (a: Deuda, b: Deuda) => a.nombre.localeCompare(b.nombre, 'es');

type Hoja = { tipo: 'editar'; deuda?: Deuda } | { tipo: 'saldo'; deuda: Deuda; saldo: number } | null;

export function DeudasPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: perfil } = usePerfil(usuario.uid);
  const deudas = useDeudas(usuario.uid);
  const pagos = useMovimientosDeDeudas(usuario.uid);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [registro, setRegistro] = useState<Prellenado | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);

  const moneda = perfil?.moneda ?? 'COP';
  const quincena = quincenaDe(new Date(), perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO);
  const activas = deudas.datos.filter((d) => !d.archivada).sort(porNombre);
  const archivadas = deudas.datos.filter((d) => d.archivada).sort(porNombre);
  const total = activas.reduce((s, d) => s + saldo(d, pagos.datos), 0);

  function archivar(deuda: Deuda, archivada: boolean) {
    archivarDeuda(usuario.uid, deuda.id, archivada).catch(() => mostrar('No se pudo guardar la deuda', 'error'));
    mostrar(archivada ? 'Deuda archivada' : 'Deuda restaurada');
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Deudas</h2>

      {deudas.error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus deudas. Revisa tu conexión.
        </p>
      ) : deudas.cargando || pagos.cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : activas.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">No tienes deudas registradas. 🐿️</div>
      ) : (
        <>
          {!pagos.error && (
            <section className="rounded-2xl bg-slate-800 p-4 text-white">
              <p className="text-sm opacity-80">Debes en total</p>
              <p className="text-2xl font-bold tabular-nums">{formatearMonto(total, moneda)}</p>
            </section>
          )}
          {activas.map((d) => {
            const actual = saldo(d, pagos.datos);
            const pagado = pagadoEnQuincena(d, pagos.datos, quincena);
            return (
              <TarjetaDeuda
                key={d.id}
                deuda={d}
                saldo={actual}
                pagadoEnQuincena={pagado}
                proximoPago={proximoPago(d)}
                moneda={moneda}
                sinDatos={pagos.error}
                onPagar={() => setRegistro(prellenadoPagoDeuda(d, sugerenciaDePago(d, actual, pagado), actual, moneda))}
                onActualizarSaldo={() => setHoja({ tipo: 'saldo', deuda: d, saldo: actual })}
                onEditar={() => setHoja({ tipo: 'editar', deuda: d })}
                onArchivar={() => archivar(d, true)}
              />
            );
          })}
        </>
      )}

      <button
        type="button"
        onClick={() => setHoja({ tipo: 'editar' })}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nueva deuda
      </button>

      {archivadas.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setVerArchivadas((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1 text-sm font-medium text-slate-500"
          >
            Archivadas ({archivadas.length})
            <ChevronDown size={16} className={verArchivadas ? 'rotate-180' : ''} />
          </button>
          {verArchivadas && (
            <ul className="rounded-2xl bg-white p-1 shadow-sm">
              {archivadas.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-2 py-2.5">
                  <BurbujaCategoria icono={ICONO_TIPO_DEUDA[d.tipo]} color={COLOR_DEUDA} />
                  <span className="flex-1 text-slate-500">{d.nombre}</span>
                  <button
                    type="button"
                    onClick={() => archivar(d, false)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    <ArchiveRestore size={16} />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HojaInferior
        abierta={hoja !== null}
        titulo={hoja?.tipo === 'saldo' ? 'Actualizar saldo' : hoja?.deuda ? 'Editar deuda' : 'Nueva deuda'}
        onCerrar={() => setHoja(null)}
      >
        {hoja?.tipo === 'editar' && (
          <FormularioDeuda key={hoja.deuda?.id ?? 'nueva'} deuda={hoja.deuda} onListo={() => setHoja(null)} />
        )}
        {hoja?.tipo === 'saldo' && (
          <ActualizarSaldo key={hoja.deuda.id} deuda={hoja.deuda} saldoActual={hoja.saldo} onListo={() => setHoja(null)} />
        )}
      </HojaInferior>

      <RegistroRapido abierta={registro !== null} prellenado={registro ?? undefined} onCerrar={() => setRegistro(null)} />
    </div>
  );
}
```

- [ ] **Step 5: Ruta y barra**

`src/App.tsx`: `import { DeudasPage } from './features/deudas/DeudasPage';` y después de la ruta `metas`:
```tsx
        <Route path="deudas" element={<DeudasPage />} />
```

`src/components/BottomNav.tsx`: agregar `CreditCard` al import de `lucide-react` y dejar el orden Inicio · Movimientos · (+) · Metas · Deudas:
```tsx
      <NavLink to="/" end className={claseEnlace}>
        <House size={22} />
        Inicio
      </NavLink>
      <NavLink to="/movimientos" className={claseEnlace}>
        <ListOrdered size={22} />
        Movimientos
      </NavLink>
      <div className="flex flex-1 justify-center">
        {/* botón + sin cambios */}
      </div>
      <NavLink to="/metas" className={claseEnlace}>
        <Target size={22} />
        Metas
      </NavLink>
      <NavLink to="/deudas" className={claseEnlace}>
        <CreditCard size={22} />
        Deudas
      </NavLink>
```
(El `<div>` del botón + se mueve tal cual, sin cambiar su contenido.) Cambiar `px-6` del `<nav>` por `px-2` para que quepan cinco elementos.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/features/deudas src/components/BottomNav.tsx src/App.tsx
git commit -m "feat: add debts screen with payments and balance updates"
```

---

### Task 8: Inicio — pendientes de deudas

**Files:**
- Modify: `src/features/inicio/InicioPage.tsx`, `src/features/inicio/PendientesQuincena.tsx`

**Interfaces:**
- Consumes: `pendientesDeDeudas` (Task 3), `useDeudas`, `useMovimientosDeDeudas` (Task 5).

- [ ] **Step 1: `PendientesQuincena` — texto del botón y clave**

- Reemplazar `{p.origen.tipo === 'meta' ? 'Abonar' : 'Pagado'}` por `{TEXTO_BOTON[p.origen.tipo]}` y agregar arriba del componente:
```tsx
const TEXTO_BOTON: Record<Pendiente['origen']['tipo'], string> = { fijo: 'Pagado', meta: 'Abonar', deuda: 'Pagar' };
```
- Cambiar `<li key={p.origen.id}>` por `<li key={`${p.origen.tipo}:${p.origen.id}`}>`.
- Estado vacío: sin cambios.

- [ ] **Step 2: `InicioPage` combina deudas**

- Imports: `useDeudas, useMovimientosDeDeudas` en el import de `../../data/hooks`; `import { pendientesDeDeudas } from '../../domain/deudas';`.
- Después de `const movimientosDeMetas = useMovimientosDeMetas(usuario.uid);`:
```tsx
  const deudas = useDeudas(usuario.uid);
  const movimientosDeDeudas = useMovimientosDeDeudas(usuario.uid);
```
- En el arreglo de `ordenarPendientes([...])` agregar:
```tsx
    ...pendientesDeDeudas(deudas.datos, quincena, movimientosDeDeudas.datos),
```
- En `pagar`, reemplazar la línea `titulo:` por:
```tsx
        titulo: p.origen.tipo === 'meta' ? 'Abonar a la meta' : p.origen.tipo === 'deuda' ? 'Pagar cuota' : 'Registrar pago',
```
- En `<PendientesQuincena>`:
```tsx
        cargando={fijos.cargando || metas.cargando || movimientosDeMetas.cargando || deudas.cargando || movimientosDeDeudas.cargando || cargando}
        error={fijos.error || metas.error || movimientosDeMetas.error || deudas.error || movimientosDeDeudas.error || error}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/inicio
git commit -m "feat: show debt installments on home"
```

---

### Task 9: Verificación de integración

- [ ] **Step 1: Checks automáticos**

Run: `npm run typecheck && npm test && npm run test:rules && npm run build`
Expected: todo PASS.

- [ ] **Step 2: Prueba manual en el celular** (PC por WiFi; `npm run emuladores` + `npm run dev:emu`)

1. Barra: Inicio · Movimientos · + · Metas · Deudas; caben en pantalla.
2. Crear "Visa" (tarjeta, saldo 2.000.000, cuota 300.000, día 5) y "Carro" (préstamo, día 20). "Debes en total" = suma.
3. Inicio: la deuda que vence en esta quincena aparece con 💳/🏦 y botón "Pagar"; Comprometido la incluye.
4. Pagar cuota desde Deudas: título "Pagar cuota", monto 300.000; guardar → saldo baja, "✓ Pagaste…"; en Inicio queda pagada. Intentar pagar más que el saldo → "Solo debes $X".
5. Actualizar saldo a 2.100.000 → la tarjeta muestra 2.100.000 (el pago anterior no se vuelve a restar). Pagar otra vez → baja.
6. Editar nombre/cuota → el saldo no cambia.
7. Borrar un pago en Movimientos → el saldo sube.
8. Pagar todo → 🎉 "¡Pagada!" → Archivar → Restaurar.

- [ ] **Step 3: Reportar**

Resumen a la usuaria; no hacer `push` ni `merge` sin permiso.
