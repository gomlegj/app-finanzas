# Fase 5 — Deudas y tarjetas — Diseño

Fecha: 2026-10-16
Base: `2026-10-06-app-finanzas-design.md` (§4.5, §5, §6), fase 3 (fijos) y fase 4 (metas, `2026-10-15-fase-4-metas-design.md`). Este documento **reemplaza** el modelo de deudas del spec base donde difieren (ver §9).

## 1. Objetivo

Que la usuaria registre sus deudas (tarjetas, préstamos, otras), vea cuánto debe y cuándo paga, registre pagos de cuota, actualice el saldo con el extracto del banco, y que cada cuota aparezca como pendiente de la quincena en que vence.

Criterios de éxito:
- Crear, editar y archivar deudas; "Actualizar saldo" con el valor del extracto.
- Pantalla Deudas con total adeudado, saldo, cuota, próximo pago y cuotas estimadas.
- "Pagar cuota" registra un gasto en la categoría de sistema "Deudas" y baja el saldo.
- En Inicio, la cuota es pendiente de la quincena que contiene su día de pago y suma al comprometido.
- El saldo siempre coincide con los pagos registrados: editar o borrar un pago corrige la deuda.

## 2. Conceptos

- **Compras con tarjeta**: no se registran como gasto; solo el pago de la cuota es gasto (categoría "Deudas"). Evita contar dos veces.
- **Saldo base**: último saldo conocido (al crear la deuda o al "Actualizar saldo"), con el **momento** (`saldoBaseEn`) en que se registró, tomado de la **hora del servidor** (no del celular) para compararlo sin desfases con la hora de registro de los pagos.
- **Pago de la deuda**: movimiento `tipo: 'gasto'` con `origen: { tipo: 'deuda', id }`.
- **Saldo** (calculado, no guardado) = `max(0, saldoBase − Σ pagos registrados después de saldoBaseEn)`.
  - "Registrado después" se mide con el momento de registro del movimiento (`creadoEn` del documento). Un movimiento aún sin sincronizar (sin `creadoEn` del servidor) cuenta como posterior.
- **Pagada**: saldo = 0.
- **Activa**: no archivada y no pagada (con el saldo al inicio de la quincena).
- **Cuotas estimadas**: `ceil(saldo / cuota)` ("≈ N cuotas"). Es un estimado: en préstamos con intereses se corrige al actualizar el saldo.
- **Próximo pago**: primera fecha ≥ hoy con el día de pago; si el día no existe en el mes, el último día del mes.
- **Vencimiento en una quincena**: la fecha de pago (ajustada al último día si hace falta) del mes de `quincena.desde` o del mes de `quincena.hasta` cae dentro de `[desde, hasta]`.
- **Saldo copiado después del vencimiento**: si `saldoBaseEn` (fecha local) es posterior al vencimiento de la quincena, esa cuota se considera incluida en el saldo y no se pide.
- **Pendiente de deuda**: planeado = `min(cuota, saldoAlInicio)`, donde `saldoAlInicio` descuenta solo pagos con `fecha < quincena.desde`; pagado si hay pagos con fecha en la quincena (se suman).

## 3. Alcance

Incluye: colección `deudas` y reglas; dominio de deudas; pantalla Deudas; Pagar cuota y Actualizar saldo; pendientes de deudas en Inicio; barra inferior con Deudas.

Fuera de alcance: intereses calculados; compras con tarjeta como movimientos; recordatorios de Calendar para deudas (se puede sumar después reutilizando la fase de recordatorios); borrar deudas.

## 4. Modelo de datos

```
users/{uid}/deudas/{id}
  nombre: string (1–40)
  tipo: 'tarjeta' | 'prestamo' | 'otro'
  saldoBase: int ≥ 0
  saldoBaseEn: timestamp      // hora del servidor al crear o actualizar el saldo (la app lo lee en ms)
  cuota: int > 0
  diaPago: int 1–31
  archivada: bool
  creadoEn: timestamp
```

Movimientos: sin cambios de forma. La capa de datos expone `registradoEn?: number` (ms) a partir de `creadoEn` (ausente mientras no se sincroniza).

Categoría: se usa la de sistema existente `deudas` (💳).

## 5. Reglas de seguridad

- `deudas/{id}`: dueña lee, crea y actualiza con validación completa; **no** se puede borrar.
  - `nombre` 1–40; `tipo` en la lista; `saldoBase` int ≥ 0; `saldoBaseEn` timestamp; `cuota` int > 0; `diaPago` int 1–31; `archivada` bool.
  - Al crear, `saldoBaseEn == request.time`; al actualizar, no cambia o es `request.time`.
- `movimientos`: sin cambios (un `origen` deuda solo puede ser gasto).

## 6. Dominio

