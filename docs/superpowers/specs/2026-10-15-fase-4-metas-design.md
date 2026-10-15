# Fase 4 — Metas de ahorro — Diseño

Fecha: 2026-10-15
Base: `2026-10-06-app-finanzas-design.md` (§4.4, §5, §6) y fase 3 (`2026-10-14-fase-3-gastos-fijos-design.md`). Este documento **reemplaza** el modelo de metas del spec base donde difieren (ver §9).

## 1. Objetivo

Que la usuaria cree metas de ahorro, vea su progreso, abone y retire dinero, y que la cuota de cada meta aparezca como pendiente de la quincena (y sume al comprometido), igual que los gastos fijos.

Criterios de éxito:
- Crear, editar y archivar metas en modo **por fecha** o **por cuota**, con ahorro inicial opcional.
- Pantalla Metas con progreso, cuota o fecha estimada, y botones Abonar / Retirar.
- En Inicio, las cuotas de metas son pendientes de la quincena junto a los fijos.
- Abonar baja el Disponible (gasto "Ahorro"); retirar lo devuelve (ingreso "Retiro de ahorro").
- Lo ahorrado siempre coincide con los movimientos: editar o borrar un abono/retiro corrige la meta.
- Reemplazar el cerdito 🐷 por la ardilla 🐿️ en toda la app.

## 2. Conceptos

- **Ahorrado** (calculado, no guardado) = `ahorroInicial` + Σ abonos − Σ retiros.
  - Abono: movimiento `tipo: 'gasto'` con `origen: { tipo: 'meta', id }`.
  - Retiro: movimiento `tipo: 'ingreso'` con `origen: { tipo: 'meta', id }`.
- **Ahorro inicial**: dinero que ya existía antes de la meta; no genera movimiento ni afecta el Disponible.
- **Cumplida**: `ahorrado >= objetivo`.
- **Activa**: no archivada y no cumplida. Solo las activas generan pendiente.
- **Cuota de la quincena** (se calcula con lo ahorrado **al inicio** de la quincena, es decir, sin contar movimientos de la quincena actual, para que no cambie al abonar):
  - Modo cuota: `min(cuotaQuincenal, faltante)`.
  - Modo fecha: `ceil(faltante / quincenasRestantes)`, donde `quincenasRestantes` cuenta desde la quincena actual (incluida) hasta la que contiene `fechaObjetivo` (incluida). Si `fechaObjetivo` ya pasó, `quincenasRestantes = 1` (toca todo el faltante).
  - `faltante = max(0, objetivo − ahorradoAlInicio)`.
- **Fecha estimada** (modo cuota): fin (`hasta`) de la quincena número `ceil(faltante / cuotaQuincenal)` contando la actual como 1. Sin faltante → meta cumplida, no hay fecha.
- **Pendiente de meta**: planeado = cuota de la quincena; pagado si hay abonos (gastos con origen esa meta) en la quincena, con monto = su suma. Los retiros no cuentan como pago.

## 3. Alcance

Incluye: colección `metas` y reglas; categoría de sistema "Retiro de ahorro"; dominio de metas; pantalla Metas; Abonar/Retirar con el registro rápido; pendientes de metas en Inicio; barra inferior; cambio de 🐷 a 🐿️.

Fuera de alcance: deudas (fase 5); historial por meta dentro de la tarjeta (se ve en Movimientos); notificaciones de metas; borrar metas.

## 4. Modelo de datos

```
users/{uid}/metas/{id}
  nombre: string (1–40)
  icono: string
  color: string
  objetivo: int > 0
  ahorroInicial: int ≥ 0
  modo: 'fecha' | 'cuota'
  fechaObjetivo?: 'YYYY-MM-DD'   // obligatoria si modo == 'fecha'; ausente si 'cuota'
  cuotaQuincenal?: int > 0       // obligatoria si modo == 'cuota'; ausente si 'fecha'
  archivada: bool
  creadoEn: timestamp
```

