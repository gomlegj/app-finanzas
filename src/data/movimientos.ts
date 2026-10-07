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
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosMovimiento, Movimiento } from '../domain/movimientos';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'movimientos');

export function escucharMovimientosEntre(
  uid: string,
  desde: string,
  hasta: string,
  alCambiar: (movimientos: Movimiento[]) => void,
): Unsubscribe {
  const consulta = query(
    coleccion(uid),
    where('fecha', '>=', desde),
    where('fecha', '<=', hasta),
    orderBy('fecha', 'desc'),
  );
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Movimiento, 'id'>) }))),
    (error) => console.error('Error escuchando movimientos', error),
  );
}

export async function crearMovimiento(uid: string, datos: DatosMovimiento): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, creadoEn: serverTimestamp() });
}

export function actualizarMovimiento(uid: string, id: string, datos: DatosMovimiento): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos, nota: datos.nota ?? deleteField() });
}

export function borrarMovimiento(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(coleccion(uid), id));
}
