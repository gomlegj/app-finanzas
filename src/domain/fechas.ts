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

export function fechaCorta(iso: string): string {
  const fecha = parseISO(iso);
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

export function fechaConAnio(iso: string): string {
  return `${fechaCorta(iso)} ${parseISO(iso).getFullYear()}`;
}
