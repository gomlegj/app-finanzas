interface Props<T extends string | number> {
  etiqueta: string;
  valor: T;
  onCambio: (valor: T) => void;
  opciones: { valor: T; etiqueta: string }[];
}

export function Segmentado<T extends string | number>({ etiqueta, valor, onCambio, opciones }: Props<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-600">{etiqueta}</legend>
      <div
        className="grid gap-1 rounded-2xl bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
        role="radiogroup"
      >
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onCambio(opcion.valor)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                activa ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
