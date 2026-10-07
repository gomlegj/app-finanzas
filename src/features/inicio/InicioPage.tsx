import { useUsuario } from '../auth/contexto';

export function InicioPage() {
  const usuario = useUsuario();
  return <p className="text-slate-500">Hola, {usuario.displayName?.split(' ')[0] ?? ''} 👋</p>;
}
