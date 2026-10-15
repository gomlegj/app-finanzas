import { ID_AHORRO, ID_RETIRO_AHORRO } from '../../domain/categorias';
import { formatearMonto } from '../../domain/dinero';
import type { Meta } from '../../domain/metas';
import type { Prellenado } from '../movimientos/RegistroRapido';

export function prellenadoAbono(meta: Meta, cuota: number): Prellenado {
  return {
    tipo: 'gasto',
    monto: cuota > 0 ? cuota : undefined,
    categoriaId: ID_AHORRO,
    nota: meta.nombre,
    origen: { tipo: 'meta', id: meta.id },
    titulo: 'Abonar a la meta',
  };
}

export function prellenadoRetiro(meta: Meta, ahorradoActual: number, moneda: string): Prellenado {
  return {
    tipo: 'ingreso',
    categoriaId: ID_RETIRO_AHORRO,
    nota: meta.nombre,
    origen: { tipo: 'meta', id: meta.id },
    titulo: 'Retirar de la meta',
    montoMaximo: { valor: ahorradoActual, mensaje: `Solo tienes ${formatearMonto(ahorradoActual, moneda)} en esta meta` },
  };
}
