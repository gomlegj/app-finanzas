import { createContext, useContext } from 'react';

export type TipoToast = 'exito' | 'error';

export interface ContextoToast {
  mostrar: (mensaje: string, tipo?: TipoToast) => void;
}

export const ToastContext = createContext<ContextoToast>({ mostrar: () => {} });

export const useToast = () => useContext(ToastContext);
