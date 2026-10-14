# Recordatorios de gastos fijos en Google Calendar — Diseño

Fecha: 2026-10-14
Base: fase 3 (`2026-10-14-fase-3-gastos-fijos-design.md`). Spec general: `2026-10-06-app-finanzas-design.md` (las notificaciones push quedaron fuera de v1; esto las sustituye sin servidor).

## 1. Objetivo

Que Google Calendar le recuerde a la usuaria cuándo vence cada gasto fijo, sin servidor y con costo $0. La app arma un evento repetitivo prellenado y la usuaria lo guarda en su calendario con un toque; desde ahí las notificaciones las envía Google.

Criterios de éxito:
- Un fijo mensual puede tener un día de pago (vencimiento) opcional.
- Desde un fijo guardado se abre Google Calendar con el evento listo para guardar (título, monto, fecha de inicio, repetición).
- El evento nunca se salta un mes (días 29–31 en meses cortos).

## 2. Conceptos

- **Quincena (1 o 2)** — sin cambios: indica con qué plata se paga el fijo; gobierna pendientes y comprometido.
- **Día de pago del fijo (`diaPago`)** — nuevo, solo informativo: cuándo vence. Solo para el recordatorio; **no** afecta pendientes, comprometido ni la quincena.
- Fijo **mensual**: recordatorio en su `diaPago` si lo tiene; sin `diaPago` no hay recordatorio.
- Fijo **quincenal**: no tiene `diaPago`; su recordatorio cae en los dos días de pago de la usuaria (`perfil.diasPago`).
- Si un día no existe en el mes (29–31), el recordatorio cae en el último día del mes, igual que las quincenas.

## 3. Alcance

Incluye: campo `diaPago`, reglas y pruebas; generación de enlace de Google Calendar; campo en el formulario; etiqueta en la lista; botón en la hoja de edición.

Fuera de alcance:
- Sincronización automática con la API de Calendar (crear/editar/borrar eventos solos).
- Elegir la hora del aviso desde la app (el enlace no lo permite).
- Avisos dentro de la app ("vence mañana").

## 4. Modelo de datos

```
users/{uid}/fijos/{id}
  ...campos de fase 3...
  diaPago?: int 1–31   // solo si frecuencia == 'mensual'; opcional
```

Reglas:
- `diaPago` ausente, o `int` entre 1 y 31.
- Prohibido si `frecuencia == 'quincenal'`.
- Al editar, si se borra el día o el fijo pasa a quincenal, el campo se elimina (`deleteField`), igual que `quincena`.

## 5. Dominio

### 5.1 `src/domain/fijos.ts` (cambios)
- `DatosFijo.diaPago?: number`; `FormularioFijo.diaPago: number | null`.
- `validarFijo`: si es mensual y `diaPago !== null`, debe ser entero 1–31 → error en `diaPago`: `'Usa un día entre 1 y 31'`.
- `normalizarFijo`: guarda `diaPago` solo si es mensual y no es `null`.
- `etiquetaVencimiento(fijo)`: `'vence el 5'` si tiene `diaPago`; `null` si no.

### 5.2 `src/domain/calendario.ts` (nuevo)
- `diasRecordatorio(fijo: DatosFijo, diasPago: DiasPago): number[] | null`
  - mensual con `diaPago` → `[diaPago]`; mensual sin día → `null`; quincenal → `ordenarDiasPago(diasPago)`.
- `reglaRecurrencia(dias: readonly number[]): string` (RRULE)
  - Un día `d ≤ 28` → `RRULE:FREQ=MONTHLY;BYMONTHDAY=d`.
  - Un día `d > 28` → `RRULE:FREQ=MONTHLY;BYMONTHDAY=28,…,d;BYSETPOS=-1` (el último día existente ≤ d).
  - Dos días `[a, b]` con `b ≤ 28` → `RRULE:FREQ=MONTHLY;BYMONTHDAY=a,b`.
  - Dos días `[a, b]` con `b > 28` → `RRULE:FREQ=MONTHLY;BYMONTHDAY=a,28,…,b;BYSETPOS=1,-1` (el primero es `a`, porque `a ≤ 27` por la regla de días de pago; el último es el mayor existente ≤ b).
- `proximaFecha(dias: readonly number[], hoy: Date): string` — la primera fecha `>= hoy` (local, `'YYYY-MM-DD'`) en la que cae alguno de los días, ajustando 29–31 al último día del mes.
- `enlaceCalendario(datos: { nombre: string; monto: number }, dias: readonly number[], moneda: string, hoy: Date): string`
  - `https://calendar.google.com/calendar/render?action=TEMPLATE` con:
    - `text` = `Pagar <nombre>`
    - `details` = `Monto planeado: <monto formateado>`
    - `dates` = `YYYYMMDD/YYYYMMDD` (evento de día completo: inicio = `proximaFecha`, fin = día siguiente)
    - `recur` = `reglaRecurrencia(dias)`
  - Parámetros codificados con `URLSearchParams`.

## 6. Pantallas

- **Formulario de fijo:** si frecuencia es mensual, campo numérico "Día de pago (opcional)" (1–31) con ayuda "Para recordarte en Google Calendar". Oculto si es quincenal.
- **Lista de fijos:** la línea secundaria agrega `· vence el 5` cuando hay día.
- **Hoja de edición de un fijo guardado:** enlace-botón "📅 Agregar a Google Calendar" (`<a target="_blank" rel="noopener noreferrer">`) cuando `diasRecordatorio` no es `null`. Usa los datos **guardados** del fijo (no los cambios sin guardar) y los días de pago del perfil. Texto de ayuda debajo: "Si cambias este fijo, actualiza también el evento en Calendar."

## 7. Limitaciones aceptadas

- La hora del aviso la define la configuración de Google Calendar para eventos de día completo; se puede ajustar al guardar el evento.
- Los eventos no se actualizan solos al cambiar monto, día, días de pago o al borrar el fijo.
- La app no sabe si el evento se guardó.
- El parámetro `recur` del enlace de plantilla de Google Calendar no está documentado oficialmente. Si en la verificación manual Google no acepta `BYSETPOS`, se usa `BYMONTHDAY=-1` para días 29–31 en fijos mensuales (último día del mes) y se registra la desviación.

## 8. Pruebas

- Vitest `calendario.ts`: regla para días 5, 28, 29, 30, 31; quincenal 15/30, 1/15, 10/31; `proximaFecha` hoy mismo, más adelante en el mes, paso al mes siguiente, febrero (día 30 → 28, bisiesto → 29), diciembre → enero; `enlaceCalendario` (parámetros decodificados).
- Vitest `fijos.ts`: validación y normalización de `diaPago`; `etiquetaVencimiento`.
- Reglas en emulador: `diaPago` válido; 0, 32, decimal, texto, en quincenal → rechazado; borrar `diaPago` al editar → permitido.
- Manual en el celular: crear fijo mensual con día 30, abrir el enlace, revisar en Calendar que la repetición caiga el 28/29 en febrero, guardar y ver el aviso.
