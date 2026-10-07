import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface EstadoAuth {
  usuario: User | null;
  cargando: boolean;
}

export const AuthContext = createContext<EstadoAuth>({ usuario: null, cargando: true });

export const useAuth = () => useContext(AuthContext);

export function useUsuario(): User {
  const { usuario } = useAuth();
  if (!usuario) throw new Error('useUsuario se usó fuera de una ruta con sesión');
  return usuario;
}
