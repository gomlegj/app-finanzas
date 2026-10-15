import type { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { CATEGORIAS_POR_DEFECTO } from '../domain/categorias';
import { DIAS_PAGO_POR_DEFECTO, type DiasPago } from '../domain/quincena';
import { db } from '../lib/firebase';

export interface Perfil {
  nombre: string;
  email: string;
  moneda: string;
  diasPago: DiasPago;
}

export type CambiosPerfil = Partial<Pick<Perfil, 'moneda' | 'diasPago'>>;

export async function asegurarPerfil(usuario: User): Promise<void> {
  const ref = doc(db, 'users', usuario.uid);
  if ((await getDoc(ref)).exists()) {
    await asegurarCategoriasDeSistema(usuario.uid);
    return;
  }

  const lote = writeBatch(db);
  lote.set(ref, {
    nombre: usuario.displayName ?? '',
    email: usuario.email ?? '',
    moneda: 'COP',
    diasPago: DIAS_PAGO_POR_DEFECTO,
    creadoEn: serverTimestamp(),
  });
  for (const { id, ...datos } of CATEGORIAS_POR_DEFECTO) {
    lote.set(doc(db, 'users', usuario.uid, 'categorias', id), datos);
  }
  await lote.commit();
}

/** Cuentas creadas antes de una categoría de sistema nueva (p. ej. "Retiro de ahorro") la reciben al entrar. */
async function asegurarCategoriasDeSistema(uid: string): Promise<void> {
  for (const { id, ...datos } of CATEGORIAS_POR_DEFECTO.filter((c) => c.sistema)) {
    const ref = doc(db, 'users', uid, 'categorias', id);
    if (!(await getDoc(ref)).exists()) await setDoc(ref, datos);
  }
}

export function escucharPerfil(
  uid: string,
  alCambiar: (perfil: Perfil | null) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => alCambiar(snap.exists() ? (snap.data() as Perfil) : null),
    (error) => {
      console.error('Error escuchando perfil', error);
      alFallar?.(error);
    },
  );
}

export function actualizarPerfil(uid: string, cambios: CambiosPerfil): Promise<void> {
  return updateDoc(doc(db, 'users', uid), cambios);
}
