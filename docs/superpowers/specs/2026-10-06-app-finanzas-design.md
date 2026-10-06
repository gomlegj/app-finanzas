# App de Finanzas Personales — Diseño

Fecha: 2026-10-06
Estado: aprobado en conversación, pendiente de revisión escrita

## 1. Objetivo

App de finanzas personales, usable principalmente desde el celular, intuitiva y visualmente agradable. Permite registrar ingresos y gastos, planear el presupuesto por quincena, comparar lo planeado contra lo real, ahorrar para metas y controlar deudas.

**Criterios de éxito**
- Registrar un gasto toma menos de 10 segundos desde el celular.
- En una sola pantalla se ve cuánto queda disponible en la quincena actual.
- Cambiar de celular no pierde datos (basta con iniciar sesión).
- Costo de operación: $0.

## 2. Usuarios y privacidad

- Varios usuarios; cada uno con **sus propias finanzas, privadas y separadas**. No hay espacios compartidos.
- Autenticación con cuenta de Google (y opcionalmente correo + contraseña).
- Reglas de seguridad de Firestore: un usuario solo lee/escribe bajo `users/{suUid}`.

## 3. Stack tecnológico

| Pieza | Elección | Motivo |
|---|---|---|
| Frontend | React + Vite + TypeScript | Ecosistema amplio, tipado para cálculos de dinero |
| Estilos | Tailwind CSS | UI bonita y rápida de iterar |
| Gráficas | Recharts | Dona por categoría, barras por quincena |
| Fechas | date-fns | Cálculo de periodos |
| Navegación | React Router | |
| PWA | vite-plugin-pwa | Instalable en el celular, funciona offline |
| Backend | Firebase (plan Spark gratis): Auth + Firestore | No se pausa por inactividad (a diferencia de Supabase free), login Google integrado |
| Hosting | Firebase Hosting | Gratis, dominio `*.web.app` |
| Pruebas | Vitest + Firebase Emulator | |

**Restricción clave:** no se usan Cloud Functions (requieren plan pago Blaze). Toda lógica corre en el cliente.

## 4. Conceptos de dominio

### 4.1 Quincenas (por día de pago)
- Cada usuario configura dos días de pago (`diasPago`, por defecto `[15, 30]`).
- Cada quincena **empieza el día de pago** y termina el día anterior al siguiente pago.
  - Ejemplo con `[15, 30]`: Q1 = 15 → 29; Q2 = 30 → 14 del mes siguiente.
- Si un día de pago no existe en el mes (p. ej. 30 en febrero), se usa el último día del mes.
- "Q1" es la quincena que inicia en `diasPago[0]`, "Q2" la que inicia en `diasPago[1]`.

### 4.2 Presupuesto de quincena
Para la quincena actual se calcula:
- **Ingresos:** suma de movimientos tipo ingreso en el periodo.
- **Comprometido:** suma de pendientes del periodo (fijos + cuotas de deudas + cuotas de metas) aún no pagados.
- **Gastado:** suma de movimientos tipo gasto en el periodo.
- **Disponible:** ingresos − gastado − comprometido.
- **Planeado vs real:** por cada pendiente, monto planeado contra lo efectivamente pagado; por categoría, gasto real del periodo.

### 4.3 Pendientes "automáticos" (sin servidor)
Los gastos fijos, cuotas de deuda y cuotas de meta **no se materializan** en la base de datos. Al abrir la app se calcula qué corresponde a la quincena actual:
- Fijo mensual → aparece en la quincena indicada (1 o 2).
- Fijo quincenal → aparece en ambas.
- Deuda → aparece en la quincena que contiene su `diaPago`.
- Meta modo fecha → aparece en todas las quincenas con su cuota calculada.
- Meta modo cuota → aparece en todas las quincenas con su cuota fija.

Al tocar **"Pagado"** se crea un movimiento con `origen: {tipo, id}`. Un pendiente se considera pagado si existe un movimiento con ese `origen.id` dentro del periodo.

### 4.4 Metas de ahorro
Dos modos, elegidos al crear la meta:
- **Por fecha:** objetivo + fecha → cuota por quincena = `ceil((objetivo − ahorrado) / quincenasRestantes)`.
- **Por cuota:** objetivo + cuota por quincena → fecha estimada = fecha actual + `ceil((objetivo − ahorrado) / cuota)` quincenas.
- Abonar incrementa `ahorrado` y crea un movimiento tipo gasto con origen meta (categoría de sistema "Ahorro").
- Meta completada cuando `ahorrado >= objetivo`.

### 4.5 Deudas y tarjetas
- Campos: nombre, tipo (tarjeta | préstamo | otro), saldo, cuota, cuotas restantes (opcional), día de pago, activa.
- "Pagar cuota" crea movimiento tipo gasto (origen deuda, categoría de sistema "Deudas"), reduce `saldo` y `cuotasRestantes`.
- Deuda se desactiva cuando saldo llega a 0.

