# Fase 3 — Gastos fijos y presupuesto planeado vs real — Diseño

Fecha: 2026-10-14
Spec base: `2026-10-06-app-finanzas-design.md` (secciones 4.2, 4.3 y 5).

## 1. Objetivo

Permitir registrar gastos fijos (arriendo, servicios, suscripciones…) y ver en Inicio, para la quincena actual, qué fijos faltan por pagar, cuánto dinero está comprometido y cuánto se pagó realmente contra lo planeado.

Criterios de éxito:
- Crear, editar, pausar y eliminar fijos desde Ajustes.
- Inicio muestra los fijos de la quincena actual, separados en pendientes y pagados.
- "Disponible" descuenta lo comprometido (fijos activos no pagados de la quincena).
- Marcar un fijo como pagado registra un gasto real cuyo monto puede diferir del planeado.

## 2. Alcance

Incluye:
- Colección `fijos`, reglas de seguridad y pruebas.
- Cálculo de pendientes y comprometido en el cliente (sin materializar en la base de datos).
- Pantalla Ajustes → Gastos fijos.
- Sección "Fijos de esta quincena" en Inicio y columna "Comprometido" en la tarjeta resumen.
- Validación de `origen` en movimientos.

Fuera de alcance (esta fase):
- Ver fijos de quincenas pasadas o futuras (Inicio solo muestra la actual).
- Cuotas de deudas y metas como pendientes (fases 4 y 5; el tipo `Pendiente` queda preparado para ellas).

## 3. Modelo de datos

```
users/{uid}/fijos/{id}
  nombre: string (1–40)
  monto: int > 0
  categoriaId: string (categoría de gasto)
  frecuencia: 'mensual' | 'quincenal'
  quincena?: 1 | 2        // obligatoria si mensual; ausente si quincenal
  activo: bool
  creadoEn: timestamp
```

Movimientos (sin cambios de forma): `origen?: { tipo: 'fijo'|'deuda'|'meta', id: string }`.

## 4. Dominio (`src/domain/fijos.ts`)

- `validarFijo(datos)` → errores por campo o ninguno (mismo estilo que `validarMovimiento`/`validarCategoria`).
- `pendientesDeQuincena(fijos, quincena, movimientos)` → `Pendiente[]`:
  ```ts
  interface Pendiente {
    origen: { tipo: 'fijo'; id: string };
    nombre: string;
    categoriaId: string;
    planeado: number;
    /** Ausente si no está pagado. */
    pagado?: { monto: number; movimientos: string[] };
  }
  ```
  Reglas:
  - Entra un fijo si aplica a la quincena: quincenal siempre; mensual solo si `fijo.quincena === quincena.numero`.
  - Está pagado si existen movimientos con `origen.tipo === 'fijo'` y `origen.id === fijo.id` dentro de la quincena (los movimientos recibidos ya son los del periodo). Si hay varios, `pagado.monto` es la suma (pago en partes).
  - Un fijo inactivo aparece solo si ya está pagado en la quincena (no se pierde lo ocurrido); si no está pagado, no aparece.
  - Orden: pendientes primero, luego pagados; dentro de cada grupo, por nombre (`localeCompare` en español).
- `comprometido(pendientes)` → suma de `planeado` de los no pagados. Un fijo pagado de más o de menos no afecta el comprometido; la diferencia ya está en "Gastado".
- `resumenQuincena(movimientos, comprometido)` existente, sin cambios.

## 5. Capa de datos

- `src/data/fijos.ts`: `escucharFijos`, `crearFijo`, `actualizarFijo`, `borrarFijo` (patrón de `categorias.ts`).
- `src/data/hooks.ts`: `useFijos(uid)`.
- `crearMovimiento` acepta `origen` opcional. `actualizarMovimiento` sigue usando `updateDoc`, que conserva `origen`.

## 6. Pantallas

### 6.1 Ajustes → Gastos fijos (`/ajustes/fijos`)
- Enlace nuevo en `AjustesPage`.
- Lista: burbuja de categoría, nombre, monto, etiqueta "Mensual · Q1", "Mensual · Q2" o "Quincenal". Pausados atenuados al final.
- Hoja inferior crear/editar: nombre, monto (input con miles existente), categoría (solo gasto, activas), frecuencia, quincena 1/2 (visible solo si mensual), interruptor activo.
- Eliminar: borrado real con confirmación. Los movimientos ya pagados conservan su `origen` y su historial.

### 6.2 Inicio
- Tarjeta resumen: tres columnas Ingresos · Gastado · Comprometido. Disponible = ingresos − gastado − comprometido.
- Sección "Fijos de esta quincena" (`features/inicio/FijosQuincena.tsx`) entre la tarjeta y la dona:
  - Fila pendiente: burbuja, nombre, monto planeado, botón **Pagado**.
  - Fila pagada: ✓, nombre, monto real y diferencia si la hay ("+12.000" ámbar si se pagó más, "−5.000" verde si menos). Al tocarla abre su movimiento para editar (si hay varios, el más reciente).
  - Sin fijos: "No tienes gastos fijos. Agrégalos en Ajustes" con enlace.
- **Pagado** abre `RegistroRapido` con prop nueva `prellenado?: { monto, categoriaId, nota, origen }`: tipo gasto, monto planeado, categoría del fijo, fecha de hoy, nota = nombre del fijo. Todo editable. Al guardar crea el movimiento con `origen`.

## 7. Reglas de seguridad

- `fijos/{id}`: dueño puede leer/crear/actualizar/borrar; validación de forma completa:
  - `nombre` string 1–40, `monto` int > 0, `categoriaId` string no vacío, `activo` bool.
  - `frecuencia == 'mensual'` ⇒ `quincena in [1, 2]`; `frecuencia == 'quincenal'` ⇒ sin `quincena`.
- `movimientos/{id}`:
  - Si trae `origen`: mapa con `tipo in ['fijo','deuda','meta']` e `id` string no vacío.
  - En update, `origen` no puede cambiar ni agregarse/quitarse.

## 8. Manejo de errores

- Igual que el resto de la app: mensaje en línea si falla la carga; toast si falla un guardado.
- Si fallan los fijos, Inicio sigue funcionando: Comprometido = 0 y la sección muestra "No se pudieron cargar tus fijos".

## 9. Pruebas

- Vitest, con TDD, sobre `domain/fijos.ts`: validación; mensual Q1 y Q2; quincenal en ambas; inactivo pagado y no pagado; pago en partes; movimiento con `origen` de otro fijo o de otro tipo; orden; comprometido.
- Pruebas de reglas en emulador: `fijos` válidos e inválidos (incluida regla de quincena), acceso ajeno denegado, `origen` válido/inválido, `origen` inmutable en update.
- Verificación manual en el celular al cerrar la fase.
