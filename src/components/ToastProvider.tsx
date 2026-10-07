import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type TipoToast } from './toastContexto';

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const mostrar = useCallback((mensaje: string, tipo: TipoToast = 'exito') => {
    setToast({ id: Date.now(), mensaje, tipo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const temporizador = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(temporizador);
  }, [toast]);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.tipo === 'error' ? 'bg-rose-600' : 'bg-slate-900'
          }`}
        >
          {toast.mensaje}
        </div>
      )}
    </ToastContext.Provider>
  );
}