### 4.6 Categorías
- Al registrarse, cada usuario recibe categorías por defecto:
  - Gasto: Comida, Transporte/Pasajes, Arriendo, Servicios, Salud, Entretenimiento, Ropa, Educación, Deudas, Ahorro, Otros.
  - Ingreso: Salario, Extra, Otros.
- Editables: crear, renombrar, cambiar ícono/color, archivar. "Ahorro" y "Deudas" son de sistema (no se pueden borrar).
- Borrar una categoría con movimientos la **archiva** (no se pierde historial).

### 4.7 Moneda y montos
- Moneda configurable por usuario, por defecto COP.
- Montos guardados como **enteros** (sin decimales) para evitar errores de redondeo.

## 5. Modelo de datos (Firestore)

```
users/{uid}
  nombre, email, moneda, diasPago: [number, number], creadoEn

users/{uid}/categorias/{id}
  nombre, icono, color, tipo: 'gasto'|'ingreso', orden, sistema: bool, archivada: bool

users/{uid}/movimientos/{id}
  tipo: 'gasto'|'ingreso', monto: int, categoriaId, fecha: 'YYYY-MM-DD', nota?,
  origen?: { tipo: 'fijo'|'deuda'|'meta', id }, creadoEn

users/{uid}/fijos/{id}
  nombre, monto: int, categoriaId, frecuencia: 'mensual'|'quincenal',
  quincena?: 1|2 (si mensual), activo: bool

users/{uid}/metas/{id}
  nombre, objetivo: int, ahorrado: int, modo: 'fecha'|'cuota',
  fechaObjetivo?: 'YYYY-MM-DD', cuotaQuincenal?: int, icono, color, creadoEn

users/{uid}/deudas/{id}
  nombre, tipo: 'tarjeta'|'prestamo'|'otro', saldo: int, cuota: int,
  cuotasRestantes?: int, diaPago: int, activa: bool
```

Persistencia offline de Firestore activada: se puede registrar sin conexión y sincroniza al reconectar.

## 6. Pantallas

Barra inferior: **Inicio · Movimientos · (+) · Metas · Deudas**. Ajustes desde el ícono de perfil.

1. **Login:** botón "Entrar con Google".
2. **Inicio:** tarjeta de quincena actual (ingreso, comprometido, gastado, disponible); lista de pendientes con botón "Pagado"; dona de gasto por categoría; últimos movimientos.
3. **Registro rápido (+):** hoja inferior; monto → categoría → guardar. Fecha (hoy por defecto) y nota opcionales. Alterna gasto/ingreso.
4. **Movimientos:** historial con filtros por quincena, mes y categoría; editar/borrar.
5. **Metas:** tarjetas con barra de progreso, cuota o fecha estimada, botón "Abonar"; crear/editar meta.
6. **Deudas:** tarjetas con saldo, cuota, cuotas restantes, próximo pago, botón "Pagar cuota"; crear/editar.
7. **Ajustes:** categorías, gastos fijos, días de pago, moneda, cerrar sesión.

## 7. Arquitectura del código

```
src/
  domain/        lógica pura, sin React ni Firebase (con pruebas)
    quincena.ts      periodo para una fecha dada y diasPago
    presupuesto.ts   pendientes, comprometido, gastado, disponible
    metas.ts         cuota↔fecha, progreso
    deudas.ts        quincena de cada cuota, aplicar pago
    dinero.ts        formato de moneda
  data/          acceso a Firestore, un módulo por colección
  features/      auth, inicio, movimientos, metas, deudas, ajustes
  components/    UI reutilizable
  lib/firebase.ts
```

Regla: `features/` usa `data/` y `domain/`; `domain/` no depende de nada externo.

## 8. Manejo de errores

- Validación de formularios (monto > 0, categoría obligatoria, fechas válidas).
- Toast ante fallos de guardado.
- Indicador de estado "sin conexión — se sincroniza después".
- Pantalla de error genérica si falla la autenticación.

## 9. Pruebas

- **Vitest** sobre todo `domain/`, con TDD (casos: cruces de mes, febrero, días 30/31, metas ya cumplidas, deudas en 0).
- **Reglas de seguridad** probadas con Firebase Emulator: usuario A no puede leer ni escribir datos de B; usuario sin sesión no accede a nada.
- Verificación manual en celular de cada fase.

## 10. Despliegue

- Firebase Hosting, `firebase deploy`, dominio `*.web.app` gratis.
- Dominio propio opcional (~10–15 USD/año), fuera de alcance.
- Automatización con GitHub Actions: futura, fuera de alcance v1.

## 11. Fases de construcción

1. Base del proyecto, login con Google, categorías, registro de gastos/ingresos.
2. Quincenas e Inicio (resumen + gráfica por categoría).
3. Gastos fijos y presupuesto planeado vs real.
4. Metas de ahorro.
5. Deudas.
6. Pulido visual, PWA instalable, despliegue.

## 12. Fuera de alcance (v1)

- Medios de pago (efectivo, Nequi, débito) y saldos por cuenta.
- Subcategorías.
- Finanzas compartidas entre usuarios.
- Notificaciones push / recordatorios.
- Exportar a Excel/PDF.
