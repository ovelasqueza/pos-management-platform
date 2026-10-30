"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, Plus } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { formatearHora } from "@/lib/dominio/fechas";
import { esCodigo, mensajeDeError } from "@/lib/dominio/errores";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";

type Gasto = { id: string; monto: number; descripcion: string; creado_en: string; anulado_en: string | null };

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
  const [errores, setErrores] = useState<{ monto?: string; descripcion?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [anulando, setAnulando] = useState<Gasto | null>(null);

  const consultar = useCallback(
    () =>
      supabase
        .from("gastos")
        .select("id, monto, descripcion, creado_en, anulado_en")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false })
        .returns<Gasto[]>(),
    [supabase, turnoId],
  );

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultar>>) => {
    if (r.error) setErrores({ general: "No se pudieron cargar los gastos" });
    else setGastos(r.data);
  }, []);

  const cargar = () => consultar().then(aplicar);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    consultar().then((r) => vigente && aplicar(r));
    return () => {
      vigente = false;
    };
  }, [abierto, consultar, aplicar]);

  function manejarError(error: { message?: string }) {
    if (esCodigo(error, "TURNO_CERRADO")) {
      onTurnoCerrado();
      return;
    }
    if (esCodigo(error, "EFECTIVO_INSUFICIENTE")) setErrores({ monto: mensajeDeError(error) });
    else setErrores({ general: mensajeDeError(error, "No se pudo guardar. Revisa la conexión") });
  }

  async function registrar(e: FormEvent) {
    e.preventDefault();
    const valor = leerPesos(monto);
    const nuevos: typeof errores = {};
    if (valor === null) nuevos.monto = "Monto mayor que 0";
    if (!descripcion.trim()) nuevos.descripcion = "Escribe en qué se gastó";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || valor === null) return;

    setEnviando(true);
    const { error } = await supabase.rpc("registrar_gasto", { p_monto: valor, p_descripcion: descripcion.trim() });
    setEnviando(false);
    if (error) return manejarError(error);
    setMonto("");
    setDescripcion("");
    void cargar();
  }

  async function anular(g: Gasto) {
    setEnviando(true);
    const { error } = await supabase.rpc("anular_gasto", { p_gasto: g.id });
    setEnviando(false);
    setAnulando(null);
    if (error) return manejarError(error);
    void cargar();
  }

  const vigentes = gastos.filter((g) => !g.anulado_en);
  const total = vigentes.reduce((s, g) => s + g.monto, 0);

  return (
    <>
      <Modal abierto={abierto && !anulando} titulo="Gastos del turno" onCerrar={onCerrar} ancho="md">
        <div className="flex flex-col gap-4">
          <form onSubmit={registrar} className="flex flex-col gap-3">
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <Campo etiqueta="Monto" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} error={errores.monto} className="num" />
              <Campo etiqueta="Descripción" value={descripcion} maxLength={120} onChange={(e) => setDescripcion(e.target.value)} error={errores.descripcion} />
            </div>
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
                  <span className="num w-20 text-sm text-texto-3">{formatearHora(g.creado_en)}</span>
                  <span className="min-w-0 flex-1 truncate">{g.descripcion}</span>
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
