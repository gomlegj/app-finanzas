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
