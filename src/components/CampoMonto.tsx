import { actualizarTextoMonto } from '../domain/dinero';
import { MensajeError } from './MensajeError';

interface Props {
  etiqueta: string;
  valor: string;
  onCambio: (texto: string) => void;
  error?: string;
}

export function CampoMonto({ etiqueta, valor, onCambio, error }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</span>
      <div className="flex items-baseline gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-slate-400">$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={valor}
          onChange={(e) => onCambio(actualizarTextoMonto(e.target.value))}
          className="w-full min-w-0 bg-transparent tabular-nums outline-none"
        />
      </div>
      <MensajeError mensaje={error} />
    </label>
  );
}
