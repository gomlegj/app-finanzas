import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { MensajeError } from '../../components/MensajeError';
import { useToast } from '../../components/toastContexto';
import { usePerfil } from '../../data/hooks';
import { actualizarPerfil, type Perfil } from '../../data/usuario';
import { MONEDAS_DISPONIBLES } from '../../domain/dinero';
import { DIAS_PAGO_POR_DEFECTO, etiquetaQuincena, ordenarDiasPago, quincenaDe, validarDiasPago } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';

export function QuincenasPage() {
  const usuario = useUsuario();
  const { datos: perfil, cargando, error } = usePerfil(usuario.uid);

  return (
    <div className="space-y-4">
      <Link to="/ajustes" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft size={16} />
        Ajustes
      </Link>
      <h2 className="text-lg font-semibold text-slate-900">Quincenas y moneda</h2>
      {cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : error ? (
        // Sin el perfil real no se muestra el formulario: guardar los valores por defecto sobrescribiría tus ajustes.
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus ajustes. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : (
        <Formulario key={usuario.uid} perfil={perfil} />
      )}
    </div>
  );
}

function Formulario({ perfil }: { perfil: Perfil | null }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [inicial1, inicial2] = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const [dia1, setDia1] = useState(String(inicial1));
  const [dia2, setDia2] = useState(String(inicial2));
  const [moneda, setMoneda] = useState(perfil?.moneda ?? 'COP');
  const [error, setError] = useState<string | null>(null);

  const d1 = Number(dia1);
  const d2 = Number(dia2);
  const problema = validarDiasPago(d1, d2);
  const vista = problema ? null : quincenaDe(new Date(), [d1, d2]);

  function guardar(e: FormEvent) {
    e.preventDefault();
    setError(problema);
    if (problema) return;
    actualizarPerfil(usuario.uid, { diasPago: ordenarDiasPago([d1, d2]), moneda }).catch(() =>
      mostrar('No se pudieron guardar los ajustes', 'error'),
    );
    mostrar('Ajustes guardados');
  }

  return (
    <form onSubmit={guardar} className="space-y-5 rounded-2xl bg-white p-4 shadow-sm" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">¿Qué días te pagan?</legend>
        <div className="grid grid-cols-2 gap-3">
          {[
            { valor: dia1, cambiar: setDia1, etiqueta: 'Primer pago' },
            { valor: dia2, cambiar: setDia2, etiqueta: 'Segundo pago' },
          ].map((campo) => (
            <label key={campo.etiqueta} className="block">
              <span className="mb-1 block text-xs text-slate-500">{campo.etiqueta}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={campo.valor}
                onChange={(e) => campo.cambiar(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-lg font-semibold"
              />
            </label>
          ))}
        </div>
        <MensajeError mensaje={error ?? undefined} />
        <p className="mt-2 text-sm text-slate-500">
          {vista ? (
            <>
              Tu quincena actual sería <strong className="text-slate-700">{etiquetaQuincena(vista)}</strong>.
            </>
          ) : (
            'Si el mes no tiene ese día, se usa el último día del mes.'
          )}
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Moneda</span>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          {MONEDAS_DISPONIBLES.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nombre} ({m.codigo})
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>
    </form>
  );
}
