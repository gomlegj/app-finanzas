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

/**
 * Nuevo texto del campo de monto mientras se escribe.
 * La parte decimal queda visible (para que no se sume a los miles), pero `parsearMonto` la descarta.
 * Un monto pegado con comas de miles ("1,500,000") se interpreta como tal.
 */
export function actualizarTextoMonto(escrito: string): string {
  const compacto = escrito.replace(/[\s$]/g, '');
  if (/^\d{1,3}(,\d{3})+$/.test(compacto)) return agruparMiles(compacto.replace(/,/g, ''));
  const coma = escrito.indexOf(',');
  if (coma === -1) return agruparMiles(escrito);
  const decimales = escrito.slice(coma + 1).replace(/\D/g, '').slice(0, 2);
  return `${agruparMiles(escrito.slice(0, coma)) || '0'},${decimales}`;
}
