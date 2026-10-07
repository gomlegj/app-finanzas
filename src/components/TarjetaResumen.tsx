interface Props {
  etiqueta: string;
  valor: string;
  colorValor: string;
}

export function TarjetaResumen({ etiqueta, valor, colorValor }: Props) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colorValor}`}>{valor}</p>
    </div>
  );
}