Categoría de sistema nueva: `categorias/retiro-ahorro` = `{ nombre: 'Retiro de ahorro', icono: '💸', color: '#10b981', tipo: 'ingreso', orden: 3, sistema: true, archivada: false }`.
- Se incluye en `CATEGORIAS_POR_DEFECTO` para cuentas nuevas.
- Para cuentas existentes, `asegurarPerfil` la crea si falta (cuando el perfil ya existe).

Movimientos: sin cambios de forma.

## 5. Reglas de seguridad

- `metas/{id}`: dueña lee, crea y actualiza con validación completa; **no** se puede borrar.
  - `nombre` 1–40, `icono` y `color` string, `objetivo` int > 0, `ahorroInicial` int ≥ 0, `archivada` bool.
  - `modo == 'fecha'` ⇒ `fechaObjetivo` con formato `YYYY-MM-DD` y sin `cuotaQuincenal`.
  - `modo == 'cuota'` ⇒ `cuotaQuincenal` int > 0 y sin `fechaObjetivo`.
- `movimientos`: un movimiento con `origen` debe ser gasto, **excepto** `origen.tipo == 'meta'`, que puede ser gasto o ingreso. `origen` sigue siendo inmutable al editar.
- La validación de "fecha futura" al crear es solo del cliente (las reglas no conocen la fecha local).

## 6. Dominio

### 6.1 `src/domain/metas.ts` (nuevo, TDD)
- Tipos: `DatosMeta`, `Meta`, `FormularioMeta`, `ErroresMeta`.
- `validarMeta(formulario, hoy)`: nombre 1–40; objetivo > 0; ahorro inicial ≥ 0 y menor que el objetivo; modo fecha → fecha posterior a hoy (solo al crear); modo cuota → cuota > 0.
- `normalizarMeta(formulario)`: deja solo el campo de su modo.
- `ahorrado(meta, movimientos)`, `progreso(meta, ahorrado)` (0–100), `cumplida(meta, ahorrado)`.
- `cuotaDeQuincena(meta, ahorradoAlInicio, quincena, diasPago)`.
- `fechaEstimada(meta, ahorradoAlInicio, quincena, diasPago)`: `'YYYY-MM-DD' | null`.
- `pendientesDeMetas(metas, quincena, diasPago, movimientosDeMetas)` → `Pendiente[]` (mismo tipo que fijos).
  - `movimientosDeMetas`: todos los movimientos con `origen.tipo == 'meta'`, de cualquier fecha; la función separa los de la quincena (por `fecha` entre `desde` y `hasta`) de los anteriores.

### 6.2 `src/domain/fijos.ts` (cambios)
- `Pendiente.origen` pasa a `{ tipo: 'fijo' | 'meta'; id: string }`. Se agrega `icono?: string; color?: string` (las metas no tienen categoría propia para mostrar).
- Orden combinado de pendientes de Inicio: pendientes sin pagar primero, luego pagados; dentro de cada grupo por nombre (misma regla que hoy).
- `comprometido` no cambia.

### 6.3 `src/domain/categorias.ts`
- 🐷 → 🐿️ en "Ahorro" y en `ICONOS_DISPONIBLES`.
- Nueva categoría "Retiro de ahorro" (ver §4).

## 7. Capa de datos

- `src/data/metas.ts`: `escucharMetas`, `crearMeta`, `actualizarMeta` (borra con `deleteField` el campo que no corresponde al modo).
- `src/data/movimientos.ts`: `escucharMovimientosDeMetas(uid, …)` = consulta `where('origen.tipo', '==', 'meta')`.
- `src/data/hooks.ts`: `useMetas`, `useMovimientosDeMetas`.
- `src/data/usuario.ts`: `asegurarPerfil` crea `retiro-ahorro` si el perfil existe y la categoría no.

## 8. Pantallas

### 8.1 Barra inferior
Inicio · Metas · (+) · Movimientos. (Deudas se agrega en la fase 5.)

