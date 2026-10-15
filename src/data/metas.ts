import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosMeta, DatosMetaEditable, Meta } from '../domain/metas';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'metas');

export function escucharMetas(
  uid: string,
  alCambiar: (metas: Meta[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosMeta) }))),
    (error) => {
      console.error('Error escuchando metas', error);
      alFallar?.(error);
    },
  );
}

export async function crearMeta(uid: string, datos: DatosMetaEditable): Promise<void> {
  await addDoc(coleccion(uid), { ...datos, archivada: false, creadoEn: serverTimestamp() });
}

/** Reemplaza los datos editables; borra el campo del modo que no se usa (las reglas lo exigen). */
export function actualizarMeta(uid: string, id: string, datos: DatosMetaEditable): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), {
    ...datos,
    fechaObjetivo: datos.fechaObjetivo ?? deleteField(),
    cuotaQuincenal: datos.cuotaQuincenal ?? deleteField(),
  });
}

export function archivarMeta(uid: string, id: string, archivada: boolean): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { archivada });
}
