import { COLORES_DISPONIBLES, ICONOS_DISPONIBLES } from '../domain/categorias';

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
}

export function SelectorIcono({ valor, onCambio }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">Ícono</legend>
      <div className="grid grid-cols-7 gap-2">
        {ICONOS_DISPONIBLES.map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={opcion === valor}
            onClick={() => onCambio(opcion)}
            className={`flex h-10 items-center justify-center rounded-xl text-xl ${
              opcion === valor ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-slate-100'
            }`}
          >
            {opcion}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectorColor({ valor, onCambio }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">Color</legend>
      <div className="grid grid-cols-8 gap-2">
        {COLORES_DISPONIBLES.map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-label={`Color ${opcion}`}
            aria-pressed={opcion === valor}
            onClick={() => onCambio(opcion)}
            className={`h-8 w-8 rounded-full ${opcion === valor ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
            style={{ backgroundColor: opcion }}
          />
        ))}
      </div>
    </fieldset>
  );
}