### 8.2 Metas (`/metas`)
- Tarjeta por meta activa: ícono, nombre, barra de progreso, "$ahorrado de $objetivo (N %)".
  - Modo cuota: "Cuota: $X por quincena · llegas aprox. el <fecha corta>".
  - Modo fecha: "Meta: <fecha corta> · cuota $X por quincena".
  - Botones **Abonar** y **Retirar** (Retirar solo si ahorrado > 0).
- Metas cumplidas (no archivadas): 🎉 "¡Lo lograste!", solo Retirar.
- Sección plegable "Archivadas" con "Restaurar".
- "+ Nueva meta" → hoja: nombre, ícono, color, objetivo, "Ya tengo ahorrado" (opcional), modo (Por fecha / Por cuota), fecha o cuota; vista previa en vivo ("Necesitas $X por quincena" / "Llegarías aprox. el <fecha>").
- Tocar la tarjeta → editar, con "Archivar".
- Si fallan los movimientos de metas: "No se pudo calcular tu progreso" y botones desactivados.

### 8.3 Abonar / Retirar
- `Prellenado` del registro rápido gana `tipo: TipoMovimiento` y `montoMaximo?: number`.
  - Abonar: `tipo: 'gasto'`, categoría `ahorro`, monto = cuota de la quincena (editable), nota = nombre de la meta, `origen: meta`.
  - Retirar: `tipo: 'ingreso'`, categoría `retiro-ahorro`, monto vacío, nota = nombre de la meta, `origen: meta`, `montoMaximo` = ahorrado → error "Solo tienes $X en esta meta".
- Pagar un fijo sigue igual (`tipo: 'gasto'`).
- Al editar un movimiento con `origen`, el selector de tipo sigue oculto (fase 3).

### 8.4 Inicio
- "Fijos de esta quincena" → **"Pendientes de esta quincena"**: fijos + metas, mismo formato. Metas muestran su ícono/color y el botón dice **Abonar**.
- Comprometido incluye las cuotas de metas pendientes.
- Errores: si fallan fijos, metas o movimientos, la sección muestra error (no se invita a pagar dos veces).

### 8.5 Cerdito → ardilla
🐷 → 🐿️ en favicon (`index.html`), pantalla de carga (`App.tsx`), login (`LoginPage.tsx`) y categoría "Ahorro". Los datos del emulador conservan el ícono viejo hasta que se reinician (no hay datos reales).

## 9. Diferencias con el spec base

- `ahorrado` ya no se guarda: se calcula de los movimientos (más robusto ante ediciones y offline).
- Se agregan `ahorroInicial`, `archivada`, retiros y la categoría "Retiro de ahorro".
- No se pueden borrar metas (se archivan).

## 10. Pruebas

- Vitest `metas.ts`: validación y normalización; ahorrado con ahorro inicial, abonos y retiros (ignora movimientos de otras metas o de fijos); progreso con tope 100; cuota modo fecha (cruce de mes y de año, febrero, fecha vencida, no cambia al abonar en la quincena); cuota modo cuota (faltante menor que la cuota); fecha estimada; pendientes de metas (archivada, cumplida, retiros no cuentan como pago, pago en partes).
- Vitest `categorias.ts`: "Retiro de ahorro" es de sistema e ingreso; ningún 🐷.
- Reglas en emulador: metas válidas en ambos modos; inválidas (campo del otro modo, faltante, objetivo 0, ahorro inicial negativo, fecha mal formada); no se puede borrar; movimiento con origen meta como ingreso permitido; origen fijo como ingreso sigue rechazado.
- Manual en el celular: crear meta por fecha y por cuota; abonar; retirar más de lo ahorrado (rechazado) y menos (acepta); ver pendiente en Inicio y comprometido; editar/borrar un abono y ver que la meta se corrige; archivar y restaurar; ver la ardilla en login y pestaña.
