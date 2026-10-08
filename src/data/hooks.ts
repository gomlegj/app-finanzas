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
  error: boolean;
}

type Suscribir<T> = (alCambiar: (datos: T) => void, alFallar: () => void) => Unsubscribe;

/** Mantiene una suscripción de Firestore viva mientras `clave` no cambie. */
function useEscucha<T>(suscribir: Suscribir<T>, clave: string, inicial: T): Escucha<T> {
  const [estado, setEstado] = useState<Escucha<T>>({ datos: inicial, cargando: true, error: false });

  useEffect(() => {
    // Se descartan los datos anteriores: evita mostrar totales de otro periodo bajo el título nuevo.
    setEstado({ datos: inicial, cargando: true, error: false });
    return suscribir(
      (datos) => setEstado({ datos, cargando: false, error: false }),
      () => setEstado((previo) => ({ ...previo, cargando: false, error: true })),
    );
    // `clave` resume todos los parámetros de `suscribir`.
  }, [clave]);

  return estado;
}

const SIN_DATOS: never[] = [];

export function usePerfil(uid: string): Escucha<Perfil | null> {
  return useEscucha<Perfil | null>((cb, falla) => escucharPerfil(uid, cb, falla), `perfil:${uid}`, null);
}

export function useCategorias(uid: string): Escucha<Categoria[]> {
  return useEscucha<Categoria[]>((cb, falla) => escucharCategorias(uid, cb, falla), `categorias:${uid}`, SIN_DATOS);
}

export function useMovimientosEntre(uid: string, desde: string, hasta: string): Escucha<Movimiento[]> {
  return useEscucha<Movimiento[]>(
    (cb, falla) => escucharMovimientosEntre(uid, desde, hasta, cb, falla),
    `movimientos:${uid}:${desde}:${hasta}`,
    SIN_DATOS,
  );
}
