import { useState } from 'react';
import { ArchiveRestore, ChevronDown } from 'lucide-react';
import { BurbujaCategoria } from '../../components/BurbujaCategoria';
import { HojaInferior } from '../../components/HojaInferior';
import { useToast } from '../../components/toastContexto';
import { archivarMeta } from '../../data/metas';
import { useMetas, useMovimientosDeMetas, usePerfil } from '../../data/hooks';
import { abonadoEnQuincena, ahorrado, cuotaDeQuincena, fechaEstimada, type Meta } from '../../domain/metas';
import { DIAS_PAGO_POR_DEFECTO, quincenaDe } from '../../domain/quincena';
import { useUsuario } from '../auth/contexto';
import { RegistroRapido, type Prellenado } from '../movimientos/RegistroRapido';
import { FormularioMeta } from './FormularioMeta';
import { prellenadoAbono, prellenadoRetiro } from './prellenados';
import { TarjetaMeta } from './TarjetaMeta';

const porNombre = (a: Meta, b: Meta) => a.nombre.localeCompare(b.nombre, 'es');

export function MetasPage() {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const { datos: perfil } = usePerfil(usuario.uid);
  const metas = useMetas(usuario.uid);
  const movimientos = useMovimientosDeMetas(usuario.uid);
  const [editando, setEditando] = useState<Meta | 'nueva' | null>(null);
  const [registro, setRegistro] = useState<Prellenado | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);

  const moneda = perfil?.moneda ?? 'COP';
  const diasPago = perfil?.diasPago ?? DIAS_PAGO_POR_DEFECTO;
  const quincena = quincenaDe(new Date(), diasPago);
  const anteriores = movimientos.datos.filter((m) => m.fecha < quincena.desde);
  const activas = metas.datos.filter((m) => !m.archivada).sort(porNombre);
  const archivadas = metas.datos.filter((m) => m.archivada).sort(porNombre);
  const ahorradoAlInicio = (m: Meta) => ahorrado(m, anteriores);
  // Solo movimientos (sin ahorro inicial): el formulario suma el ahorro inicial que se esté editando.
  const movidoAntes = (m: Meta) => ahorrado({ id: m.id, ahorroInicial: 0 }, anteriores);

  function restaurar(meta: Meta) {
    archivarMeta(usuario.uid, meta.id, false).catch(() => mostrar('No se pudo restaurar la meta', 'error'));
    mostrar('Meta restaurada');
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Metas de ahorro</h2>

      {metas.error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
          No se pudieron cargar tus metas. Revisa tu conexión.
        </p>
      ) : metas.cargando || movimientos.cargando ? (
        <p className="py-6 text-center text-slate-400">Cargando…</p>
      ) : activas.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
          Aún no tienes metas. ¿Para qué quieres ahorrar? 🐿️
        </div>
      ) : (
        activas.map((m) => {
          const total = ahorrado(m, movimientos.datos);
          const alInicio = ahorradoAlInicio(m);
          const cuota = cuotaDeQuincena(m, alInicio, quincena, diasPago);
          const abonado = abonadoEnQuincena(m, movimientos.datos, quincena);
          return (
            <TarjetaMeta
              key={m.id}
              meta={m}
              ahorrado={total}
              cuota={cuota}
              abonadoEnQuincena={abonado}
              fechaEstimada={fechaEstimada(m, alInicio, quincena, diasPago)}
              moneda={moneda}
              sinDatos={movimientos.error}
              // Si ya abonó algo esta quincena, se sugiere solo lo que falta para no abonar dos veces.
              onAbonar={() => setRegistro(prellenadoAbono(m, Math.max(0, cuota - abonado)))}
              onRetirar={() => setRegistro(prellenadoRetiro(m, total, moneda))}
              onEditar={() => setEditando(m)}
            />
          );
        })
      )}

      <button
        type="button"
        onClick={() => setEditando('nueva')}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-3 font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
      >
        + Nueva meta
      </button>

      {archivadas.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setVerArchivadas((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1 text-sm font-medium text-slate-500"
          >
            Archivadas ({archivadas.length})
            <ChevronDown size={16} className={verArchivadas ? 'rotate-180' : ''} />
          </button>
          {verArchivadas && (
            <ul className="rounded-2xl bg-white p-1 shadow-sm">
              {archivadas.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-2 py-2.5">
                  <BurbujaCategoria icono={m.icono} color={m.color} />
                  <span className="flex-1 text-slate-500">{m.nombre}</span>
                  <button
                    type="button"
                    onClick={() => restaurar(m)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    <ArchiveRestore size={16} />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HojaInferior
        abierta={editando !== null}
        titulo={editando === 'nueva' ? 'Nueva meta' : 'Editar meta'}
        onCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioMeta
            key={editando === 'nueva' ? 'nueva' : editando.id}
            meta={editando === 'nueva' ? undefined : editando}
            movidoAntes={editando === 'nueva' ? undefined : movidoAntes(editando)}
            diasPago={diasPago}
            moneda={moneda}
            onListo={() => setEditando(null)}
          />
        )}
      </HojaInferior>

      <RegistroRapido abierta={registro !== null} prellenado={registro ?? undefined} onCerrar={() => setRegistro(null)} />
    </div>
  );
}
