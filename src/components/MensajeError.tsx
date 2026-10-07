export function MensajeError({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="mt-1 text-sm text-rose-600">{mensaje}</p> : null;
}
