# Recordatorios en Google Calendar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los fijos mensuales pueden tener un día de pago opcional; desde un fijo guardado se abre Google Calendar con un evento repetitivo prellenado (mensual en su día, o quincenal en los días de pago del perfil) para que Google envíe los recordatorios.

**Architecture:** Lógica pura nueva en `src/domain/calendario.ts` (RRULE, próxima fecha, enlace) y cambios pequeños en `src/domain/fijos.ts`, todo con TDD; campo `diaPago` validado en reglas de Firestore (emulador); el formulario de fijos agrega el campo y un enlace-botón. Sin API de Calendar, sin servidor.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Tailwind 4, Firebase 12, date-fns, Vitest, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-14-recordatorios-calendario-design.md`. Rama: `feat/recordatorios-calendario` (desde `feat/fase-2`, que ya incluye la fase 3).

## Global Constraints

- Costo $0, sin servidor, sin API de Calendar, sin dependencias nuevas.
- `diaPago`: opcional, entero 1–31, **solo** en fijos mensuales; nunca en quincenales. Solo informativo: no cambia `quincena`, pendientes ni comprometido.
- Fijo quincenal: recordatorio en `perfil.diasPago` (ordenados).
- Días 29–31 en meses cortos → último día del mes (nunca saltarse un mes).
- Evento de día completo. Título `Pagar <nombre>`; descripción `Monto planeado: <monto formateado>`.
- El botón usa los datos **guardados** del fijo.
- Mensaje de validación: `'Usa un día entre 1 y 31'`.
- Escrituras a Firestore no se esperan en la UI (offline).
- Permisos: la usuaria autorizó ejecución directa y commits por tarea; `push`/`merge` e instalar dependencias se preguntan.

## Review Focus

1. **Día 30 o 31 en febrero (y 31 en meses de 30)** → el recordatorio cae el último día del mes, no se salta. Pruebas de RRULE y `proximaFecha` en Task 2; comportamiento real de Google se verifica en Task 5.
2. **Hoy es justo el día de pago** → el evento empieza hoy, no el mes siguiente. Prueba en Task 2.
3. **Pasar un fijo mensual con día a quincenal, o borrar el día al editar** → se guarda sin error y el campo desaparece. Pruebas en Tasks 1 y 3.
4. **Nombre con caracteres especiales** (`Agua & luz #2`, tildes) → el enlace conserva el texto exacto. Prueba en Task 2.
5. **Editar el fijo sin guardar y tocar el botón** → el evento usa los datos guardados. Verificación manual en Task 5.

---

## Mapa de archivos

```
src/domain/fijos.ts (+ diaPago, etiquetaVencimiento)   src/domain/fijos.test.ts
src/domain/calendario.ts (nuevo)                         src/domain/calendario.test.ts (nuevo)
firestore.rules (diaPago)                                 tests/rules/firestore.rules.test.ts
src/data/fijos.ts (actualizarFijo borra diaPago)
src/features/ajustes/FormularioFijo.tsx (campo + botón), src/features/ajustes/FijosPage.tsx (props + etiqueta)
```

---

### Task 1: `diaPago` en el dominio de fijos

**Files:**
- Modify: `src/domain/fijos.ts`
- Test: `src/domain/fijos.test.ts`

**Interfaces:**
- Consumes: tipos existentes de `fijos.ts`.
- Produces:
  ```ts
  interface DatosFijo { ...; diaPago?: number }            // solo mensual
  interface FormularioFijo { ...; diaPago: number | null } // null = sin día
  type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId' | 'diaPago', string>>;
  function etiquetaVencimiento(fijo: DatosFijo): string | null; // 'vence el 5' | null
  ```

- [ ] **Step 1: Write the failing test**

En `src/domain/fijos.test.ts`:

