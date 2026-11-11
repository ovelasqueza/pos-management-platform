"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Ban, Inbox, Landmark, Plus } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { formatearHora } from "@/lib/dominio/fechas";
import { esCodigo, mensajeDeError } from "@/lib/dominio/errores";
import { nombreMetodo, type MetodoPago } from "@/lib/dominio/cobro";
import {
  ORIGENES,
  PARTES_PARA_GASTOS,
  describirOrigen,
  leerSaldo,
  origenDeGasto,
  parteSinSaldo,
  repartirGasto,
  sumaPartes,
  type OrigenGasto,
  type PartesMayor,
  type SaldoCajaMayor as Saldo,
} from "@/lib/dominio/cajaMayor";
import { Opciones } from "@/components/ui/Opciones";
import { SaldoCajaMayor } from "./SaldoCajaMayor";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";

type Gasto = {
  id: string;
  monto: number;
  monto_caja: number;
  monto_mayor: number;
  mayor_efectivo: number;
  mayor_transferencia: number;
  mayor_tarjeta: number;
  descripcion: string;
  creado_en: string;
  anulado_en: string | null;
};

type TextosPartes = Record<MetodoPago, string>;
const PARTES_VACIAS: TextosPartes = { efectivo: "", transferencia: "", tarjeta: "" };

/** Monto con puntos de miles mientras se escribe: 25000 → 25.000 */
const conMiles = (texto: string) => {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9);
  return digitos ? new Intl.NumberFormat("es-CO").format(Number(digitos)) : "";
};

/** Campo vacío = 0 */
const leerPartes = (t: TextosPartes): PartesMayor => ({
  efectivo: leerPesos(t.efectivo, 0) ?? 0,
  transferencia: leerPesos(t.transferencia, 0) ?? 0,
  tarjeta: leerPesos(t.tarjeta, 0) ?? 0,
});

type Props = {
  abierto: boolean;
  turnoId: string;
  onCerrar: () => void;
  onTurnoCerrado: () => void;
};

