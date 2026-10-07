import type { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { CATEGORIAS_POR_DEFECTO } from '../domain/categorias';
import { db } from '../lib/firebase';

export interface Perfil {
  nombre: string;
  email: string;
  moneda: string;
  diasPago: [number, number];
}

export async function asegurarPerfil(usuario: User): Promise<void> {
  const ref = doc(db, 'users', usuario.uid);
  if ((await getDoc(ref)).exists()) return;

  const lote = writeBatch(db);
  lote.set(ref, {
    nombre: usuario.displayName ?? '',
    email: usuario.email ?? '',
    moneda: 'COP',
    diasPago: [15, 30],
    creadoEn: serverTimestamp(),
  });
  for (const { id, ...datos } of CATEGORIAS_POR_DEFECTO) {
    lote.set(doc(db, 'users', usuario.uid, 'categorias', id), datos);
  }
  await lote.commit();
}

export function escucharPerfil(uid: string, alCambiar: (perfil: Perfil | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => alCambiar(snap.exists() ? (snap.data() as Perfil) : null),
    (error) => console.error('Error escuchando perfil', error),
  );
}
