import { useState, type FormEvent } from 'react';
import { CampoMonto } from '../../components/CampoMonto';
import { useToast } from '../../components/toastContexto';
import { actualizarSaldo } from '../../data/deudas';
import { validarSaldo, type Deuda } from '../../domain/deudas';
import { agruparMiles, parsearMonto } from '../../domain/dinero';
import { useUsuario } from '../auth/contexto';

export function ActualizarSaldo({ deuda, saldoActual, onListo }: { deuda: Deuda; saldoActual: number; onListo: () => void }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [texto, setTexto] = useState(agruparMiles(String(saldoActual)));
  const [error, setError] = useState<string | null>(null);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(texto);
    const problema = validarSaldo(monto);
    setError(problema);
    if (problema || monto === null) return;
    actualizarSaldo(usuario.uid, deuda.id, monto).catch(() => mostrar('No se pudo actualizar el saldo', 'error'));
    mostrar('Saldo actualizado');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <p className="text-sm text-slate-600">
        Copia el saldo de tu extracto. Desde ahora solo se restarán los pagos que registres después.
      </p>
      <CampoMonto etiqueta="Saldo actual" valor={texto} onCambio={setTexto} error={error ?? undefined} />
      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>
    </form>
  );
}
