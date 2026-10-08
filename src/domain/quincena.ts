import { addDays, lastDayOfMonth, parseISO } from 'date-fns';
import { fechaCorta, fechaLocalISO } from './fechas';

export type DiasPago = [number, number];

export const DIAS_PAGO_POR_DEFECTO: DiasPago = [15, 30];

export interface Quincena {
  numero: 1 | 2;
  /** 'YYYY-MM-DD', inclusive */
  desde: string;
  /** 'YYYY-MM-DD', inclusive */
  hasta: string;
}

/** Día de pago dentro del mes; si el mes es más corto, el último día. `mes` puede salirse de 0–11. */
function diaDePago(anio: number, mes: number, dia: number): Date {
  const ultimo = lastDayOfMonth(new Date(anio, mes, 1));
  return new Date(ultimo.getFullYear(), ultimo.getMonth(), Math.min(dia, ultimo.getDate()));
}

function crear(numero: 1 | 2, inicio: Date, siguienteInicio: Date): Quincena {
  return { numero, desde: fechaLocalISO(inicio), hasta: fechaLocalISO(addDays(siguienteInicio, -1)) };
}

export function ordenarDiasPago([a, b]: DiasPago): DiasPago {
  return a <= b ? [a, b] : [b, a];
}

export function quincenaDe(fecha: Date | string, diasPago: DiasPago): Quincena {
  const base = typeof fecha === 'string' ? parseISO(fecha) : fecha;
  const anio = base.getFullYear();
  const mes = base.getMonth();
  const dia = new Date(anio, mes, base.getDate());
  const [d1, d2] = ordenarDiasPago(diasPago);
  const pago1 = diaDePago(anio, mes, d1);
  const pago2 = diaDePago(anio, mes, d2);

  if (dia >= pago2) return crear(2, pago2, diaDePago(anio, mes + 1, d1));
  if (dia >= pago1) return crear(1, pago1, pago2);
  return crear(2, diaDePago(anio, mes - 1, d2), pago1);
}

export function desplazarQuincena(quincena: Quincena, delta: number, diasPago: DiasPago): Quincena {
  let actual = quincena;
  for (let i = 0; i < Math.abs(delta); i++) {
    actual =
      delta > 0
        ? quincenaDe(addDays(parseISO(actual.hasta), 1), diasPago)
        : quincenaDe(addDays(parseISO(actual.desde), -1), diasPago);
  }
  return actual;
}

export function etiquetaQuincena(quincena: Quincena): string {
  return `${fechaCorta(quincena.desde)} – ${fechaCorta(quincena.hasta)}`;
}

export function validarDiasPago(d1: number, d2: number): string | null {
  const valido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
  if (!valido(d1) || !valido(d2)) return 'Usa días entre 1 y 31';
  if (d1 === d2) return 'Los días de pago deben ser distintos';
  return null;
}
