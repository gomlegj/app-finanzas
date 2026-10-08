export interface SegmentoDona {
  id: string;
  valor: number;
  color: string;
  etiqueta: string;
}

interface Props {
  segmentos: readonly SegmentoDona[];
  centro: string;
  subcentro: string;
}

const RADIO = 40;
const GROSOR = 14;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
// ~2px de separación entre segmentos con la dona a 160px.
const SEPARACION = 1.2;

export function GraficaDona({ segmentos, centro, subcentro }: Props) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0);
  const separacion = segmentos.length > 1 ? SEPARACION : 0;
  const arcos = segmentos.reduce<{ segmento: SegmentoDona; largo: number; inicio: number }[]>((lista, s) => {
    const previo = lista[lista.length - 1];
    const inicio = previo ? previo.inicio + previo.largo : 0;
    lista.push({ segmento: s, largo: total > 0 ? (s.valor / total) * CIRCUNFERENCIA : 0, inicio });
    return lista;
  }, []);
  const porcentaje = (valor: number) => Math.round((valor / (total || 1)) * 100);
  const descripcion = segmentos.map((s) => `${s.etiqueta} ${porcentaje(s.valor)}%`).join(', ');

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Gasto por categoría: ${descripcion || 'sin gastos'}`}>
        <circle cx="50" cy="50" r={RADIO} fill="none" stroke="#e2e8f0" strokeWidth={GROSOR} />
        {arcos.map(({ segmento, largo, inicio }) => (
          <circle
            key={segmento.id}
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke={segmento.color}
            strokeWidth={GROSOR}
            strokeDasharray={`${Math.max(largo - separacion, 0)} ${CIRCUNFERENCIA}`}
            strokeDashoffset={-inicio}
          >
            <title>{`${segmento.etiqueta}: ${porcentaje(segmento.valor)}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold tabular-nums text-slate-900">{centro}</span>
        <span className="text-xs text-slate-500">{subcentro}</span>
      </div>
    </div>
  );
}
