# Fase 1 — Base, login, categorías y registro de movimientos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web (PWA en fases siguientes) donde cada usuario entra con Google, tiene categorías editables y registra, edita, borra y consulta por mes sus gastos e ingresos.

**Architecture:** SPA React + TypeScript servida por Vite. Lógica de negocio en funciones puras (`src/domain/`) probadas con Vitest; acceso a Firestore aislado en `src/data/`; pantallas en `src/features/`. Desarrollo local contra Firebase Emulator (proyecto `demo-finanzas`), sin necesitar proyecto real hasta la Task 14.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 7 (paquete `react-router`), Firebase JS SDK 12 (Auth + Firestore), date-fns, lucide-react, Vitest, `@firebase/rules-unit-testing`, firebase-tools.

**Spec:** `docs/superpowers/specs/2026-10-06-app-finanzas-design.md` (esta fase = sección 11, punto 1).

## Global Constraints

- Costo $0: solo plan Spark de Firebase; **no usar Cloud Functions**.
- Montos siempre **enteros** (sin decimales). Moneda por defecto `COP`.
- Fechas de movimientos como texto `'YYYY-MM-DD'` en **hora local**, nunca `toISOString()`.
- Cada usuario solo accede a `users/{suUid}/**` (reglas de Firestore).
- Nombres de código y textos de UI en español.
- Diseño mobile-first: contenedor `max-w-md`, navegación inferior, áreas seguras (`env(safe-area-inset-*)`).
- Escrituras a Firestore **no se esperan** (`await`) en la UI: offline la promesa no resuelve hasta sincronizar. Se lanza la escritura, se cierra el formulario y se captura el error con toast.
- Permisos (CLAUDE.md de la usuaria): **pedir permiso antes de instalar dependencias, instalar Java, hacer commits, `firebase deploy`**. Pedir un permiso agrupado al inicio de la ejecución si es posible.

## Review Focus

1. **Monto escrito con puntos o comas** (`"1.500.000"`, `"15.000,50"`, `"0"`, `""`, `"abc"`) → se interpreta como pesos enteros o se rechaza con mensaje; nunca `150050` ni `NaN`. Pruebas en Task 2.
2. **Registrar de noche** (después de las 7 p. m. en Colombia, UTC−5) → la fecha por defecto es hoy local, no mañana. Pruebas en Task 3.
3. **Usuario B intenta leer o escribir datos de A**, o alguien sin sesión → rechazado por reglas. Pruebas en Task 6.
4. **Nota vacía o borrada al editar** → no rompe el guardado (Firestore rechaza `undefined`) y la nota se elimina del documento. Pruebas en Task 5 + `deleteField()` en Task 7.
5. **Guardar sin conexión** → la hoja se cierra al instante y el movimiento aparece en la lista; al volver la conexión se sincroniza. Verificación manual en Task 10.

---

## Mapa de archivos

```
.gitignore, .gitattributes, package.json, tsconfig.json, index.html
vite.config.ts                 Vite + React + Tailwind + Vitest (pruebas de domain)
vitest.rules.config.ts         Vitest para pruebas de reglas (corre dentro del emulador)
firebase.json, firestore.rules, firestore.indexes.json
.env.emulador                  config falsa para desarrollo con emuladores (se versiona)
.env.example                   plantilla de config real (la real va en .env.local, ignorado)
src/
  main.tsx, App.tsx, index.css, vite-env.d.ts
  domain/   dinero.ts, fechas.ts, categorias.ts, movimientos.ts (+ *.test.ts)
  lib/      firebase.ts, useEnLinea.ts
  data/     usuario.ts, categorias.ts, movimientos.ts, hooks.ts
  components/ HojaInferior.tsx, ToastProvider.tsx, toastContexto.ts, BottomNav.tsx,
              Layout.tsx, MensajeError.tsx, BurbujaCategoria.tsx, SelectorTipo.tsx,
              FilaMovimiento.tsx
  features/
    auth/        contexto.ts, AuthProvider.tsx, acciones.ts, LoginPage.tsx
    movimientos/ RegistroRapido.tsx, MovimientosPage.tsx
    inicio/      InicioPage.tsx
    ajustes/     AjustesPage.tsx, CategoriasPage.tsx, FormularioCategoria.tsx
tests/rules/firestore.rules.test.ts
```

---

### Task 1: Proyecto base (Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.gitattributes`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Produces: scripts `dev`, `dev:emu`, `build`, `typecheck`, `test`, `test:rules`, `emuladores`.

- [ ] **Step 1: Crear `package.json`** (sin dependencias; se instalan en el Step 2 para obtener las últimas versiones)

```json
{
  "name": "app-finanzas",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:emu": "vite --mode emulador",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:rules": "firebase emulators:exec --only firestore --project demo-finanzas \"vitest run --config vitest.rules.config.ts\"",
    "emuladores": "firebase emulators:start --project demo-finanzas"
  }
}
```

- [ ] **Step 2: Instalar dependencias** (pedir permiso antes)

```bash
npm install react react-dom react-router firebase date-fns lucide-react
npm install -D typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest @types/react @types/react-dom @types/node firebase-tools @firebase/rules-unit-testing
```

Expected: termina sin `ERESOLVE`. Si hay conflicto de peer entre `vitest` y `vite`, instalar la versión de `vitest` cuyo peer acepte la `vite` instalada (`npm view vitest peerDependencies`).

- [ ] **Step 3: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.rules.config.ts"]
}
```

- [ ] **Step 4: Crear `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#10b981" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐷</text></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>Mis finanzas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear `src/index.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
}

@keyframes subir {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

html {
  -webkit-tap-highlight-color: transparent;
}

body {
  @apply bg-slate-50 text-slate-800 antialiased;
}
```

- [ ] **Step 7: Crear `src/App.tsx` y `src/main.tsx`**

```tsx
// src/App.tsx
export default function App() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-2xl font-bold text-emerald-600">
      Mis finanzas 🐷
    </div>
  );
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Crear `.gitignore` y `.gitattributes`**

```gitignore
node_modules/
dist/
.env.local
.env.*.local
*.log
.firebase/
```

```gitattributes
* text=auto eol=lf
```

- [ ] **Step 9: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sin errores de tipos; Vitest "No test files found" con salida 0; `dist/` generado.

Run: `npm run dev` y abrir http://localhost:5173
Expected: texto verde "Mis finanzas 🐷" centrado con fuente Plus Jakarta Sans.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold vite react ts tailwind vitest project"
```

---

### Task 2: Dinero — formatear y parsear montos

**Files:**
- Create: `src/domain/dinero.ts`
- Test: `src/domain/dinero.test.ts`

**Interfaces:**
- Produces:
  - `formatearMonto(monto: number, moneda?: string): string` — por defecto `'COP'`, sin decimales, separador de miles `.`
  - `parsearMonto(texto: string): number | null` — entero > 0 o `null`
  - `agruparMiles(texto: string): string` — solo dígitos de la parte entera, agrupados con `.`; `''` si no hay dígitos

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/domain/dinero.test.ts
import { describe, expect, it } from 'vitest';
import { agruparMiles, formatearMonto, parsearMonto } from './dinero';

const sinEspeciales = (texto: string) => texto.replace(/\s/g, ' ');

describe('formatearMonto', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(sinEspeciales(formatearMonto(15000))).toBe('$ 15.000');
    expect(sinEspeciales(formatearMonto(1500000))).toBe('$ 1.500.000');
  });

  it('agrupa también montos de 4 dígitos', () => {
    expect(sinEspeciales(formatearMonto(1500))).toBe('$ 1.500');
  });

  it('formatea cero', () => {
    expect(sinEspeciales(formatearMonto(0))).toBe('$ 0');
  });
});

describe('parsearMonto', () => {
  it.each([
    ['15000', 15000],
    ['15.000', 15000],
    ['$ 1.500.000', 1500000],
    ['15.000,50', 15000],
    ['  2500 ', 2500],
  ])('interpreta "%s" como %i', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(['', '0', '0.000', 'abc', ',50', '99999999999999999999'])('rechaza "%s"', (texto) => {
    expect(parsearMonto(texto)).toBeNull();
  });
});

describe('agruparMiles', () => {
  it('agrupa mientras se escribe', () => {
    expect(agruparMiles('1500000')).toBe('1.500.000');
    expect(agruparMiles('1.5000')).toBe('15.000');
    expect(agruparMiles('150')).toBe('150');
  });

  it('ignora decimales y texto', () => {
    expect(agruparMiles('15000,5')).toBe('15.000');
    expect(agruparMiles('abc')).toBe('');
    expect(agruparMiles('')).toBe('');
  });

  it('quita ceros a la izquierda', () => {
    expect(agruparMiles('0015')).toBe('15');
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/domain/dinero.test.ts`
Expected: FAIL — `Failed to resolve import "./dinero"`.

- [ ] **Step 3: Implementar**

```ts
// src/domain/dinero.ts
export function formatearMonto(monto: number, moneda = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: 'always',
  }).format(monto);
}

function digitosEnteros(texto: string): string {
  const parteEntera = texto.split(',')[0];
  return parteEntera.replace(/\D/g, '').replace(/^0+/, '');
}

export function parsearMonto(texto: string): number | null {
  const digitos = digitosEnteros(texto);
  if (digitos === '') return null;
  const monto = Number(digitos);
  return Number.isSafeInteger(monto) && monto > 0 ? monto : null;
}

export function agruparMiles(texto: string): string {
  return digitosEnteros(texto).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/domain/dinero.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/domain/dinero.ts src/domain/dinero.test.ts
git commit -m "feat: add money parsing and formatting"
```

---

### Task 3: Fechas — fecha local, etiquetas y meses

**Files:**
- Create: `src/domain/fechas.ts`
- Test: `src/domain/fechas.test.ts`

