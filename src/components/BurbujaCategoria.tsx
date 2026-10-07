interface Props {
  icono: string;
  color: string;
  grande?: boolean;
}

export function BurbujaCategoria({ icono, color, grande = false }: Props) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${grande ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg'}`}
      style={{ backgroundColor: `${color}22` }}
      aria-hidden="true"
    >
      {icono}
    </span>
  );
}
