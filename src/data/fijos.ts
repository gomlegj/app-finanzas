import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosFijo, Fijo } from '../domain/fijos';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'fijos');

export function escucharFijos(
  uid: string,
  alCambiar: (fijos: Fijo[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosFijo) }))),
    (error) => {
      console.error('Error escuchando gastos fijos', error);
      alFallar?.(error);
    },
  );
}

export async function crearFijo(uid: string, datos: DatosFijo): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, creadoEn: serverTimestamp() });
}

/** Reemplaza los datos editables; si pasa a quincenal se borra `quincena` (las reglas lo exigen). */
export function actualizarFijo(uid: string, id: string, datos: DatosFijo): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos, quincena: datos.quincena ?? deleteField() });
}

export function borrarFijo(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(coleccion(uid), id));
}
