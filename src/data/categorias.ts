import { addDoc, collection, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import type { Categoria, DatosCategoria } from '../domain/categorias';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'categorias');

export function escucharCategorias(
  uid: string,
  alCambiar: (categorias: Categoria[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DatosCategoria) }))),
    (error) => {
      console.error('Error escuchando categorías', error);
      alFallar?.(error);
    },
  );
}

export async function crearCategoria(uid: string, datos: DatosCategoria): Promise<void> {
  await addDoc(coleccion(uid), datos);
}

export type CambiosCategoria = Partial<Pick<DatosCategoria, 'nombre' | 'icono' | 'color' | 'archivada'>>;

export function actualizarCategoria(uid: string, id: string, cambios: CambiosCategoria): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), cambios);
}
