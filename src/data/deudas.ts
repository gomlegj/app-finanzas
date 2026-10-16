import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DatosDeuda, DatosDeudaEditable, Deuda } from '../domain/deudas';
import { db } from '../lib/firebase';

const coleccion = (uid: string) => collection(db, 'users', uid, 'deudas');

export function escucharDeudas(
  uid: string,
  alCambiar: (deudas: Deuda[]) => void,
  alFallar?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    coleccion(uid),
    (snap) =>
      alCambiar(
        snap.docs.map((d) => {
          // Mientras el servidor no confirma, se usa su hora estimada.
          const { saldoBaseEn, ...datos } = d.data({ serverTimestamps: 'estimate' }) as Omit<DatosDeuda, 'saldoBaseEn'> & {
            saldoBaseEn: Timestamp;
          };
          return { id: d.id, ...datos, saldoBaseEn: saldoBaseEn.toMillis() };
        }),
      ),
    (error) => {
      console.error('Error escuchando deudas', error);
      alFallar?.(error);
    },
  );
}

export async function crearDeuda(uid: string, datos: DatosDeudaEditable, saldoActual: number): Promise<void> {
  await addDoc(coleccion(uid), {
    ...datos,
    saldoBase: saldoActual,
    // Hora del servidor: se compara con la hora de registro de los pagos, sin depender del reloj del celular.
    saldoBaseEn: serverTimestamp(),
    archivada: false,
    creadoEn: serverTimestamp(),
  });
}

/** Solo campos editables: el saldo cambia únicamente con `actualizarSaldo`. */
export function actualizarDeuda(uid: string, id: string, datos: DatosDeudaEditable): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { ...datos });
}

/** Nuevo saldo (p. ej. del extracto); desde ahora solo cuentan los pagos registrados después. */
export function actualizarSaldo(uid: string, id: string, saldoActual: number): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { saldoBase: saldoActual, saldoBaseEn: serverTimestamp() });
}

export function archivarDeuda(uid: string, id: string, archivada: boolean): Promise<void> {
  return updateDoc(doc(coleccion(uid), id), { archivada });
}
