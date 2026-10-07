import type { TipoCategoria } from '../domain/categorias';

const OPCIONES: { valor: TipoCategoria; etiqueta: string }[] = [
  { valor: 'gasto', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];

interface Props {
  valor: TipoCategoria;
  onCambio: (tipo: TipoCategoria) => void;
}

export function SelectorTipo({ valor, onCambio }: Props) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup">
      {OPCIONES.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambio(opcion.valor)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              activa
                ? opcion.valor === 'gasto'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