1. Agregar `etiquetaVencimiento,` al import de `./fijos` (orden alfabético, después de `etiquetaFrecuencia,`).
2. En el helper `formulario`, agregar `diaPago: null,` después de `quincena: 1,`.
3. Agregar dentro de `describe('validarFijo', ...)`:
```ts
  it('acepta día de pago vacío o entre 1 y 31', () => {
    expect(validarFijo(formulario({ diaPago: null }))).toEqual({});
    expect(validarFijo(formulario({ diaPago: 1 }))).toEqual({});
    expect(validarFijo(formulario({ diaPago: 31 }))).toEqual({});
  });

  it('rechaza día de pago fuera de rango o decimal', () => {
    for (const diaPago of [0, 32, 5.5, Number.NaN]) {
      expect(validarFijo(formulario({ diaPago })).diaPago).toBe('Usa un día entre 1 y 31');
    }
  });

  it('ignora el día de pago si es quincenal', () => {
    expect(validarFijo(formulario({ frecuencia: 'quincenal', diaPago: 99 }))).toEqual({});
  });
```
4. Agregar dentro de `describe('normalizarFijo', ...)`:
```ts
  it('guarda el día de pago si es mensual', () => {
    expect(normalizarFijo(formulario({ diaPago: 5 })).diaPago).toBe(5);
  });

  it('no guarda día de pago si es quincenal o está vacío', () => {
    expect(normalizarFijo(formulario({ frecuencia: 'quincenal', diaPago: 5 }))).not.toHaveProperty('diaPago');
    expect(normalizarFijo(formulario({ diaPago: null }))).not.toHaveProperty('diaPago');
  });
```
5. Agregar al final del bloque de `etiquetaFrecuencia`:
```ts
describe('etiquetaVencimiento', () => {
  it('dice el día si lo tiene', () => {
    expect(etiquetaVencimiento(fijo('a', { frecuencia: 'mensual', quincena: 1, diaPago: 5 }))).toBe('vence el 5');
    expect(etiquetaVencimiento(fijo('a'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/fijos.test.ts`
Expected: FAIL — `etiquetaVencimiento is not a function` y fallos en `diaPago`.

- [ ] **Step 3: Write minimal implementation**

En `src/domain/fijos.ts`:

`DatosFijo` agrega (después de `quincena?`):
```ts
  /** Día en que vence (1–31), solo si es mensual. Solo para el recordatorio. */
  diaPago?: number;
```
`FormularioFijo` agrega (después de `quincena`):
```ts
  /** `null` = sin día. Se ignora si la frecuencia es quincenal. */
  diaPago: number | null;
```
`ErroresFijo`:
```ts
export type ErroresFijo = Partial<Record<'nombre' | 'monto' | 'categoriaId' | 'diaPago', string>>;
```
En `validarFijo`, antes de `return errores;`:
```ts
  const diaValido = f.diaPago === null || (Number.isInteger(f.diaPago) && f.diaPago >= 1 && f.diaPago <= 31);
  if (f.frecuencia === 'mensual' && !diaValido) errores.diaPago = 'Usa un día entre 1 y 31';
```
En `normalizarFijo`, reemplazar `if (f.frecuencia === 'mensual') datos.quincena = f.quincena;` por:
```ts
  if (f.frecuencia === 'mensual') {
    datos.quincena = f.quincena;
    if (f.diaPago !== null) datos.diaPago = f.diaPago;
  }
```
Después de `etiquetaFrecuencia`:
```ts
export function etiquetaVencimiento(fijo: DatosFijo): string | null {
  return fijo.diaPago ? `vence el ${fijo.diaPago}` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/fijos.test.ts` → PASS. Luego `npm run typecheck`.
Expected: typecheck FALLA en `src/features/ajustes/FormularioFijo.tsx` porque el objeto `formulario` no tiene `diaPago`. Arreglo mínimo en este task: en `guardar` de `FormularioFijo.tsx`, agregar `diaPago: null` al objeto `formulario` (Task 4 lo reemplaza por el valor real). Re-run `npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fijos.ts src/domain/fijos.test.ts src/features/ajustes/FormularioFijo.tsx
git commit -m "feat: add optional due day to fixed expenses"
```

---

### Task 2: Dominio de Calendar — regla, próxima fecha y enlace

**Files:**
- Create: `src/domain/calendario.ts`
- Test: `src/domain/calendario.test.ts`

