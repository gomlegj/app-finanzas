import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import type { Categoria } from '../domain/categorias';
import type { Movimiento } from '../domain/movimientos';
import { escucharCategorias } from './categorias';
import { escucharMovimientosEntre } from './movimientos';
import { escucharPerfil, type Perfil } from './usuario';

interface Escucha<T> {
  datos: T;
  cargando: boolean;
}

/** Mantiene una suscripción de Firestore viva mientras `clave` no cambie. */
function useEscucha<T>(suscribir: (alCambiar: (datos: T) => void) => Unsubscribe, clave: string, inicial: T): Escucha<T> {
  const [estado, setEstado] = useState<Escucha<T>>({ datos: inicial, cargando: true });

  useEffect(() => {
    setEstado((previo) => ({ ...previo, cargando: true }));
    return suscribir((datos) => setEstado({ datos, cargando: false }));
    // `clave` resume todos los parámetros de `suscribir`.
  }, [clave]);

  return estado;
}

const SIN_DATOS: never[] = [];

export function usePerfil(uid: string): Escucha<Perfil | null> {
  return useEscucha<Perfil | null>((cb) => escucharPerfil(uid, cb), `perfil:${uid}`, null);
}

export function useCategorias(uid: string): Escucha<Categoria[]> {
  return useEscucha<Categoria[]>((cb) => escucharCategorias(uid, cb), `categorias:${uid}`, SIN_DATOS);
}

export function useMovimientosEntre(uid: string, desde: string, hasta: string): Escucha<Movimiento[]> {
  return useEscucha<Movimiento[]>(
    (cb) => escucharMovimientosEntre(uid, desde, hasta, cb),
    `movimientos:${uid}:${desde}:${hasta}`,
    SIN_DATOS,
  );
}