### 6.1 `src/domain/deudas.ts` (nuevo, TDD)
- Tipos: `TipoDeuda`, `DatosDeudaEditable` (nombre, tipo, cuota, diaPago), `DatosDeuda` (+ saldoBase, saldoBaseEn, archivada), `Deuda`, `FormularioDeuda`, `ErroresDeuda`.
- `validarDeuda(formulario)`: nombre 1–40; saldo > 0 (al crear; una deuda en 0 no tiene sentido registrarla); cuota > 0; día 1–31.
- `saldo(deuda, movimientos)`, `pagada(deuda, saldo)`, `cuotasEstimadas(deuda, saldo)`.
- `proximoPago(deuda, hoy)`: `'YYYY-MM-DD'`.
- `venceEnQuincena(diaPago, quincena)`: fecha de vencimiento dentro de la quincena o `null`.
- `pagadoEnQuincena(deuda, movimientos, quincena)`.
- `pendientesDeDeudas(deudas, quincena, movimientosDeDeudas)` → `Pendiente[]`.
- `ICONO_TIPO_DEUDA`: tarjeta 💳, préstamo 🏦, otro 📄; color `#64748b` (el de la categoría "Deudas").

### 6.2 `src/domain/fijos.ts`
- `Pendiente.origen.tipo` admite `'deuda'`.

### 6.3 `src/domain/fechas.ts` / `calendario.ts`
- Reutilizar el ajuste "día que no existe → último día del mes" (hoy privado en `calendario.ts` como `enMes`): se mueve a `fechas.ts` como `fechaEnMes(anio, mes, dia)` exportada y la usan calendario y deudas.

## 7. Capa de datos

- `src/data/deudas.ts`: `escucharDeudas`, `crearDeuda` (saldoBaseEn = `serverTimestamp()`), `actualizarDeuda` (datos editables), `actualizarSaldo(uid, id, saldo)` (saldoBase + saldoBaseEn = `serverTimestamp()`); `escucharDeudas` lo lee con `serverTimestamps: 'estimate'` y lo convierte a ms, `archivarDeuda`.
- `src/data/movimientos.ts`: los listeners exponen `registradoEn` (ms) desde `creadoEn`; `escucharMovimientosDeDeudas` (`where('origen.tipo', '==', 'deuda')`).
- `src/data/hooks.ts`: `useDeudas`, `useMovimientosDeDeudas`.

## 8. Pantallas

### 8.1 Barra inferior
Inicio · Movimientos · (+) · Metas · Deudas.

### 8.2 Deudas (`/deudas`)
- Arriba: "Debes en total: $X" (saldos de deudas no archivadas).
- Tarjeta por deuda no archivada: ícono del tipo, nombre, saldo, "Cuota $X · día N · próximo pago <fecha corta>", "≈ N cuotas".
  - Si hubo pagos en la quincena: "✓ Pagaste $X esta quincena".
  - Botones **Pagar cuota** y **Actualizar saldo**.
  - Pagada: 🎉 "¡Pagada!" y botón **Archivar**.
- Sección plegable "Archivadas" con "Restaurar".
- "+ Nueva deuda" → hoja: nombre, tipo (tarjeta / préstamo / otro), saldo actual, cuota, día de pago.
- Tocar la tarjeta → editar (nombre, tipo, cuota, día) con "Archivar". El saldo se cambia solo con "Actualizar saldo".
- Si fallan los pagos: "No se pudo calcular tu saldo" y botones desactivados.

### 8.3 Pagar cuota / Actualizar saldo
- Pagar cuota: `Prellenado` gasto, categoría `deudas`, monto = `max(0, planeado − pagadoEnQuincena)` (vacío si es 0), nota = nombre, `origen: deuda`, título "Pagar cuota", `montoMaximo` = saldo con "Solo debes $X".
- Actualizar saldo: hoja con campo de monto prellenado con el saldo actual; guardar → `actualizarSaldo`.

### 8.4 Inicio
- "Pendientes de esta quincena" incluye deudas (ícono del tipo; botón **Pagar**). Comprometido las incluye.
- Error si falla cualquier fuente (fijos, metas, deudas o sus movimientos).

## 9. Diferencias con el spec base

- El saldo no se guarda: se calcula con saldo base + pagos registrados después.
- "Cuotas restantes" ya no es un campo: es un estimado.
- `activa` se reemplaza por `archivada` + "pagada" calculada.
- Nuevo: "Actualizar saldo".

## 10. Pruebas

- Vitest `deudas.ts`: validación; saldo (solo pagos registrados después, pendientes de sincronizar cuentan, otros orígenes no, nunca < 0); cuotas estimadas; próximo pago (hoy, más adelante, fin de mes, febrero, diciembre → enero); vencimiento en quincena que cruza de mes; pendientes (cuota mayor que el saldo, pago en partes, pagada, archivada, sin vencimiento en la quincena).
- Vitest `fechas.ts`: `fechaEnMes`.
- Reglas en emulador: deudas válidas e inválidas; no se pueden borrar; dueña solamente.
- Manual en el celular: crear tarjeta y préstamo; pagar cuota; actualizar saldo; ver pendiente y comprometido en Inicio; borrar un pago y ver el saldo corregido; archivar y restaurar.
