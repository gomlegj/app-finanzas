import { signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, proveedorGoogle } from '../../lib/firebase';

export async function entrarConGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, proveedorGoogle);
  } catch (error) {
    // Algunos navegadores móviles bloquean ventanas emergentes: se usa redirección.
    if ((error as { code?: string }).code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, proveedorGoogle);
      return;
    }
    throw error;
  }
}

export function salir(): Promise<void> {
  return signOut(auth);
}
