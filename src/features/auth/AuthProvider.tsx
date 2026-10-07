import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { asegurarPerfil } from '../../data/usuario';
import { auth } from '../../lib/firebase';
import { AuthContext, type EstadoAuth } from './contexto';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ usuario: null, cargando: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, (usuario) => {
        // No se bloquea la app esperando la red: con caché local abre al instante.
        setEstado({ usuario, cargando: false });
        if (usuario) {
          asegurarPerfil(usuario).catch((error) => console.error('No se pudo preparar el perfil', error));
        }
      }),
    [],
  );

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}
