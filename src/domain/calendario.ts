import { addDays, parseISO } from 'date-fns';
import { formatearMonto } from './dinero';
import { fechaEnMes, fechaLocalISO } from './fechas';
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

/** Primera fecha desde hoy (incluido) en que cae alguno de los días. */
export function proximaFecha(dias: readonly number[], hoy: Date = new Date()): string {
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  for (const delta of [0, 1]) {
    const candidatas = dias
      .map((d) => fechaEnMes(inicio.getFullYear(), inicio.getMonth() + delta, d))
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
