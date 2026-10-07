import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { asegurarPerfil } from '../../data/usuario';
import { auth } from '../../lib/firebase';
import { AuthContext, type EstadoAuth } from './contexto';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ usuario: null, cargando: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (usuario) => {
        if (usuario) {
          try {
            await asegurarPerfil(usuario);
          } catch (error) {
            console.error('No se pudo preparar el perfil', error);
          }
        }
        setEstado({ usuario, cargando: false });
      }),
    [],
  );

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}