**Interfaces:**
- Consumes: `DatosFijo` (Task 1); `ordenarDiasPago`, `DiasPago` de `src/domain/quincena.ts`; `fechaLocalISO(fecha?: Date): string` de `src/domain/fechas.ts`; `formatearMonto(monto: number, moneda?: string): string` de `src/domain/dinero.ts`.
- Produces:
  ```ts
  function diasRecordatorio(fijo: DatosFijo, diasPago: DiasPago): number[] | null;
  function reglaRecurrencia(dias: readonly number[]): string;          // 1 o 2 días, ascendentes
  function proximaFecha(dias: readonly number[], hoy?: Date): string;  // 'YYYY-MM-DD'
  function enlaceCalendario(datos: { nombre: string; monto: number }, dias: readonly number[], moneda: string, hoy?: Date): string;
  ```

- [ ] **Step 1: Write the failing test**

`src/domain/calendario.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/calendario.test.ts`
Expected: FAIL — `Cannot find module './calendario'`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/calendario.ts`:
```ts
import { addDays, parseISO } from 'date-fns';
import { formatearMonto } from './dinero';
import { fechaLocalISO } from './fechas';
import type { DatosFijo } from './fijos';
import { ordenarDiasPago, type DiasPago } from './quincena';

/** Días del mes en que se recuerda el fijo; `null` si no tiene recordatorio. */
export function diasRecordatorio(fijo: DatosFijo, diasPago: DiasPago): number[] | null {
  if (fijo.frecuencia === 'quincenal') return ordenarDiasPago(diasPago);
  return fijo.diaPago ? [fijo.diaPago] : null;
}

// Todo mes tiene al menos 28 días; desde el 29 hay que cuidar los meses cortos.
const DIA_SEGURO = 28;

function desde28Hasta(dia: number): number[] {
  return Array.from({ length: dia - DIA_SEGURO + 1 }, (_, i) => DIA_SEGURO + i);
}

/**
 * RRULE mensual para 1 o 2 días ascendentes. Para días 29–31 usa "el último día existente
 * entre el 28 y ese día" (BYSETPOS) para no saltarse los meses cortos.
 */
export function reglaRecurrencia(dias: readonly number[]): string {
  const base = 'RRULE:FREQ=MONTHLY;BYMONTHDAY=';
  const ultimo = dias[dias.length - 1];
  if (ultimo <= DIA_SEGURO) return `${base}${dias.join(',')}`;
  if (dias.length === 1) return `${base}${desde28Hasta(ultimo).join(',')};BYSETPOS=-1`;
  // El primer día de pago es ≤ 27 (regla de quincenas), así que siempre es la posición 1.
  return `${base}${[dias[0], ...desde28Hasta(ultimo)].join(',')};BYSETPOS=1,-1`;
}

/** Fecha en el mes indicado (puede salirse de 0–11); si el día no existe, el último del mes. */
function enMes(anio: number, mes: number, dia: number): Date {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(dia, ultimo));
}

/** Primera fecha desde hoy (incluido) en que cae alguno de los días. */
export function proximaFecha(dias: readonly number[], hoy: Date = new Date()): string {
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  for (const delta of [0, 1]) {
    const candidatas = dias
      .map((d) => enMes(inicio.getFullYear(), inicio.getMonth() + delta, d))
      .filter((f) => f >= inicio)
      .sort((a, b) => a.getTime() - b.getTime());
    if (candidatas.length > 0) return fechaLocalISO(candidatas[0]);
  }
  throw new Error('proximaFecha requiere al menos un día');
}

const compacta = (iso: string) => iso.replaceAll('-', '');

