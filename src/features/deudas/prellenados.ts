import { ID_DEUDAS } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Deuda } from '../../domain/deudas';
import type { Prellenado } from '../movimientos/RegistroRapido';

export function prellenadoPagoDeuda(deuda: Deuda, sugerido: number, saldoActual: number, moneda: string): Prellenado {
  return {
    tipo: 'gasto',
    monto: sugerido > 0 ? sugerido : undefined,
    categoriaId: ID_DEUDAS,
    nota: deuda.nombre,
    origen: { tipo: 'deuda', id: deuda.id },
    titulo: 'Pagar cuota',
    montoMaximo: { valor: saldoActual, mensaje: `Solo debes ${formatearMonto(saldoActual, moneda)}` },
  };
}
