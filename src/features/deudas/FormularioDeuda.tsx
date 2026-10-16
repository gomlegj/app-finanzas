import { useState, type FormEvent } from 'react';
import { Archive } from 'lucide-react';
import { CampoMonto } from '../../components/CampoMonto';
import { MensajeError } from '../../components/MensajeError';
import { Segmentado } from '../../components/Segmentado';
import { useToast } from '../../components/toastContexto';
import { actualizarDeuda, archivarDeuda, crearDeuda } from '../../data/deudas';
import {
  ETIQUETA_TIPO_DEUDA,
  MAX_NOMBRE_DEUDA,
  normalizarDeuda,
  validarDeuda,
  type Deuda,
  type ErroresDeuda,
  type TipoDeuda,
} from '../../domain/deudas';
import { agruparMiles, parsearMonto } from '../../domain/dinero';
import { useUsuario } from '../auth/contexto';

const TIPOS: TipoDeuda[] = ['tarjeta', 'prestamo', 'otro'];

export function FormularioDeuda({ deuda, onListo }: { deuda?: Deuda; onListo: () => void }) {
  const usuario = useUsuario();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(deuda?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoDeuda>(deuda?.tipo ?? 'tarjeta');
  const [saldoTexto, setSaldoTexto] = useState('');
  const [cuotaTexto, setCuotaTexto] = useState(deuda ? agruparMiles(String(deuda.cuota)) : '');
  const [diaTexto, setDiaTexto] = useState(deuda ? String(deuda.diaPago) : '');
  const [errores, setErrores] = useState<ErroresDeuda>({});

  function guardar(e: FormEvent) {
    e.preventDefault();
    const formulario = {
      nombre,
      tipo,
      saldo: parsearMonto(saldoTexto),
      cuota: parsearMonto(cuotaTexto),
      diaPago: diaTexto === '' ? null : Number(diaTexto),
    };
    const encontrados = validarDeuda(formulario, { creando: !deuda });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const datos = normalizarDeuda(formulario);
    const operacion = deuda
      ? actualizarDeuda(usuario.uid, deuda.id, datos)
      : crearDeuda(usuario.uid, datos, formulario.saldo ?? 0);
    // No se espera: sin conexión la promesa solo se resuelve al sincronizar.
    operacion.catch(() => mostrar('No se pudo guardar la deuda', 'error'));
    mostrar(deuda ? 'Deuda actualizada' : 'Deuda creada');
    onListo();
  }

  function archivar() {
    if (!deuda) return;
    archivarDeuda(usuario.uid, deuda.id, true).catch(() => mostrar('No se pudo archivar la deuda', 'error'));
    mostrar('Deuda archivada');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Nombre</span>
        <input
          value={nombre}
          maxLength={MAX_NOMBRE_DEUDA}
          placeholder="Ej. Visa, Préstamo carro"
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        />
        <MensajeError mensaje={errores.nombre} />
      </label>

      <Segmentado
        etiqueta="Tipo"
        valor={tipo}
        onCambio={setTipo}
        opciones={TIPOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_DEUDA[t] }))}
      />

      {!deuda && <CampoMonto etiqueta="Saldo actual" valor={saldoTexto} onCambio={setSaldoTexto} error={errores.saldo} />}
      <CampoMonto etiqueta="Cuota" valor={cuotaTexto} onCambio={setCuotaTexto} error={errores.cuota} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Día de pago</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej. 5"
          value={diaTexto}
          onChange={(e) => setDiaTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 tabular-nums"
        />
        <MensajeError mensaje={errores.diaPago} />
      </label>

      {deuda && <p className="text-sm text-slate-500">Para cambiar el saldo usa "Actualizar saldo" en la tarjeta.</p>}

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98]"
      >
        Guardar
      </button>

      {deuda && (
        <button
          type="button"
          onClick={archivar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-slate-500 hover:bg-slate-100"
        >
          <Archive size={18} />
          Archivar deuda
        </button>
      )}
    </form>
  );
}