/** Enlace de plantilla de Google Calendar: evento de día completo que se repite cada mes. */
export function enlaceCalendario(
  datos: { nombre: string; monto: number },
  dias: readonly number[],
  moneda: string,
  hoy: Date = new Date(),
): string {
  const inicio = proximaFecha(dias, hoy);
  const fin = fechaLocalISO(addDays(parseISO(inicio), 1));
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Pagar ${datos.nombre}`,
    details: `Monto planeado: ${formatearMonto(datos.monto, moneda)}`,
    dates: `${compacta(inicio)}/${compacta(fin)}`,
    recur: reglaRecurrencia(dias),
  });
  return `https://calendar.google.com/calendar/render?${parametros}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/calendario.test.ts` → PASS. Luego `npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/calendario.ts src/domain/calendario.test.ts
git commit -m "feat: build google calendar reminder links for fixed expenses"
```

---

### Task 3: Reglas y datos — `diaPago`

**Files:**
- Modify: `firestore.rules` (función `fijoValido`), `src/data/fijos.ts` (`actualizarFijo`)
- Test: `tests/rules/firestore.rules.test.ts`

**Interfaces:**
- Consumes: forma de `DatosFijo` (Task 1).
- Produces: `actualizarFijo(uid, id, datos)` borra `diaPago` si no viene.

- [ ] **Step 1: Write the failing test**

Agregar dentro de `describe('fijos', ...)` en `tests/rules/firestore.rules.test.ts`:
```ts
  it('acepta día de pago entre 1 y 31 en mensuales', async () => {
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'a')), { ...mensual, diaPago: 1 }));
    await assertSucceeds(setDoc(doc(como(ALICIA), ruta(ALICIA, 'b')), { ...mensual, diaPago: 31 }));
  });

  it.each([
    ['día 0', { ...mensual, diaPago: 0 }],
    ['día 32', { ...mensual, diaPago: 32 }],
    ['día decimal', { ...mensual, diaPago: 5.5 }],
    ['día como texto', { ...mensual, diaPago: '5' }],
    ['día en un quincenal', { ...quincenal, diaPago: 5 }],
  ])('rechaza %s', async (_n, datos) => {
    await assertFails(setDoc(doc(como(ALICIA), ruta(ALICIA)), datos));
  });

  it('al editar se puede borrar el día, y pasar a quincenal exige borrarlo', async () => {
    await sembrar(ruta(ALICIA), { ...mensual, diaPago: 5 });
    await assertFails(
      updateDoc(doc(como(ALICIA), ruta(ALICIA)), { frecuencia: 'quincenal', quincena: deleteField() }),
    );
    await assertSucceeds(updateDoc(doc(como(ALICIA), ruta(ALICIA)), { diaPago: deleteField() }));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — los `rechaza día …` y el `assertFails` de pasar a quincenal con día pasan la escritura (hoy no hay regla para `diaPago`).

- [ ] **Step 3: Write minimal implementation**

En `firestore.rules`, dentro de `fijoValido()`, agregar al final de la expresión (antes del `;`):
```
            && (!('diaPago' in d)
              || (d.frecuencia == 'mensual' && d.diaPago is int && d.diaPago >= 1 && d.diaPago <= 31))
```

En `src/data/fijos.ts`, `actualizarFijo`:
```ts
/** Reemplaza los datos editables; borra `quincena` y `diaPago` si no vienen (las reglas lo exigen al pasar a quincenal). */
export function actualizarFijo(uid: string, id: string, datos: DatosFijo): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), {
    ...datos,
    quincena: datos.quincena ?? deleteField(),
    diaPago: datos.diaPago ?? deleteField(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:rules && npm run typecheck`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts src/data/fijos.ts
git commit -m "feat: validate fixed expense due day in rules"
```

---

### Task 4: Formulario y lista — campo "Día de pago" y botón de Calendar

**Files:**
- Modify: `src/features/ajustes/FormularioFijo.tsx`, `src/features/ajustes/FijosPage.tsx`

**Interfaces:**
- Consumes: `etiquetaVencimiento` (Task 1); `diasRecordatorio`, `enlaceCalendario` (Task 2); `DIAS_PAGO_POR_DEFECTO`, `DiasPago` de `src/domain/quincena.ts`; `usePerfil` (ya importado en `FijosPage`).
- Produces: `FormularioFijo` props `{ fijo?: Fijo; categorias: readonly Categoria[]; diasPago: DiasPago; moneda: string; onListo: () => void }`.

- [ ] **Step 1: `FormularioFijo.tsx` — props, estado y guardado**

Imports nuevos:
```ts
import { diasRecordatorio, enlaceCalendario } from '../../domain/calendario';
import type { DiasPago } from '../../domain/quincena';
```
Props:
```ts
interface Props {
  fijo?: Fijo;
  categorias: readonly Categoria[];
  diasPago: DiasPago;
  moneda: string;
  onListo: () => void;
}

export function FormularioFijo({ fijo, categorias, diasPago, moneda, onListo }: Props) {
```
Estado (después de `quincena`):
```ts
  const [diaTexto, setDiaTexto] = useState(fijo?.diaPago ? String(fijo.diaPago) : '');
```
En `guardar`, reemplazar el `diaPago: null` del Task 1 por el valor real:
```ts
    const diaPago = diaTexto === '' ? null : Number(diaTexto);
    const formulario = { nombre, monto: parsearMonto(montoTexto), categoriaId, frecuencia, quincena, diaPago, activo };
```
Antes del `return` (después de `opciones`):
```ts
  // El evento se arma con lo guardado, no con cambios sin guardar.
  const diasCalendario = fijo ? diasRecordatorio(fijo, diasPago) : null;
```

- [ ] **Step 2: `FormularioFijo.tsx` — campo y botón**

Dentro del bloque `{frecuencia === 'mensual' && ( ... )}`, envolver en fragmento y agregar el campo después del `Segmentado` de quincena:
```tsx
      {frecuencia === 'mensual' && (
        <>
          <Segmentado
            etiqueta="¿En qué quincena se paga?"
            valor={quincena}
            onCambio={setQuincena}
            opciones={[
              { valor: 1, etiqueta: 'Quincena 1' },
              { valor: 2, etiqueta: 'Quincena 2' },
            ]}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Día de pago (opcional)</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej. 5"
              value={diaTexto}
              onChange={(e) => setDiaTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 tabular-nums"
            />
            <span className="mt-1 block text-sm text-slate-500">Para recordarte en Google Calendar.</span>
            <MensajeError mensaje={errores.diaPago} />
          </label>
        </>
      )}
```
Entre el botón **Guardar** y el botón **Eliminar**:
```tsx
      {fijo && diasCalendario && (
        <div className="space-y-1">
          <a
            href={enlaceCalendario(fijo, diasCalendario, moneda)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 py-3 font-medium text-sky-700 hover:bg-sky-100"
          >
            📅 Agregar a Google Calendar
          </a>
          <p className="text-center text-xs text-slate-500">Si cambias este fijo, actualiza también el evento en Calendar.</p>
        </div>
      )}
```

- [ ] **Step 3: `FijosPage.tsx` — pasar props y mostrar vencimiento**

Imports: agregar `etiquetaVencimiento` al import de `../../domain/fijos` y:
```ts
import { DIAS_PAGO_POR_DEFECTO } from '../../domain/quincena';
```
En la fila, reemplazar el contenido de la línea secundaria:
```tsx
                      <span className="block text-sm text-slate-500">
                        {etiquetaFrecuencia(f)}
                        {etiquetaVencimiento(f) ? ` · ${etiquetaVencimiento(f)}` : ''}
                        {f.activo ? '' : ' · Pausado'}
                      </span>
```
En `<FormularioFijo ... />` agregar:
```tsx
            diasPago={perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO}
            moneda={moneda}
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/ajustes/FormularioFijo.tsx src/features/ajustes/FijosPage.tsx
git commit -m "feat: add due day field and google calendar button to fixed expenses"
```

---

### Task 5: Verificación de integración

**Files:** ninguno (correcciones con su propio commit `fix:` si algo falla).

- [ ] **Step 1: Checks automáticos**

Run: `npm run typecheck && npm test && npm run test:rules && npm run build`
Expected: todo PASS.

- [ ] **Step 2: Prueba manual en el celular** (PC por WiFi; `npm run emuladores` + `npm run dev:emu`; abrir `http://<IP-WiFi-de-la-PC>:5173`)

1. Crear fijo mensual "Internet" con día 5 → la lista dice "Mensual · Q… · vence el 5".
2. Abrirlo → botón "📅 Agregar a Google Calendar" → Calendar muestra "Pagar Internet", descripción con el monto, día completo, se repite cada mes el 5. Guardar.
3. Fijo mensual con día 30 → en Calendar, revisar que la repetición incluya el 28 (o 29) de febrero. **Si Google rechaza la regla o no la muestra bien**: aplicar el plan B del spec §7 (`BYMONTHDAY=-1` para días 29–31 en mensuales), con test RED→GREEN y commit `fix:`.
4. Fijo quincenal → el evento se repite en los dos días de pago del perfil.
5. Cambiar el monto sin guardar y tocar el botón → el evento muestra el monto guardado.
6. Borrar el día de un fijo y guardar → sin error; el botón desaparece. Pasar un mensual con día a quincenal → sin error.
7. Fijo mensual sin día → no hay botón.

- [ ] **Step 3: Reportar**

Resumen a la usuaria con lo verificado; no hacer `push` ni `merge` sin permiso.
