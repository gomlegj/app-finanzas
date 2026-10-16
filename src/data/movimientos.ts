import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosMovimiento, Movimiento, OrigenMovimiento } from '../domain/movimientos';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'movimientos');

function aMovimiento(d: QueryDocumentSnapshot<DocumentData>): Movimiento {
  const { creadoEn, ...datos } = d.data() as Omit<Movimiento, 'id' | 'registradoEn'> & { creadoEn?: Timestamp | null };
  // `creadoEn` es null mientras el servidor no confirma la escritura (p. ej. sin conexión).
  return { id: d.id, ...datos, ...(creadoEn ? { registradoEn: creadoEn.toMillis() } : {}) };
}

export function escucharMovimientosEntre(
  uid: string,
  desde: string,
  hasta: string,
  alCambiar: (movimientos: Movimiento[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  const consulta = query(
    coleccion(uid),
    where('fecha', '>=', desde),
    where('fecha', '<=', hasta),
    orderBy('fecha', 'desc'),
  );
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map(aMovimiento)),
    (error) => {
      console.error('Error escuchando movimientos', error);
      alFallar?.(error);
    },
  );
}

/** Todos los movimientos ligados a metas o deudas, de cualquier fecha: saldos y ahorros se calculan con ellos. */
export function escucharMovimientosPorOrigen(
  uid: string,
  tipo: 'meta' | 'deuda',
  alCambiar: (movimientos: Movimiento[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(coleccion(uid), where('origen.tipo', '==', tipo)),
    (snap) => alCambiar(snap.docs.map(aMovimiento)),
    (error) => {
      console.error(`Error escuchando movimientos de ${tipo}`, error);
      alFallar?.(error);
    },
  );
}

export async function crearMovimiento(uid: string, datos: DatosMovimiento, origen?: OrigenMovimiento): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, ...(origen ? { origen } : {}), creadoEn: serverTimestamp() });
}

export function actualizarMovimiento(uid: string, id: string, datos: DatosMovimiento): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos, nota: datos.nota ?? deleteField() });
}

export function borrarMovimiento(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(coleccion(uid), id));
}