export function PanelGastos({ abierto, turnoId, onCerrar, onTurnoCerrado }: Props) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [origen, setOrigen] = useState<OrigenGasto>("caja");
  const [partes, setPartes] = useState<TextosPartes>(PARTES_VACIAS);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [errores, setErrores] = useState<{ monto?: string; descripcion?: string; mayor?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [anulando, setAnulando] = useState<Gasto | null>(null);

  const consultar = useCallback(
    () =>
      supabase
        .from("gastos")
        .select("id, monto, monto_caja, monto_mayor, mayor_efectivo, mayor_transferencia, mayor_tarjeta, descripcion, creado_en, anulado_en")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false })
        .returns<Gasto[]>(),
    [supabase, turnoId],
  );

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultar>>) => {
    if (r.error) setErrores({ general: "No se pudieron cargar los gastos" });
    else setGastos(r.data);
  }, []);

  const cargarSaldo = useCallback(
    () =>
      supabase.rpc("caja_mayor_saldo").then(({ data, error }) => {
        if (!error) setSaldo(leerSaldo(data));
      }),
    [supabase],
  );

  const cargar = () => Promise.all([consultar().then(aplicar), cargarSaldo()]);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    consultar().then((r) => vigente && aplicar(r));
    void cargarSaldo();
    return () => {
      vigente = false;
    };
  }, [abierto, consultar, aplicar, cargarSaldo]);

  function manejarError(error: { message?: string }) {
    if (esCodigo(error, "TURNO_CERRADO")) {
      onTurnoCerrado();
      return;
    }
    if (esCodigo(error, "EFECTIVO_INSUFICIENTE")) setErrores({ monto: mensajeDeError(error) });
    else if (esCodigo(error, "CAJA_MAYOR_INSUFICIENTE")) {
      setErrores({ mayor: mensajeDeError(error) });
      void cargarSaldo();
    } else setErrores({ general: mensajeDeError(error, "No se pudo guardar. Revisa la conexión") });
  }

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    const valor = leerPesos(monto);
    const nuevos: typeof errores = {};
    if (valor === null) nuevos.monto = "Monto mayor que 0";
    if (!descripcion.trim()) nuevos.descripcion = "Escribe en qué se gastó";
    const reparto = valor === null ? null : repartirGasto(valor, origen, leerPartes(partes));
    if (reparto && !reparto.ok) nuevos.mayor = reparto.error;
    else if (reparto?.ok && saldo) {
      const sinSaldo = parteSinSaldo(reparto.mayor, saldo);
      if (sinSaldo) nuevos.mayor = `No hay suficiente en ${nombreMetodo(sinSaldo)}`;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || valor === null || !reparto?.ok) return;

    enviandoRef.current = true;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("registrar_gasto", {
        p_monto: valor,
        p_descripcion: descripcion.trim(),
        p_mayor_efectivo: reparto.mayor.efectivo,
        p_mayor_transferencia: reparto.mayor.transferencia,
        p_mayor_tarjeta: reparto.mayor.tarjeta,
      });
      if (error) return manejarError(error);
      setMonto("");
      setDescripcion("");
      setPartes(PARTES_VACIAS);
      setOrigen("caja");
      void cargar();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  async function anular(g: Gasto) {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("anular_gasto", { p_gasto: g.id });
      setAnulando(null);
      if (error) return manejarError(error);
      void cargar();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const vigentes = gastos.filter((g) => !g.anulado_en);
  const total = vigentes.reduce((s, g) => s + g.monto, 0);
  const valorMonto = leerPesos(monto);
  const sumaMayor = sumaPartes(leerPartes(partes));
  const cajon = valorMonto !== null && sumaMayor > 0 && sumaMayor < valorMonto ? valorMonto - sumaMayor : null;
  // En "Caja mayor": cuánto falta o sobra para completar el monto
  const pendiente = valorMonto === null ? null : valorMonto - sumaMayor;

  return (
    <>
      <Modal abierto={abierto && !anulando} titulo="Gastos del turno" onCerrar={onCerrar} ancho="md">
        <div className="flex flex-col gap-4">
          <SaldoCajaMayor saldo={saldo} cargando />
          <form onSubmit={registrar} className="flex flex-col gap-3">
            <div className="grid grid-cols-[11rem_1fr] gap-2">
              <Campo
                etiqueta="Monto"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                icono={<span className="num text-base font-semibold text-texto-2">$</span>}
                value={monto}
                onChange={(e) => setMonto(conMiles(e.target.value))}
                error={errores.monto}
                className="num text-right text-lg font-semibold"
                autoFocus
              />
              <Campo
                etiqueta="Descripción"
                value={descripcion}
                maxLength={120}
                onChange={(e) => setDescripcion(e.target.value)}
                error={errores.descripcion}
              />
            </div>
            <Opciones etiqueta="Sale de" opciones={ORIGENES} valor={origen} onCambiar={setOrigen} />

            {origen !== "caja" && (
              <fieldset className="flex flex-col gap-2 rounded-tarjeta border border-borde-activo p-3">
                <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-texto-2">
                  <Landmark size={16} aria-hidden /> De caja mayor
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {PARTES_PARA_GASTOS.map((m) => (
                    <div key={m.valor} className="flex flex-col gap-0.5">
                      <Campo
                        etiqueta={m.nombre}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={partes[m.valor]}
                        onChange={(e) => setPartes((p) => ({ ...p, [m.valor]: conMiles(e.target.value) }))}
                        className="num px-2 text-right font-semibold"
                      />
                      <span className="num text-right text-xs text-texto-3">
                        Hay {saldo ? formatearPesos(saldo[m.valor]) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                {origen === "mayor" && pendiente !== null && pendiente !== 0 && !errores.mayor && (
                  <p className="text-sm text-advertencia">
                    {pendiente > 0 ? `Faltan ${formatearPesos(pendiente)}` : `Sobran ${formatearPesos(-pendiente)}`}
                  </p>
                )}
                {errores.mayor && <p className="text-sm text-peligro">{errores.mayor}</p>}
              </fieldset>
            )}

            {origen === "ambas" && (
              <div className="flex items-center justify-between rounded-tarjeta border border-borde-activo bg-suave px-4 py-3">
                <span className="flex items-center gap-1.5 font-semibold text-texto-2">
                  <Inbox size={18} aria-hidden /> Cajón
                </span>
                <span className="num text-lg font-semibold">{cajon === null ? "—" : formatearPesos(cajon)}</span>
              </div>
            )}

            <Boton type="submit" variante="primario" disabled={enviando} icono={<Plus size={20} aria-hidden />}>
              Registrar gasto
            </Boton>
          </form>

          {errores.general && <Aviso>{errores.general}</Aviso>}

          <div>
            <p className="mb-1 flex justify-between text-sm text-texto-3">
              <span>{vigentes.length} gastos</span>
              <span className="num font-semibold text-texto">{formatearPesos(total)}</span>
            </p>
            <ul className="max-h-[40vh] divide-y divide-suave overflow-y-auto">
              {gastos.map((g) => (
                <li key={g.id} className={`flex items-center gap-3 py-1 ${g.anulado_en ? "text-texto-3 line-through" : ""}`}>
                  <span className="num w-24 shrink-0 text-sm whitespace-nowrap text-texto-3">{formatearHora(g.creado_en)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{g.descripcion}</span>
                    {origenDeGasto(g) !== "caja" && (
                      <span className="flex items-center gap-1 text-xs text-texto-3">
                        <Landmark size={12} aria-hidden /> {describirOrigen(g)}
                      </span>
                    )}
                  </span>
                  <span className="num font-semibold">{formatearPesos(g.monto)}</span>
                  {g.anulado_en ? (
                    <span className="w-12 text-center text-xs no-underline">Anulado</span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Anular gasto ${g.descripcion}`}
                      onClick={() => setAnulando(g)}
                      className="flex size-12 items-center justify-center rounded-control text-peligro hover:bg-peligro-suave"
                    >
                      <Ban size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {gastos.length === 0 && <p className="py-4 text-center text-texto-3">Sin gastos</p>}
          </div>
        </div>
      </Modal>

      <Modal abierto={Boolean(anulando)} titulo="Anular gasto" onCerrar={() => setAnulando(null)} ancho="sm">
        {anulando && (
          <div className="flex flex-col gap-4">
            <p>
              ¿Anular <strong>{anulando.descripcion}</strong> por <strong className="num">{formatearPesos(anulando.monto)}</strong>?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Boton onClick={() => setAnulando(null)}>Cancelar</Boton>
              <Boton variante="peligro" disabled={enviando} onClick={() => anular(anulando)}>
                Anular
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