**Interfaces:**
- Produces:
  - `interface MesAnio { anio: number; mes: number }` — `mes` de 0 (enero) a 11
  - `fechaLocalISO(fecha?: Date): string` — `'YYYY-MM-DD'` en hora local
  - `etiquetaFecha(iso: string, hoy?: Date): string` — `'Hoy'`, `'Ayer'`, `'jue 1 oct'`, o con año si es otro año
  - `mesActual(hoy?: Date): MesAnio`
  - `desplazarMes(mes: MesAnio, delta: number): MesAnio`
  - `rangoMes(anio: number, mes: number): { desde: string; hasta: string }`
  - `nombreMes(anio: number, mes: number): string` — `'Octubre 2026'`

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/domain/fechas.test.ts
import { describe, expect, it } from 'vitest';
import { desplazarMes, etiquetaFecha, fechaLocalISO, mesActual, nombreMes, rangoMes } from './fechas';

describe('fechaLocalISO', () => {
  it('usa la fecha local aunque sea de noche', () => {
    expect(fechaLocalISO(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });

  it('rellena mes y día con ceros', () => {
    expect(fechaLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('etiquetaFecha', () => {
  const hoy = new Date(2026, 9, 6, 10, 0);

  it('dice Hoy y Ayer', () => {
    expect(etiquetaFecha('2026-10-06', hoy)).toBe('Hoy');
    expect(etiquetaFecha('2026-10-05', hoy)).toBe('Ayer');
  });

  it('muestra día de la semana, día y mes', () => {
    expect(etiquetaFecha('2026-10-01', hoy)).toBe('jue 1 oct');
  });

  it('agrega el año si es otro año', () => {
    expect(etiquetaFecha('2025-12-31', hoy)).toBe('mié 31 dic 2025');
  });
});

describe('meses', () => {
  it('mesActual toma año y mes de la fecha', () => {
    expect(mesActual(new Date(2026, 9, 6))).toEqual({ anio: 2026, mes: 9 });
  });

  it('desplazarMes cruza años', () => {
    expect(desplazarMes({ anio: 2026, mes: 0 }, -1)).toEqual({ anio: 2025, mes: 11 });
    expect(desplazarMes({ anio: 2026, mes: 11 }, 1)).toEqual({ anio: 2027, mes: 0 });
    expect(desplazarMes({ anio: 2026, mes: 5 }, 0)).toEqual({ anio: 2026, mes: 5 });
  });

  it('rangoMes cubre el mes completo, incluso febrero bisiesto', () => {
    expect(rangoMes(2026, 1)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoMes(2028, 1)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoMes(2026, 11)).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
  });

  it('nombreMes', () => {
    expect(nombreMes(2026, 9)).toBe('Octubre 2026');
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/domain/fechas.test.ts`
Expected: FAIL — `Failed to resolve import "./fechas"`.

- [ ] **Step 3: Implementar**

```ts
// src/domain/fechas.ts
import { differenceInCalendarDays, format, lastDayOfMonth, parseISO } from 'date-fns';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface MesAnio {
  anio: number;
  /** 0 = enero … 11 = diciembre */
  mes: number;
}

export function fechaLocalISO(fecha: Date = new Date()): string {
  return format(fecha, 'yyyy-MM-dd');
}

export function etiquetaFecha(iso: string, hoy: Date = new Date()): string {
  const fecha = parseISO(iso);
  const diferencia = differenceInCalendarDays(hoy, fecha);
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Ayer';
  const base = `${DIAS[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
  return fecha.getFullYear() === hoy.getFullYear() ? base : `${base} ${fecha.getFullYear()}`;
}

export function mesActual(hoy: Date = new Date()): MesAnio {
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
}

export function desplazarMes({ anio, mes }: MesAnio, delta: number): MesAnio {
  const total = anio * 12 + mes + delta;
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

export function rangoMes(anio: number, mes: number): { desde: string; hasta: string } {
  const inicio = new Date(anio, mes, 1);
  return { desde: fechaLocalISO(inicio), hasta: fechaLocalISO(lastDayOfMonth(inicio)) };
}

export function nombreMes(anio: number, mes: number): string {
  return `${MESES[mes]} ${anio}`;
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/domain/fechas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fechas.ts src/domain/fechas.test.ts
git commit -m "feat: add local date helpers and month ranges"
```

---

### Task 4: Categorías — tipos, valores por defecto y validación

**Files:**
- Create: `src/domain/categorias.ts`
- Test: `src/domain/categorias.test.ts`

**Interfaces:**
- Produces:
  - `type TipoCategoria = 'gasto' | 'ingreso'`
  - `interface DatosCategoria { nombre: string; icono: string; color: string; tipo: TipoCategoria; orden: number; sistema: boolean; archivada: boolean }`
  - `interface Categoria extends DatosCategoria { id: string }`
  - `CATEGORIAS_POR_DEFECTO: readonly Categoria[]` (ids fijos; `ahorro` y `deudas` con `sistema: true`)
  - `ICONOS_DISPONIBLES: readonly string[]`, `COLORES_DISPONIBLES: readonly string[]`
  - `categoriasActivas(categorias: readonly Categoria[], tipo: TipoCategoria): Categoria[]`
  - `validarNombreCategoria(nombre: string, existentes: readonly Categoria[], tipo: TipoCategoria, idActual?: string): string | null`
  - `siguienteOrden(categorias: readonly Categoria[], tipo: TipoCategoria): number`

Nota de diseño: en esta fase las categorías nunca se borran, solo se archivan (cumple "no perder historial" del spec §4.6 sin tener que contar movimientos).

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/domain/categorias.test.ts
import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_POR_DEFECTO,
  categoriasActivas,
  siguienteOrden,
  validarNombreCategoria,
  type Categoria,
} from './categorias';

const cat = (cambios: Partial<Categoria>): Categoria => ({
  id: 'x',
  nombre: 'X',
  icono: '📦',
  color: '#94a3b8',
  tipo: 'gasto',
  orden: 0,
  sistema: false,
  archivada: false,
  ...cambios,
});

describe('CATEGORIAS_POR_DEFECTO', () => {
  it('tiene ids únicos', () => {
    const ids = CATEGORIAS_POR_DEFECTO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('incluye Ahorro y Deudas como categorías de sistema', () => {
    const sistema = CATEGORIAS_POR_DEFECTO.filter((c) => c.sistema).map((c) => c.id).sort();
    expect(sistema).toEqual(['ahorro', 'deudas']);
  });

  it('incluye gastos e ingresos', () => {
    expect(CATEGORIAS_POR_DEFECTO.some((c) => c.tipo === 'gasto')).toBe(true);
    expect(CATEGORIAS_POR_DEFECTO.some((c) => c.tipo === 'ingreso')).toBe(true);
  });
});

describe('categoriasActivas', () => {
  it('filtra por tipo, oculta archivadas y ordena por orden', () => {
    const lista = [
      cat({ id: 'b', orden: 2 }),
      cat({ id: 'a', orden: 1 }),
      cat({ id: 'arch', orden: 0, archivada: true }),
      cat({ id: 'ing', tipo: 'ingreso', orden: 0 }),
    ];
    expect(categoriasActivas(lista, 'gasto').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('no modifica la lista original', () => {
    const lista = [cat({ id: 'b', orden: 2 }), cat({ id: 'a', orden: 1 })];
    categoriasActivas(lista, 'gasto');
    expect(lista.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('validarNombreCategoria', () => {
  const existentes = [cat({ id: 'comida', nombre: 'Comida' }), cat({ id: 'sal', nombre: 'Salario', tipo: 'ingreso' })];

  it('exige nombre', () => {
    expect(validarNombreCategoria('', existentes, 'gasto')).toBe('Escribe un nombre');
    expect(validarNombreCategoria('   ', existentes, 'gasto')).toBe('Escribe un nombre');
  });

  it('limita a 40 caracteres', () => {
    expect(validarNombreCategoria('a'.repeat(41), existentes, 'gasto')).toBe('Máximo 40 caracteres');
    expect(validarNombreCategoria('a'.repeat(40), existentes, 'gasto')).toBeNull();
  });

  it('no permite repetidos del mismo tipo, sin importar mayúsculas ni espacios', () => {
    expect(validarNombreCategoria(' comida ', existentes, 'gasto')).toBe('Ya existe una categoría con ese nombre');
  });

  it('permite el mismo nombre en otro tipo', () => {
    expect(validarNombreCategoria('Salario', existentes, 'gasto')).toBeNull();
  });

  it('permite conservar el nombre al editar la misma categoría', () => {
    expect(validarNombreCategoria('Comida', existentes, 'gasto', 'comida')).toBeNull();
  });
});

describe('siguienteOrden', () => {
  it('es uno más que el mayor del mismo tipo', () => {
    const lista = [cat({ orden: 3 }), cat({ orden: 7 }), cat({ orden: 50, tipo: 'ingreso' })];
    expect(siguienteOrden(lista, 'gasto')).toBe(8);
  });

  it('es 0 si no hay categorías de ese tipo', () => {
    expect(siguienteOrden([], 'ingreso')).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: FAIL — `Failed to resolve import "./categorias"`.

- [ ] **Step 3: Implementar**

```ts
// src/domain/categorias.ts
export type TipoCategoria = 'gasto' | 'ingreso';

export interface DatosCategoria {
  nombre: string;
  icono: string;
  color: string;
  tipo: TipoCategoria;
  orden: number;
  sistema: boolean;
  archivada: boolean;
}

export interface Categoria extends DatosCategoria {
  id: string;
}

const MAX_NOMBRE = 40;

function crear(tipo: TipoCategoria, id: string, nombre: string, icono: string, color: string, orden: number, sistema = false): Categoria {
  return { id, nombre, icono, color, tipo, orden, sistema, archivada: false };
}

export const CATEGORIAS_POR_DEFECTO: readonly Categoria[] = [
  crear('gasto', 'comida', 'Comida', '🍔', '#f97316', 0),
  crear('gasto', 'transporte', 'Transporte / Pasajes', '🚌', '#3b82f6', 1),
  crear('gasto', 'arriendo', 'Arriendo', '🏠', '#8b5cf6', 2),
  crear('gasto', 'servicios', 'Servicios', '💡', '#eab308', 3),
  crear('gasto', 'salud', 'Salud', '🩺', '#ef4444', 4),
  crear('gasto', 'entretenimiento', 'Entretenimiento', '🎬', '#ec4899', 5),
  crear('gasto', 'ropa', 'Ropa', '👕', '#14b8a6', 6),
  crear('gasto', 'educacion', 'Educación', '📚', '#6366f1', 7),
  crear('gasto', 'deudas', 'Deudas', '💳', '#64748b', 8, true),
  crear('gasto', 'ahorro', 'Ahorro', '🐷', '#10b981', 9, true),
  crear('gasto', 'otros-gasto', 'Otros', '📦', '#94a3b8', 10),
  crear('ingreso', 'salario', 'Salario', '💼', '#10b981', 0),
  crear('ingreso', 'extra', 'Extra', '✨', '#f59e0b', 1),
  crear('ingreso', 'otros-ingreso', 'Otros', '💰', '#84cc16', 2),
];

export const ICONOS_DISPONIBLES: readonly string[] = [
  '🍔', '🛒', '☕', '🚌', '🚕', '⛽', '🏠',
  '💡', '📱', '🩺', '💊', '🎬', '🎮', '👕',
  '💇', '📚', '🎁', '🐶', '✈️', '💳', '🐷',
  '📦', '💼', '✨', '💰', '🏦', '🧾', '❤️',
];

export const COLORES_DISPONIBLES: readonly string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#94a3b8',
];

export function categoriasActivas(categorias: readonly Categoria[], tipo: TipoCategoria): Categoria[] {
  return categorias.filter((c) => c.tipo === tipo && !c.archivada).sort((a, b) => a.orden - b.orden);
}

export function validarNombreCategoria(
  nombre: string,
  existentes: readonly Categoria[],
  tipo: TipoCategoria,
  idActual?: string,
): string | null {
  const limpio = nombre.trim();
  if (!limpio) return 'Escribe un nombre';
  if (limpio.length > MAX_NOMBRE) return `Máximo ${MAX_NOMBRE} caracteres`;
  const clave = limpio.toLocaleLowerCase('es');
  const repetida = existentes.some(
    (c) => c.tipo === tipo && c.id !== idActual && c.nombre.trim().toLocaleLowerCase('es') === clave,
  );
  return repetida ? 'Ya existe una categoría con ese nombre' : null;
}

export function siguienteOrden(categorias: readonly Categoria[], tipo: TipoCategoria): number {
  return Math.max(-1, ...categorias.filter((c) => c.tipo === tipo).map((c) => c.orden)) + 1;
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/categorias.ts src/domain/categorias.test.ts
git commit -m "feat: add category model, defaults and validation"
```

---

### Task 5: Movimientos — tipos, validación, normalización y agrupación

**Files:**
- Create: `src/domain/movimientos.ts`
- Test: `src/domain/movimientos.test.ts`

**Interfaces:**
- Consumes: `TipoCategoria` de `src/domain/categorias.ts`.
- Produces:
  - `type TipoMovimiento = TipoCategoria`
  - `interface DatosMovimiento { tipo: TipoMovimiento; monto: number; categoriaId: string; fecha: string; nota?: string }`
  - `interface OrigenMovimiento { tipo: 'fijo' | 'deuda' | 'meta'; id: string }`
  - `interface Movimiento extends DatosMovimiento { id: string; origen?: OrigenMovimiento }`
  - `interface FormularioMovimiento { tipo: TipoMovimiento; monto: number | null; categoriaId: string; fecha: string; nota: string }`
  - `type ErroresMovimiento = Partial<Record<'monto' | 'categoriaId' | 'fecha' | 'nota', string>>`
  - `MAX_NOTA = 200`
  - `validarMovimiento(f: FormularioMovimiento): ErroresMovimiento`
  - `normalizarMovimiento(f: FormularioMovimiento): DatosMovimiento` (lanza si `monto` es `null`)
  - `sumarPorTipo(movimientos: readonly DatosMovimiento[]): { gastos: number; ingresos: number }`
  - `interface GrupoFecha { fecha: string; movimientos: Movimiento[] }`
  - `agruparPorFecha(movimientos: readonly Movimiento[]): GrupoFecha[]` (fechas descendentes, conserva el orden interno)

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/domain/movimientos.test.ts
import { describe, expect, it } from 'vitest';
import {
  agruparPorFecha,
  normalizarMovimiento,
  sumarPorTipo,
  validarMovimiento,
  type FormularioMovimiento,
  type Movimiento,
} from './movimientos';

const formulario = (cambios: Partial<FormularioMovimiento> = {}): FormularioMovimiento => ({
  tipo: 'gasto',
  monto: 15000,
  categoriaId: 'comida',
  fecha: '2026-10-06',
  nota: '',
  ...cambios,
});

const mov = (id: string, cambios: Partial<Movimiento> = {}): Movimiento => ({
  id,
  tipo: 'gasto',
  monto: 1000,
  categoriaId: 'comida',
  fecha: '2026-10-06',
  ...cambios,
});

describe('validarMovimiento', () => {
  it('acepta un movimiento completo', () => {
    expect(validarMovimiento(formulario())).toEqual({});
  });

  it('exige monto mayor a 0', () => {
    expect(validarMovimiento(formulario({ monto: null })).monto).toBe('Escribe un monto mayor a 0');
    expect(validarMovimiento(formulario({ monto: 0 })).monto).toBe('Escribe un monto mayor a 0');
  });

  it('exige categoría', () => {
    expect(validarMovimiento(formulario({ categoriaId: '' })).categoriaId).toBe('Elige una categoría');
  });

  it('exige fecha con formato YYYY-MM-DD', () => {
    expect(validarMovimiento(formulario({ fecha: '' })).fecha).toBe('Elige una fecha');
    expect(validarMovimiento(formulario({ fecha: '6/10/2026' })).fecha).toBe('Elige una fecha');
  });

  it('limita la nota a 200 caracteres', () => {
    expect(validarMovimiento(formulario({ nota: 'x'.repeat(201) })).nota).toBe('Máximo 200 caracteres');
    expect(validarMovimiento(formulario({ nota: 'x'.repeat(200) })).nota).toBeUndefined();
  });
});

describe('normalizarMovimiento', () => {
  it('recorta la nota', () => {
    expect(normalizarMovimiento(formulario({ nota: '  almuerzo  ' })).nota).toBe('almuerzo');
  });

  it('omite la nota vacía en vez de dejarla undefined o ""', () => {
    const datos = normalizarMovimiento(formulario({ nota: '   ' }));
    expect(datos).not.toHaveProperty('nota');
    expect(datos).toEqual({ tipo: 'gasto', monto: 15000, categoriaId: 'comida', fecha: '2026-10-06' });
  });

  it('lanza si el monto no fue validado', () => {
    expect(() => normalizarMovimiento(formulario({ monto: null }))).toThrow();
  });
});

describe('sumarPorTipo', () => {
  it('suma gastos e ingresos por separado', () => {
    const lista = [mov('a', { monto: 1000 }), mov('b', { monto: 2500 }), mov('c', { tipo: 'ingreso', monto: 50000 })];
    expect(sumarPorTipo(lista)).toEqual({ gastos: 3500, ingresos: 50000 });
  });

  it('devuelve ceros con lista vacía', () => {
    expect(sumarPorTipo([])).toEqual({ gastos: 0, ingresos: 0 });
  });
});

describe('agruparPorFecha', () => {
  it('agrupa por fecha en orden descendente y conserva el orden dentro del día', () => {
    const lista = [
      mov('a', { fecha: '2026-10-05' }),
      mov('b', { fecha: '2026-10-06' }),
      mov('c', { fecha: '2026-10-05' }),
    ];
    const grupos = agruparPorFecha(lista);
    expect(grupos.map((g) => g.fecha)).toEqual(['2026-10-06', '2026-10-05']);
    expect(grupos[1].movimientos.map((m) => m.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/domain/movimientos.test.ts`
Expected: FAIL — `Failed to resolve import "./movimientos"`.

- [ ] **Step 3: Implementar**

```ts
// src/domain/movimientos.ts
import type { TipoCategoria } from './categorias';

export type TipoMovimiento = TipoCategoria;

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  monto: number;
  categoriaId: string;
  /** 'YYYY-MM-DD' en hora local */
  fecha: string;
  nota?: string;
}

export interface OrigenMovimiento {
  tipo: 'fijo' | 'deuda' | 'meta';
  id: string;
}

export interface Movimiento extends DatosMovimiento {
  id: string;
  origen?: OrigenMovimiento;
}

export interface FormularioMovimiento {
  tipo: TipoMovimiento;
  monto: number | null;
  categoriaId: string;
  fecha: string;
  nota: string;
}

export type ErroresMovimiento = Partial<Record<'monto' | 'categoriaId' | 'fecha' | 'nota', string>>;

export const MAX_NOTA = 200;

export function validarMovimiento(f: FormularioMovimiento): ErroresMovimiento {
  const errores: ErroresMovimiento = {};
  if (f.monto === null || f.monto <= 0) errores.monto = 'Escribe un monto mayor a 0';
  if (!f.categoriaId) errores.categoriaId = 'Elige una categoría';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) errores.fecha = 'Elige una fecha';
  if (f.nota.trim().length > MAX_NOTA) errores.nota = `Máximo ${MAX_NOTA} caracteres`;
  return errores;
}

export function normalizarMovimiento(f: FormularioMovimiento): DatosMovimiento {
  if (f.monto === null) throw new Error('normalizarMovimiento requiere un monto validado');
  const datos: DatosMovimiento = { tipo: f.tipo, monto: f.monto, categoriaId: f.categoriaId, fecha: f.fecha };
  const nota = f.nota.trim();
  if (nota) datos.nota = nota;
  return datos;
}

export function sumarPorTipo(movimientos: readonly DatosMovimiento[]): { gastos: number; ingresos: number } {
  const totales = { gastos: 0, ingresos: 0 };
  for (const m of movimientos) {
    if (m.tipo === 'gasto') totales.gastos += m.monto;
    else totales.ingresos += m.monto;
  }
  return totales;
}

export interface GrupoFecha {
  fecha: string;
  movimientos: Movimiento[];
}

export function agruparPorFecha(movimientos: readonly Movimiento[]): GrupoFecha[] {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    const grupo = grupos.get(m.fecha);
    if (grupo) grupo.push(m);
    else grupos.set(m.fecha, [m]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, lista]) => ({ fecha, movimientos: lista }));
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm test`
Expected: PASS — todas las pruebas de `src/domain/`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/movimientos.ts src/domain/movimientos.test.ts
git commit -m "feat: add movement model, validation and grouping"
```

---

### Task 6: Reglas de seguridad de Firestore + pruebas en emulador

**Files:**
- Create: `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `vitest.rules.config.ts`
- Test: `tests/rules/firestore.rules.test.ts`

**Interfaces:**
- Produces: reglas que permiten a cada usuario solo `users/{uid}`, `users/{uid}/categorias/*`, `users/{uid}/movimientos/*`. Las colecciones `fijos`, `metas` y `deudas` quedan **cerradas** hasta sus fases.

**Prerrequisito:** el emulador de Firestore necesita **Java 21+**. No está instalado. Pedir permiso a la usuaria y ejecutar:

```bash
winget install --id Microsoft.OpenJDK.21 -e
```

Luego abrir una terminal nueva y verificar `java -version` → `openjdk version "21...`. La primera ejecución del emulador descarga su `.jar` a `~/.cache/firebase/emulators` (fuera del proyecto; incluido en el mismo permiso).

- [ ] **Step 1: Crear `firebase.json` y `firestore.indexes.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Crear reglas iniciales que niegan todo** (para ver fallar las pruebas)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Crear `vitest.rules.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 4: Escribir las pruebas**

```ts
// tests/rules/firestore.rules.test.ts
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
```

- [ ] **Step 5: Correr y ver que fallan**

Run: `npm run test:rules`
Expected: FAIL — las pruebas con `assertSucceeds` fallan con `PERMISSION_DENIED` (las de `assertFails` pasan).

- [ ] **Step 6: Escribir las reglas reales en `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function esDueno(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read, write: if esDueno(uid);

      match /categorias/{id} {
        function categoriaValida() {
          let d = request.resource.data;
          return d.nombre is string && d.nombre.size() > 0 && d.nombre.size() <= 40
            && d.tipo in ['gasto', 'ingreso']
            && d.icono is string
            && d.color is string
            && d.orden is int
            && d.sistema is bool
            && d.archivada is bool;
        }

        allow read: if esDueno(uid);
        allow create: if esDueno(uid) && categoriaValida();
        allow update: if esDueno(uid) && categoriaValida()
          && request.resource.data.sistema == resource.data.sistema
          && !(resource.data.sistema && request.resource.data.archivada);
        allow delete: if false;
      }

      match /movimientos/{id} {
        function movimientoValido() {
          let d = request.resource.data;
          return d.tipo in ['gasto', 'ingreso']
            && d.monto is int && d.monto > 0
            && d.categoriaId is string && d.categoriaId.size() > 0
            && d.fecha is string && d.fecha.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            && (!('nota' in d) || (d.nota is string && d.nota.size() <= 200));
        }

        allow read, delete: if esDueno(uid);
        allow create, update: if esDueno(uid) && movimientoValido();
      }
    }
  }
}
```

- [ ] **Step 7: Correr y ver que pasan**

Run: `npm run test:rules`
Expected: PASS — todas.

- [ ] **Step 8: Commit**

```bash
git add firebase.json firestore.rules firestore.indexes.json vitest.rules.config.ts tests/rules
git commit -m "feat: add firestore security rules with emulator tests"
```

---

### Task 7: Cliente Firebase y capa de datos

**Files:**
- Create: `src/vite-env.d.ts`, `.env.emulador`, `.env.example`, `src/lib/firebase.ts`, `src/data/usuario.ts`, `src/data/categorias.ts`, `src/data/movimientos.ts`, `src/data/hooks.ts`

**Interfaces:**
- Consumes: `Categoria`, `DatosCategoria`, `CATEGORIAS_POR_DEFECTO` (Task 4); `Movimiento`, `DatosMovimiento` (Task 5).
- Produces:
  - `auth`, `db`, `proveedorGoogle` desde `src/lib/firebase.ts`
  - `interface Perfil { nombre: string; email: string; moneda: string; diasPago: [number, number] }`
  - `asegurarPerfil(usuario: User): Promise<void>` — crea perfil + categorías por defecto si no existe
  - `escucharPerfil(uid, alCambiar: (p: Perfil | null) => void): Unsubscribe`
  - `escucharCategorias(uid, alCambiar: (c: Categoria[]) => void): Unsubscribe`
  - `crearCategoria(uid, datos: DatosCategoria): Promise<void>`
  - `type CambiosCategoria = Partial<Pick<DatosCategoria, 'nombre' | 'icono' | 'color' | 'archivada'>>`
  - `actualizarCategoria(uid, id, cambios: CambiosCategoria): Promise<void>`
  - `escucharMovimientosEntre(uid, desde: string, hasta: string, alCambiar: (m: Movimiento[]) => void): Unsubscribe` (orden: fecha descendente)
  - `crearMovimiento(uid, datos: DatosMovimiento): Promise<void>`
  - `actualizarMovimiento(uid, id, datos: DatosMovimiento): Promise<void>` (si `datos.nota` no existe, borra el campo)
  - `borrarMovimiento(uid, id): Promise<void>`
  - Hooks: `usePerfil(uid): { datos: Perfil | null; cargando: boolean }`, `useCategorias(uid): { datos: Categoria[]; cargando: boolean }`, `useMovimientosEntre(uid, desde, hasta): { datos: Movimiento[]; cargando: boolean }`

Sin pruebas unitarias: son envoltorios delgados del SDK y las reglas ya están probadas. Se verifican con `typecheck` aquí y de punta a punta en las Tasks 9–13.

- [ ] **Step 1: Tipos de variables de entorno — `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: `.env.emulador` (se versiona; no tiene secretos) y `.env.example`**

```
VITE_USE_EMULATORS=true
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-finanzas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-finanzas
VITE_FIREBASE_APP_ID=demo-app
```

```
# Copiar a .env.local y llenar con la config de la app web del proyecto Firebase real
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 3: `src/lib/firebase.ts`**

```ts
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Copia local en IndexedDB: permite registrar sin conexión y sincroniza después.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

export const proveedorGoogle = new GoogleAuthProvider();

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

- [ ] **Step 4: `src/data/usuario.ts`**

```ts
import type { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { CATEGORIAS_POR_DEFECTO } from '../domain/categorias';
import { db } from '../lib/firebase';

export interface Perfil {
  nombre: string;
  email: string;
  moneda: string;
  diasPago: [number, number];
}

export async function asegurarPerfil(usuario: User): Promise<void> {
  const ref = doc(db, 'users', usuario.uid);
  if ((await getDoc(ref)).exists()) return;

  const lote = writeBatch(db);
  lote.set(ref, {
    nombre: usuario.displayName ?? '',
    email: usuario.email ?? '',
    moneda: 'COP',
    diasPago: [15, 30],
    creadoEn: serverTimestamp(),
  });
  for (const { id, ...datos } of CATEGORIAS_POR_DEFECTO) {
    lote.set(doc(db, 'users', usuario.uid, 'categorias', id), datos);
  }
  await lote.commit();
}

export function escucharPerfil(uid: string, alCambiar: (perfil: Perfil | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => alCambiar(snap.exists() ? (snap.data() as Perfil) : null),
    (error) => console.error('Error escuchando perfil', error),
  );
}
```

- [ ] **Step 5: `src/data/categorias.ts`**

```ts
import { addDoc, collection, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import type { Categoria, DatosCategoria } from '../domain/categorias';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'categorias');

export function escucharCategorias(uid: string, alCambiar: (categorias: Categoria[]) => void): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosCategoria) }))),
    (error) => console.error('Error escuchando categorías', error),
  );
}

export async function crearCategoria(uid: string, datos: DatosCategoria): Promise<void> {
  await addDoc(coleccion(uid), datos);
}

export type CambiosCategoria = Partial<Pick<DatosCategoria, 'nombre' | 'icono' | 'color' | 'archivada'>>;

export function actualizarCategoria(uid: string, id: string, cambios: CambiosCategoria): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), cambios);
}
```

- [ ] **Step 6: `src/data/movimientos.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosMovimiento, Movimiento } from '../domain/movimientos';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'movimientos');

export function escucharMovimientosEntre(
  uid: string,
  desde: string,
  hasta: string,
  alCambiar: (movimientos: Movimiento[]) => void,
): Unsubscribe {
  const consulta = query(
    coleccion(uid),
    where('fecha', '>=', desde),
    where('fecha', '<=', hasta),
    orderBy('fecha', 'desc'),
  );
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Movimiento, 'id'>) }))),
    (error) => console.error('Error escuchando movimientos', error),
  );
}

export async function crearMovimiento(uid: string, datos: DatosMovimiento): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, creadoEn: serverTimestamp() });
}

export function actualizarMovimiento(uid: string, id: string, datos: DatosMovimiento): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos, nota: datos.nota ?? deleteField() });
}

export function borrarMovimiento(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(coleccion(uid), id));
}
```

- [ ] **Step 7: `src/data/hooks.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import type { Categoria } from '../domain/categorias';
import type { Movimiento } from '../domain/movimientos';
import { escucharCategorias } from './categorias';
import { escucharMovimientosEntre } from './movimientos';
import { escucharPerfil, type Perfil } from './usuario';

interface Escucha<T> {
  datos: T;
  cargando: boolean;
}

/** Mantiene una suscripción de Firestore viva mientras `clave` no cambie. */
function useEscucha<T>(suscribir: (alCambiar: (datos: T) => void) => Unsubscribe, clave: string, inicial: T): Escucha<T> {
  const [estado, setEstado] = useState<Escucha<T>>({ datos: inicial, cargando: true });

  useEffect(() => {
    setEstado((previo) => ({ ...previo, cargando: true }));
    return suscribir((datos) => setEstado({ datos, cargando: false }));
    // `clave` resume todos los parámetros de `suscribir`.
  }, [clave]);

  return estado;
}

const SIN_DATOS: never[] = [];

export function usePerfil(uid: string): Escucha<Perfil | null> {
  return useEscucha<Perfil | null>((cb) => escucharPerfil(uid, cb), `perfil:${uid}`, null);
}

export function useCategorias(uid: string): Escucha<Categoria[]> {
  return useEscucha<Categoria[]>((cb) => escucharCategorias(uid, cb), `categorias:${uid}`, SIN_DATOS);
}

export function useMovimientosEntre(uid: string, desde: string, hasta: string): Escucha<Movimiento[]> {
  return useEscucha<Movimiento[]>(
    (cb) => escucharMovimientosEntre(uid, desde, hasta, cb),
    `movimientos:${uid}:${desde}:${hasta}`,
    SIN_DATOS,
  );
}
```

- [ ] **Step 8: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/vite-env.d.ts .env.emulador .env.example src/lib/firebase.ts src/data
git commit -m "feat: add firebase client and firestore data layer"
```

---

### Task 8: Componentes base de UI

**Files:**
- Create: `src/components/toastContexto.ts`, `src/components/ToastProvider.tsx`, `src/components/HojaInferior.tsx`, `src/components/MensajeError.tsx`, `src/components/BurbujaCategoria.tsx`, `src/components/SelectorTipo.tsx`, `src/components/FilaMovimiento.tsx`, `src/lib/useEnLinea.ts`

**Interfaces:**
- Consumes: `formatearMonto` (Task 2), `Categoria`, `TipoCategoria` (Task 4), `Movimiento` (Task 5).
- Produces:
  - `useToast(): { mostrar(mensaje: string, tipo?: 'exito' | 'error'): void }`, `<ToastProvider>`
  - `<HojaInferior abierta titulo onCerrar>{children}</HojaInferior>` (no monta `children` si está cerrada)
  - `<MensajeError mensaje?: string />`
  - `<BurbujaCategoria icono color grande? />`
  - `<SelectorTipo valor: TipoCategoria onCambio(t) />`
  - `<FilaMovimiento movimiento categoria? moneda onClick? />`
  - `useEnLinea(): boolean`

Componentes de presentación sin lógica de negocio; se verifican visualmente en las Tasks 9–13.

- [ ] **Step 1: Toast**

```ts
// src/components/toastContexto.ts
import { createContext, useContext } from 'react';

export type TipoToast = 'exito' | 'error';

export interface ContextoToast {
  mostrar: (mensaje: string, tipo?: TipoToast) => void;
}

export const ToastContext = createContext<ContextoToast>({ mostrar: () => {} });

export const useToast = () => useContext(ToastContext);
```

```tsx
// src/components/ToastProvider.tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type TipoToast } from './toastContexto';

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const mostrar = useCallback((mensaje: string, tipo: TipoToast = 'exito') => {
    setToast({ id: Date.now(), mensaje, tipo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const temporizador = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(temporizador);
  }, [toast]);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.tipo === 'error' ? 'bg-rose-600' : 'bg-slate-900'
          }`}
        >
          {toast.mensaje}
        </div>
      )}
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 2: Hoja inferior**

```tsx
// src/components/HojaInferior.tsx
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  abierta: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}

export function HojaInferior({ abierta, titulo, onCerrar, children }: Props) {
  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40" onClick={onCerrar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl animate-[subir_.2s_ease-out]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Piezas pequeñas**

```tsx
// src/components/MensajeError.tsx
export function MensajeError({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="mt-1 text-sm text-rose-600">{mensaje}</p> : null;
}
```

```tsx
// src/components/BurbujaCategoria.tsx
interface Props {
  icono: string;
  color: string;
  grande?: boolean;
}

export function BurbujaCategoria({ icono, color, grande = false }: Props) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${grande ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg'}`}
      style={{ backgroundColor: `${color}22` }}
      aria-hidden="true"
    >
      {icono}
    </span>
  );
}
```

```tsx
// src/components/SelectorTipo.tsx
import type { TipoCategoria } from '../domain/categorias';

const OPCIONES: { valor: TipoCategoria; etiqueta: string }[] = [
  { valor: 'gasto', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];

interface Props {
  valor: TipoCategoria;
  onCambio: (tipo: TipoCategoria) => void;
}

export function SelectorTipo({ valor, onCambio }: Props) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup">
      {OPCIONES.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambio(opcion.valor)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              activa
                ? opcion.valor === 'gasto'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
```

```tsx
// src/components/FilaMovimiento.tsx
import type { Categoria } from '../domain/categorias';
import { formatearMonto } from '../domain/dinero';
import type { Movimiento } from '../domain/movimientos';
import { BurbujaCategoria } from './BurbujaCategoria';

interface Props {
  movimiento: Movimiento;
  categoria?: Categoria;
  moneda: string;
  onClick?: () => void;
}

export function FilaMovimiento({ movimiento, categoria, moneda, onClick }: Props) {
  const esIngreso = movimiento.tipo === 'ingreso';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
    >
      <BurbujaCategoria icono={categoria?.icono ?? '❔'} color={categoria?.color ?? '#94a3b8'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-800">{categoria?.nombre ?? 'Sin categoría'}</span>
        {movimiento.nota && <span className="block truncate text-sm text-slate-500">{movimiento.nota}</span>}
      </span>
      <span className={`font-semibold tabular-nums ${esIngreso ? 'text-emerald-600' : 'text-slate-800'}`}>
        {esIngreso ? '+' : '−'}
        {formatearMonto(movimiento.monto, moneda)}
      </span>
    </button>
  );
}
```

```ts
// src/lib/useEnLinea.ts
import { useSyncExternalStore } from 'react';

function suscribir(alCambiar: () => void) {
  window.addEventListener('online', alCambiar);
  window.addEventListener('offline', alCambiar);
  return () => {
    window.removeEventListener('online', alCambiar);
    window.removeEventListener('offline', alCambiar);
  };
}

export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true);
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components src/lib/useEnLinea.ts
git commit -m "feat: add base ui components"
```

---

### Task 9: Autenticación, layout y rutas

**Files:**
- Create: `src/features/auth/contexto.ts`, `src/features/auth/AuthProvider.tsx`, `src/features/auth/acciones.ts`, `src/features/auth/LoginPage.tsx`, `src/components/BottomNav.tsx`, `src/components/Layout.tsx`, `src/features/inicio/InicioPage.tsx` (versión inicial)
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `auth`, `proveedorGoogle` (Task 7), `asegurarPerfil` (Task 7), `ToastProvider` (Task 8), `useEnLinea` (Task 8).
- Produces:
  - `useAuth(): { usuario: User | null; cargando: boolean }`
  - `useUsuario(): User` (lanza si no hay sesión; usar solo dentro de rutas protegidas)
  - `entrarConGoogle(): Promise<void>`, `salir(): Promise<void>`
  - `<Layout />` con `<Outlet />`; `<BottomNav onAgregar />`

- [ ] **Step 1: Contexto y acciones**

```ts
// src/features/auth/contexto.ts
import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface EstadoAuth {
  usuario: User | null;
  cargando: boolean;
}

export const AuthContext = createContext<EstadoAuth>({ usuario: null, cargando: true });

export const useAuth = () => useContext(AuthContext);

export function useUsuario(): User {
  const { usuario } = useAuth();
  if (!usuario) throw new Error('useUsuario se usó fuera de una ruta con sesión');
  return usuario;
}
```

```ts
// src/features/auth/acciones.ts
import { signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, proveedorGoogle } from '../../lib/firebase';

export async function entrarConGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, proveedorGoogle);
  } catch (error) {
    // Algunos navegadores móviles bloquean ventanas emergentes: se usa redirección.
    if ((error as { code?: string }).code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, proveedorGoogle);
      return;
    }
    throw error;
  }
}

export function salir(): Promise<void> {
  return signOut(auth);
}
```

- [ ] **Step 2: Proveedor**

```tsx
// src/features/auth/AuthProvider.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { asegurarPerfil } from '../../data/usuario';
import { auth } from '../../lib/firebase';
import { AuthContext, type EstadoAuth } from './contexto';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ usuario: null, cargando: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (usuario) => {
        if (usuario) {
          try {
            await asegurarPerfil(usuario);
          } catch (error) {
            console.error('No se pudo preparar el perfil', error);
          }
        }
        setEstado({ usuario, cargando: false });
      }),
    [],
  );

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 3: Pantalla de login**

```tsx
// src/features/auth/LoginPage.tsx
import { useState } from 'react';
import { entrarConGoogle } from './acciones';

const CANCELADO = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

export function LoginPage() {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setEntrando(true);
    setError(null);
    try {
      await entrarConGoogle();
    } catch (e) {
      if (!CANCELADO.includes((e as { code?: string }).code ?? '')) {
        setError('No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50 px-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-4xl shadow-lg shadow-emerald-500/30">
        🐷
      </div>
      <h1 className="text-3xl font-bold text-slate-900">Mis finanzas</h1>
      <p className="mt-2 text-slate-500">Tus gastos, ingresos y metas, en un solo lugar.</p>
      <button
        type="button"
        onClick={entrar}
        disabled={entrando}
        className="mt-10 flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 font-semibold text-slate-700 shadow-md ring-1 ring-slate-200 transition active:scale-[.98] disabled:opacity-60"
      >
        <LogoGoogle />
        {entrando ? 'Entrando…' : 'Entrar con Google'}
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
```

- [ ] **Step 4: Navegación inferior y layout**

```tsx
// src/components/BottomNav.tsx
import { NavLink } from 'react-router';
import { House, ListOrdered, Plus } from 'lucide-react';

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`;

export function BottomNav({ onAgregar }: { onAgregar: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end border-t border-slate-200 bg-white px-6 pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" end className={claseEnlace}>
        <House size={22} />
        Inicio
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onAgregar}
          aria-label="Registrar movimiento"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition active:scale-95"
        >
          <Plus size={28} />
        </button>
      </div>
      <NavLink to="/movimientos" className={claseEnlace}>
        <ListOrdered size={22} />
        Movimientos
      </NavLink>
    </nav>
  );
}
```

```tsx
// src/components/Layout.tsx
import { Link, Outlet } from 'react-router';
import { CloudOff, UserRound } from 'lucide-react';
import { useUsuario } from '../features/auth/contexto';
import { useEnLinea } from '../lib/useEnLinea';
import { BottomNav } from './BottomNav';

export function Layout() {
  const usuario = useUsuario();
  const enLinea = useEnLinea();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-50/90 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-bold text-slate-900">Mis finanzas</h1>
        <div className="flex items-center gap-2">
          {!enLinea && (
            <span
              title="Sin conexión: tus cambios se guardan y se sincronizan después"
              className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              <CloudOff size={14} />
              Sin conexión
            </span>
          )}
          <Link to="/ajustes" aria-label="Ajustes">
            {usuario.photoURL ? (
              <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <UserRound size={18} />
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-5 pb-28">
        <Outlet />
      </main>
      <BottomNav onAgregar={() => {}} />
    </div>
  );
}
```

- [ ] **Step 5: Inicio provisional, App y main**

```tsx
// src/features/inicio/InicioPage.tsx  (se reemplaza en la Task 12)
import { useUsuario } from '../auth/contexto';

export function InicioPage() {
  const usuario = useUsuario();
  return <p className="text-slate-500">Hola, {usuario.displayName?.split(' ')[0] ?? ''} 👋</p>;
}
```

```tsx
// src/App.tsx
import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { useAuth } from './features/auth/contexto';
import { InicioPage } from './features/inicio/InicioPage';

export default function App() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="flex min-h-dvh animate-pulse items-center justify-center text-5xl">🐷</div>;
  }
  if (!usuario) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<InicioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { ToastProvider } from './components/ToastProvider';
import { AuthProvider } from './features/auth/AuthProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 6: Verificar con emuladores**

Run: `npm run typecheck`
Expected: sin errores.

Terminal 1: `npm run emuladores` · Terminal 2: `npm run dev:emu` · Abrir http://localhost:5173 en vista móvil (DevTools, 390 px).

Checklist:
- Aparece la pantalla de login con el cerdito y "Entrar con Google".
- Al tocar el botón, el emulador abre su selector de cuentas → "Add new account" → autocompletar → entra.
- Se ve el encabezado "Mis finanzas", el saludo y la barra inferior con Inicio, botón + y Movimientos.
- En http://localhost:4000 (Emulator UI) → Firestore: existe `users/{uid}` con `moneda: COP`, `diasPago: [15, 30]` y 14 documentos en `categorias`.
- En DevTools → Network → "Offline": aparece la etiqueta "Sin conexión" en el encabezado.
- Recargar la página: sigue con sesión y no se duplican categorías.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add google sign-in, app layout and routing"
```

---

### Task 10: Registro rápido (crear, editar y borrar movimientos)

**Files:**
- Create: `src/features/movimientos/RegistroRapido.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `parsearMonto`, `agruparMiles` (Task 2); `fechaLocalISO` (Task 3); `categoriasActivas` (Task 4); `validarMovimiento`, `normalizarMovimiento`, tipos (Task 5); `crearMovimiento`, `actualizarMovimiento`, `borrarMovimiento`, `useCategorias` (Task 7); `HojaInferior`, `SelectorTipo`, `BurbujaCategoria`, `MensajeError`, `useToast` (Task 8); `useUsuario` (Task 9).
- Produces: `<RegistroRapido abierta: boolean onCerrar: () => void movimiento?: Movimiento />`

- [ ] **Step 1: Crear `RegistroRapido.tsx`**

```tsx
// src/features/movimientos/RegistroRapido.tsx
import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { MensajeError } from '../../components/MensajeError';
import { SelectorTipo } from '../../components/SelectorTipo';
import { useToast } from '../../components/toastContexto';
import { useCategorias } from '../../data/hooks';
import { actualizarMovimiento, borrarMovimiento, crearMovimiento } from '../../data/movimientos';
import { categoriasActivas } from '../../domain/categorias';
import { agruparMiles, parsearMonto } from '../../domain/dinero';
import { fechaLocalISO } from '../../domain/fechas';
import {
  MAX_NOTA,
  normalizarMovimiento,
  validarMovimiento,
  type ErroresMovimiento,
  type Movimiento,
  type TipoMovimiento,
} from '../../domain/movimientos';
import { useUsuario } from '../auth/contexto';

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  movimiento?: Movimiento;
}

export function RegistroRapido({ abierta, onCerrar, movimiento }: Props) {
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'}>
      <FormularioMovimiento key={movimiento?.id ?? 'nuevo'} movimiento={movimiento} onListo={onCerrar} />
    </HojaInferior>
  );
}

function FormularioMovimiento({ movimiento, onListo }: { movimiento?: Movimiento; onListo: () => void }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: categorias } = useCategorias(usuario.uid);

  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? 'gasto');
  const [montoTexto, setMontoTexto] = useState(movimiento ? agruparMiles(String(movimiento.monto)) : '');
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoriaId ?? '');
  const [fecha, setFecha] = useState(movimiento?.fecha ?? fechaLocalISO());
  const [nota, setNota] = useState(movimiento?.nota ?? '');
  const [errores, setErrores] = useState<ErroresMovimiento>({});

  // Al editar, la categoría actual se muestra aunque esté archivada.
  const actual = categorias.find((c) => c.id === categoriaId);
  const opciones = categoriasActivas(categorias, tipo);
  if (actual?.archivada && actual.tipo === tipo) opciones.push(actual);

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo);
    setCategoriaId('');
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    const formulario = { tipo, monto: parsearMonto(montoTexto), categoriaId, fecha, nota };
    const encontrados = validarMovimiento(formulario);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarMovimiento(formulario);
    const operacion = movimiento
      ? actualizarMovimiento(usuario.uid, movimiento.id, datos)
      : crearMovimiento(usuario.uid, datos);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar el movimiento', 'error'));
    mostrar(movimiento ? 'Movimiento actualizado' : 'Movimiento guardado');
    onListo();
  }

  function borrar() {
    if (!movimiento || !window.confirm('¿Borrar este movimiento?')) return;
    borrarMovimiento(usuario.uid, movimiento.id).catch(() => mostrar('No se pudo borrar el movimiento', 'error'));
    mostrar('Movimiento borrado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <SelectorTipo valor={tipo} onCambio={cambiarTipo} />

      <div>
        <label htmlFor="monto" className="sr-only">
          Monto
        </label>
        <div className="flex items-baseline justify-center gap-1 border-b-2 border-slate-200 pb-2 focus-within:border-emerald-500">
          <span className="text-3xl font-semibold text-slate-400">$</span>
          <input
            id="monto"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(agruparMiles(e.target.value))}
            className="w-full min-w-0 bg-transparent text-center text-4xl font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
          />
        </div>
        <MensajeError mensaje={errores.monto} />
      </div>

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

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
          <MensajeError mensaje={errores.fecha} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Nota</span>
          <input
            value={nota}
            maxLength={MAX_NOTA}
            placeholder="Opcional"
            onChange={(e) => setNota(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
          <MensajeError mensaje={errores.nota} />
        </label>
      </div>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {movimiento && (
        <button
          type="button"
          onClick={borrar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={18} />
          Borrar movimiento
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Conectar el botón + en `Layout.tsx`**

Reemplazar el contenido completo de `src/components/Layout.tsx`:

```tsx
// src/components/Layout.tsx
import { useCallback, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { CloudOff, UserRound } from 'lucide-react';
import { useUsuario } from '../features/auth/contexto';
import { RegistroRapido } from '../features/movimientos/RegistroRapido';
import { useEnLinea } from '../lib/useEnLinea';
import { BottomNav } from './BottomNav';

export function Layout() {
  const usuario = useUsuario();
  const enLinea = useEnLinea();
  const [registroAbierto, setRegistroAbierto] = useState(false);
  const cerrarRegistro = useCallback(() => setRegistroAbierto(false), []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-50/90 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-bold text-slate-900">Mis finanzas</h1>
        <div className="flex items-center gap-2">
          {!enLinea && (
            <span
              title="Sin conexión: tus cambios se guardan y se sincronizan después"
              className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              <CloudOff size={14} />
              Sin conexión
            </span>
          )}
          <Link to="/ajustes" aria-label="Ajustes">
            {usuario.photoURL ? (
              <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <UserRound size={18} />
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-5 pb-28">
        <Outlet />
      </main>
      <BottomNav onAgregar={() => setRegistroAbierto(true)} />
      <RegistroRapido abierta={registroAbierto} onCerrar={cerrarRegistro} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar con emuladores**

Run: `npm run typecheck`
Expected: sin errores.

Con `npm run emuladores` y `npm run dev:emu` corriendo, en vista móvil:
- Tocar **+** → se abre la hoja con "Gasto" activo, cursor en el monto y el teclado numérico.
- Escribir `1500000` → se muestra `1.500.000`.
- Tocar **Guardar** sin categoría → "Elige una categoría".
- Elegir Comida y Guardar → toast "Movimiento guardado", la hoja se cierra y en Emulator UI aparece el documento con `monto: 1500000` (entero), `fecha` de hoy y **sin** campo `nota`.
- Cambiar a "Ingreso" → solo aparecen Salario, Extra y Otros.
- **Review Focus 5 — sin conexión:** detener el emulador (Ctrl+C en la terminal 1), registrar un gasto → la hoja se cierra al instante con el toast. Volver a iniciar el emulador no recupera ese gasto (el emulador perdió los datos), pero lo importante aquí es que la UI no se quedó colgada.

- [ ] **Step 4: Commit**

```bash
git add src/features/movimientos/RegistroRapido.tsx src/components/Layout.tsx
git commit -m "feat: add quick movement entry sheet"
```

---

### Task 11: Pantalla de movimientos (por mes, con filtro y edición)

**Files:**
- Create: `src/components/TarjetaResumen.tsx`, `src/features/movimientos/MovimientosPage.tsx`
- Modify: `src/App.tsx` (agregar ruta)

**Interfaces:**
- Consumes: `formatearMonto` (Task 2); `etiquetaFecha`, `mesActual`, `desplazarMes`, `rangoMes`, `nombreMes`, `MesAnio` (Task 3); `categoriasActivas` (Task 4); `sumarPorTipo`, `agruparPorFecha` (Task 5); hooks (Task 7); `FilaMovimiento` (Task 8); `RegistroRapido` (Task 10).
- Produces: ruta `/movimientos`; `<TarjetaResumen etiqueta valor colorValor />`.

- [ ] **Step 1: `TarjetaResumen.tsx`**

```tsx
// src/components/TarjetaResumen.tsx
interface Props {
  etiqueta: string;
  valor: string;
  colorValor: string;
}

export function TarjetaResumen({ etiqueta, valor, colorValor }: Props) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colorValor}`}>{valor}</p>
    </div>
  );
}
```

- [ ] **Step 2: `MovimientosPage.tsx`**

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
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from './RegistroRapido';

export function MovimientosPage() {
  const usuario = useUsuario();
  const [mes, setMes] = useState<MesAnio>(() => mesActual());
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const { desde, hasta } = rangoMes(mes.anio, mes.mes);
  const { datos: movimientos, cargando } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const filtrados = categoriaFiltro ? movimientos.filter((m) => m.categoriaId === categoriaFiltro) : movimientos;
  const totales = sumarPorTipo(filtrados);
  const grupos = agruparPorFecha(filtrados);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 shadow-sm">
        <button type="button" aria-label="Mes anterior" onClick={() => setMes((m) => desplazarMes(m, -1))} className="rounded-full p-2 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-slate-900">{nombreMes(mes.anio, mes.mes)}</span>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMes((m) => desplazarMes(m, 1))} className="rounded-full p-2 hover:bg-slate-100">
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
      </select>

      <div className="grid grid-cols-2 gap-3">
        <TarjetaResumen etiqueta="Ingresos" valor={formatearMonto(totales.ingresos, moneda)} colorValor="text-emerald-600" />
        <TarjetaResumen etiqueta="Gastos" valor={formatearMonto(totales.gastos, moneda)} colorValor="text-rose-600" />
      </div>

      {cargando ? (
        <p className="py-10 text-center text-slate-400">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="py-10 text-center text-slate-400">No hay movimientos en este mes.</p>
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

- [ ] **Step 3: Agregar la ruta en `src/App.tsx`**

Agregar el import:

```tsx
import { MovimientosPage } from './features/movimientos/MovimientosPage';
```

y la ruta, justo después de `<Route index element={<InicioPage />} />`:

```tsx
        <Route path="movimientos" element={<MovimientosPage />} />
```

- [ ] **Step 4: Verificar con emuladores**

Run: `npm run typecheck`
Expected: sin errores.

Checklist:
- Registrar 3 movimientos: gasto de hoy, gasto de ayer (cambiando la fecha), ingreso de hoy.
- En Movimientos: grupos "Hoy" y "Ayer", con Hoy arriba; tarjetas de Ingresos y Gastos correctas.
- Filtrar por Comida → solo esos movimientos y los totales cambian.
- Mes anterior → "No hay movimientos en este mes."; volver al mes actual.
- Tocar un movimiento → se abre "Editar movimiento" con los datos cargados; cambiar el monto y guardar → se actualiza la lista.
- **Review Focus 4:** editar un movimiento con nota, borrar la nota y guardar → en Emulator UI el documento ya no tiene campo `nota`.
- Borrar un movimiento → confirma y desaparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/TarjetaResumen.tsx src/features/movimientos/MovimientosPage.tsx src/App.tsx
git commit -m "feat: add monthly movements list with filters and editing"
```

---

### Task 12: Pantalla de inicio

**Files:**
- Modify: `src/features/inicio/InicioPage.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `formatearMonto` (Task 2); `mesActual`, `rangoMes`, `nombreMes` (Task 3); `sumarPorTipo` (Task 5); hooks (Task 7); `FilaMovimiento` (Task 8); `RegistroRapido` (Task 10).

En esta fase el Inicio muestra el balance del **mes**; la tarjeta por quincena llega en la fase 2.

- [ ] **Step 1: Reemplazar `InicioPage.tsx`**

```tsx
// src/features/inicio/InicioPage.tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { useCategorias, useMovimientosEntre, usePerfil } from '../../data/hooks';
import { formatearMonto } from '../../domain/dinero';
import { mesActual, nombreMes, rangoMes } from '../../domain/fechas';
import { sumarPorTipo, type Movimiento } from '../../domain/movimientos';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido } from '../movimientos/RegistroRapido';

const CANTIDAD_ULTIMOS = 5;

export function InicioPage() {
  const usuario = useUsuario();
  const [editando, setEditando] = useState<Movimiento | undefined>();

  const mes = mesActual();
  const { desde, hasta } = rangoMes(mes.anio, mes.mes);
  const { datos: movimientos, cargando } = useMovimientosEntre(usuario.uid, desde, hasta);
  const { datos: categorias } = useCategorias(usuario.uid);
  const { datos: perfil } = usePerfil(usuario.uid);
  const moneda = perfil?.moneda ?? 'COP';

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const totales = sumarPorTipo(movimientos);
  const balance = totales.ingresos - totales.gastos;
  const ultimos = movimientos.slice(0, CANTIDAD_ULTIMOS);
  const nombre = (perfil?.nombre || usuario.displayName || '').split(' ')[0];

  return (
    <div className="space-y-5">
      <p className="text-slate-500">Hola{nombre ? `, ${nombre}` : ''} 👋</p>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-sm opacity-80">Balance de {nombreMes(mes.anio, mes.mes).toLowerCase()}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatearMonto(balance, moneda)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="opacity-80">Ingresos</p>
            <p className="font-semibold tabular-nums">{formatearMonto(totales.ingresos, moneda)}</p>
          </div>
          <div>
            <p className="opacity-80">Gastos</p>
            <p className="font-semibold tabular-nums">{formatearMonto(totales.gastos, moneda)}</p>
          </div>
        </div>
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
            Aún no tienes movimientos este mes.
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

- [ ] **Step 2: Verificar con emuladores**

Run: `npm run typecheck`
Expected: sin errores.

Checklist:
- Usuario nuevo: tarjeta verde con `$ 0` y mensaje "Aún no tienes movimientos este mes".
- Registrar ingreso de 2.000.000 y gasto de 50.000 → balance `$ 1.950.000`, sin recargar.
- Con más de 5 movimientos se muestran solo 5; "Ver todos" lleva a Movimientos.
- Tocar un movimiento abre la edición.

- [ ] **Step 3: Commit**

```bash
git add src/features/inicio/InicioPage.tsx
git commit -m "feat: add home screen with monthly balance"
```

---

### Task 13: Ajustes y gestión de categorías

**Files:**
- Create: `src/features/ajustes/AjustesPage.tsx`, `src/features/ajustes/CategoriasPage.tsx`, `src/features/ajustes/FormularioCategoria.tsx`
- Modify: `src/App.tsx` (agregar rutas)

**Interfaces:**
- Consumes: `categoriasActivas`, `validarNombreCategoria`, `siguienteOrden`, `ICONOS_DISPONIBLES`, `COLORES_DISPONIBLES`, tipos (Task 4); `crearCategoria`, `actualizarCategoria`, `useCategorias` (Task 7); `HojaInferior`, `SelectorTipo`, `BurbujaCategoria`, `MensajeError`, `useToast` (Task 8); `useUsuario`, `salir` (Task 9).
- Produces: rutas `/ajustes` y `/ajustes/categorias`.

- [ ] **Step 1: `FormularioCategoria.tsx`**

```tsx
// src/features/ajustes/FormularioCategoria.tsx
import { useState, type FormEvent } from 'react';
import { Archive } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { MensajeError } from '../../components/MensajeError';
import { useToast } from '../../components/toastContexto';
import { actualizarCategoria, crearCategoria } from '../../data/categorias';
import {
  COLORES_DISPONIBLES,
  ICONOS_DISPONIBLES,
  siguienteOrden,
  validarNombreCategoria,
  type Categoria,
  type TipoCategoria,
} from '../../domain/categorias';
import { useUsuario } from '../auth/contexto';

interface Props {
  categoria?: Categoria;
  tipo: TipoCategoria;
  todas: readonly Categoria[];
  onListo: () => void;
}

export function FormularioCategoria({ categoria, tipo, todas, onListo }: Props) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [icono, setIcono] = useState(categoria?.icono ?? ICONOS_DISPONIBLES[0]);
  const [color, setColor] = useState(categoria?.color ?? COLORES_DISPONIBLES[0]);
  const [error, setError] = useState<string | null>(null);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const problema = validarNombreCategoria(nombre, todas, tipo, categoria?.id);
    setError(problema);
    if (problema) return;

    const limpio = nombre.trim();
    const operacion = categoria
      ? actualizarCategoria(usuario.uid, categoria.id, { nombre: limpio, icono, color })
      : crearCategoria(usuario.uid, {
          nombre: limpio,
          icono,
          color,
          tipo,
          orden: siguienteOrden(todas, tipo),
          sistema: false,
          archivada: false,
        });
    operacion.catch(() => mostrar('No se pudo guardar la categoría', 'error'));
    mostrar(categoria ? 'Categoría actualizada' : 'Categoría creada');
    onListo();
  }

  function archivar() {
    if (!categoria) return;
    actualizarCategoria(usuario.uid, categoria.id, { archivada: true }).catch(() =>
      mostrar('No se pudo archivar la categoría', 'error'),
    );
    mostrar('Categoría archivada');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <div>
        <div className="flex items-center gap-3">
          <BurbujaCategoria icono={icono} color={color} grande />
          <input
            aria-label="Nombre de la categoría"
            autoFocus
            value={nombre}
            maxLength={40}
            placeholder="Nombre"
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg"
          />
        </div>
        <MensajeError mensaje={error ?? undefined} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">Ícono</legend>
        <div className="grid grid-cols-7 gap-2">
          {ICONOS_DISPONIBLES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={opcion === icono}
              onClick={() => setIcono(opcion)}
              className={`flex h-10 items-center justify-center rounded-xl text-xl ${
                opcion === icono ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-slate-100'
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">Color</legend>
        <div className="grid grid-cols-8 gap-2">
          {COLORES_DISPONIBLES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-label={`Color ${opcion}`}
              aria-pressed={opcion === color}
              onClick={() => setColor(opcion)}
              className={`h-8 w-8 rounded-full ${opcion === color ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
              style={{ backgroundColor: opcion }}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {categoria && !categoria.sistema && (
        <button
          type="button"
          onClick={archivar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-slate-500 hover:bg-slate-100"
        >
          <Archive size={18} />
          Archivar
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 2: `CategoriasPage.tsx`**

```tsx
// src/features/ajustes/CategoriasPage.tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { ArchiveRestore, ChevronLeft, Pencil } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { SelectorTipo } from '../../components/SelectorTipo';
import { useToast } from '../../components/toastContexto';
import { actualizarCategoria } from '../../data/categorias';
import { useCategorias } from '../../data/hooks';
import { categoriasActivas, type Categoria, type TipoCategoria } from '../../domain/categorias';
import { useUsuario } from '../auth/contexto';
import { FormularioCategoria } from './FormularioCategoria';

export function CategoriasPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: categorias } = useCategorias(usuario.uid);
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);

  const activas = categoriasActivas(categorias, tipo);
  const archivadas = categorias.filter((c) => c.tipo === tipo && c.archivada);

  function restaurar(categoria: Categoria) {
    actualizarCategoria(usuario.uid, categoria.id, { archivada: false }).catch(() =>
      mostrar('No se pudo restaurar la categoría', 'error'),
    );
    mostrar('Categoría restaurada');
  }

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Categorías</h2>

      <SelectorTipo valor={tipo} onCambio={setTipo} />

      <ul className="rounded-2xl bg-white p-1 shadow-sm">
        {activas.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEditando(c)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
            >
              <BurbujaCategoria icono={c.icono} color={c.color} />
              <span className="flex-1 font-medium text-slate-800">{c.nombre}</span>
              {c.sistema && <span className="text-xs text-slate-400">Sistema</span>}
              <Pencil size={16} className="text-slate-400" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setEditando('nueva')}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nueva categoría
      </button>

      {archivadas.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-sm font-medium text-slate-500">Archivadas</h3>
          <ul className="rounded-2xl bg-white p-1 shadow-sm">
            {archivadas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                <BurbujaCategoria icono={c.icono} color={c.color} />
                <span className="flex-1 text-slate-500">{c.nombre}</span>
                <button
                  type="button"
                  onClick={() => restaurar(c)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                >
                  <ArchiveRestore size={16} />
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HojaInferior
        abierta={editando !== null}
        titulo={editando === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
        onCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioCategoria
            key={editando === 'nueva' ? 'nueva' : editando.id}
            categoria={editando === 'nueva' ? undefined : editando}
            tipo={tipo}
            todas={categorias}
            onListo={() => setEditando(null)}
          />
        )}
      </HojaInferior>
    </div>
  );
}
```

- [ ] **Step 3: `AjustesPage.tsx`**

```tsx
// src/features/ajustes/AjustesPage.tsx
import { Link } from 'react-router';
import { ChevronRight, LogOut, Tags, UserRound } from 'lucide-react';
import { useToast } from '../../components/toastContexto';
import { salir } from '../auth/acciones';
import { useUsuario } from '../auth/contexto';

export function AjustesPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        {usuario.photoURL ? (
          <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound size={22} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{usuario.displayName ?? 'Sin nombre'}</p>
          <p className="truncate text-sm text-slate-500">{usuario.email}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-1 shadow-sm">
        <Link to="/ajustes/categorias" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <Tags size={20} className="text-emerald-600" />
          <span className="flex-1 font-medium text-slate-800">Categorías</span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => salir().catch(() => mostrar('No se pudo cerrar sesión', 'error'))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-4 font-medium text-rose-600 shadow-sm hover:bg-rose-50"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Agregar rutas en `src/App.tsx`**

Agregar los imports:

```tsx
import { AjustesPage } from './features/ajustes/AjustesPage';
import { CategoriasPage } from './features/ajustes/CategoriasPage';
```

y las rutas, justo después de la ruta `movimientos`:

```tsx
        <Route path="ajustes" element={<AjustesPage />} />
        <Route path="ajustes/categorias" element={<CategoriasPage />} />
```

- [ ] **Step 5: Verificar con emuladores**

Run: `npm run typecheck && npm test`
Expected: sin errores; todas las pruebas de domain pasan.

Checklist:
- Tocar la foto o el ícono de perfil → Ajustes con nombre y correo.
- Categorías → 11 de gasto ordenadas; Ahorro y Deudas con la etiqueta "Sistema".
- Nueva categoría "Mascotas" 🐶 → aparece al final y en el registro rápido.
- Crear "comida" → "Ya existe una categoría con ese nombre".
- Editar Ahorro → no se muestra el botón "Archivar".
- Archivar Mascotas → pasa a "Archivadas"; ya no sale en el registro rápido; un movimiento viejo con Mascotas sigue mostrando su ícono y nombre en Movimientos. Restaurar → vuelve.
- Cerrar sesión → pantalla de login.
- Entrar con **otra** cuenta del emulador → no ve los movimientos ni categorías de la primera.

- [ ] **Step 6: Commit**

```bash
git add src/features/ajustes src/App.tsx
git commit -m "feat: add settings and category management"
```

---

### Task 14: Conectar el proyecto Firebase real y probar en el celular

**Files:**
- Create: `.env.local` (no se versiona), `.firebaserc`

Esta tarea requiere acciones de la usuaria en la consola web y comandos interactivos. El agente guía paso a paso y **pide permiso antes de cada `firebase deploy`**.

- [ ] **Step 1 (usuaria): Crear el proyecto en https://console.firebase.google.com**
  1. "Crear un proyecto" → nombre `app-finanzas` → desactivar Google Analytics → Crear.
  2. Compilación → **Authentication** → Comenzar → Proveedores de acceso → **Google** → Habilitar → correo de asistencia `legardajuly@gmail.com` → Guardar.
  3. Compilación → **Firestore Database** → Crear base de datos → ubicación `southamerica-east1 (São Paulo)` → **modo de producción** → Crear.
  4. Configuración del proyecto (⚙️) → Tus apps → ícono **Web `</>`** → apodo `app-finanzas-web` → sin marcar Hosting → Registrar → copiar los valores de `firebaseConfig`.

- [ ] **Step 2: Crear `.env.local`** con los valores copiados

```
VITE_FIREBASE_API_KEY=<apiKey>
VITE_FIREBASE_AUTH_DOMAIN=<projectId>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<projectId>
VITE_FIREBASE_APP_ID=<appId>
```

Verificar que no se versiona: `git check-ignore .env.local` → imprime `.env.local`.

- [ ] **Step 3 (usuaria): Iniciar sesión en Firebase CLI**

La usuaria ejecuta en el prompt: `! npx firebase login` y luego `! npx firebase use --add` → elige el proyecto → alias `default`. Esto crea `.firebaserc`.

- [ ] **Step 4: Publicar las reglas** (pedir permiso)

Run: `npx firebase deploy --only firestore:rules`
Expected: `Deploy complete!`. En la consola → Firestore → Reglas se ven las reglas de `firestore.rules`.

- [ ] **Step 5: Probar en el PC contra el proyecto real**

Run: `npm run dev` → http://localhost:5173 → Entrar con Google (cuenta real) → registrar un gasto.
Expected: en la consola → Firestore aparece `users/{uid}` con sus 14 categorías y el movimiento.

- [ ] **Step 6: Publicar en Firebase Hosting para probar en el celular** (pedir permiso)

Run: `npm run build && npx firebase deploy --only hosting`
Expected: `Hosting URL: https://<projectId>.web.app`.

En el celular: abrir esa URL → entrar con Google → registrar un gasto → abrir la misma URL en el PC → aparece el gasto. (Instalarla en la pantalla de inicio llega con la PWA en la fase 6; mientras tanto se puede usar "Agregar a pantalla de inicio" del navegador como acceso directo.)

- [ ] **Step 7: Commit**

```bash
git add .firebaserc
git commit -m "chore: link firebase project"
```
