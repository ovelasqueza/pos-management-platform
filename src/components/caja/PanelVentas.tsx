"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Ban, Printer, RotateCw } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearHora } from "@/lib/dominio/fechas";
import { nombreMetodo, type MetodoPago } from "@/lib/dominio/cobro";
import { esCodigo, esErrorDeRed, mensajeDeError } from "@/lib/dominio/errores";
import type { DatosTicket } from "@/lib/dominio/documentos";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

type Venta = {
  id: string;
  numero: number;
  creado_en: string;
  total: number;
  metodo: MetodoPago;
  /** Script 18; null si la venta está vigente */
  anulada_en?: string | null;
  motivo_anulacion?: string | null;
};

type Props = { abierto: boolean; turnoId: string; onCerrar: () => void; onTurnoCerrado: () => void };

export function PanelVentas({ abierto, turnoId, onCerrar, onTurnoCerrado }: Props) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const imprimir = useImprimir();
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [error, setError] = useState<string>();
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  const consultar = useCallback(async () => {
    const r = await supabase
      .from("ventas")
      .select("id, numero, creado_en, total, metodo, anulada_en, motivo_anulacion")
      .eq("turno_id", turnoId)
      .order("creado_en", { ascending: false })
      .returns<Venta[]>();
    // Respaldo mientras no se ejecute el script 18 (sin columnas de anulación)
    if (r.error?.code === "42703") {
      return supabase
        .from("ventas")
        .select("id, numero, creado_en, total, metodo")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false })
        .returns<Venta[]>();
    }
    return r;
  }, [supabase, turnoId]);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultar>>) => {
    if (r.error) setError("No se pudieron cargar las ventas");
    else {
      setError(undefined);
      setVentas(r.data);
    }
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

  async function reimprimir(id: string) {
    setImprimiendo(id);
    const { data, error: e } = await supabase.rpc("ticket_venta", { p_venta: id });
    setImprimiendo(null);
    if (e || !data) setError("No se pudo cargar el ticket");
    else imprimir({ tipo: "ticket", datos: data as DatosTicket, copia: true });
  }

  function pedirAnulacion(v: Venta) {
    setMotivo("");
    setErrorMotivo(undefined);
    setAnulando(v);
  }

  async function anular(e: FormEvent) {
    e.preventDefault();
    if (!anulando || enviandoRef.current) return;
    const texto = motivo.trim();
    if (!texto) return setErrorMotivo("Escribe el motivo");

    enviandoRef.current = true;
    setEnviando(true);
    try {
      const { data, error: err } = await supabase.rpc("anular_venta", { p_venta: anulando.id, p_motivo: texto });
      if (err) {
        if (esCodigo(err, "TURNO_CERRADO")) {
          setAnulando(null);
          return onTurnoCerrado();
        }
        const red = esErrorDeRed(err) || !navigator.onLine;
        return setErrorMotivo(red ? "Sin conexión. Intenta de nuevo" : mensajeDeError(err, "No se pudo anular"));
      }
      setAnulando(null);
      // Comprobante de la anulación: el ticket con la marca ANULADA y el motivo
      imprimir({ tipo: "ticket", datos: data as DatosTicket, copia: false });
      void cargar();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const vigentes = ventas?.filter((v) => !v.anulada_en) ?? [];
  const total = vigentes.reduce((s, v) => s + v.total, 0);
  const anuladas = (ventas?.length ?? 0) - vigentes.length;

  return (
    <>
      <Modal abierto={abierto && !anulando} titulo="Ventas del turno" onCerrar={onCerrar} ancho="md">
        <div className="flex flex-col gap-3">
          {error && (
            <Aviso
              accion={
                <Boton variante="secundario" icono={<RotateCw size={16} aria-hidden />} onClick={cargar}>
                  Reintentar
                </Boton>
              }
            >
              {error}
            </Aviso>
          )}
          {ventas && (
            <>
              <p className="flex justify-between text-sm text-texto-3">
                <span>
                  {vigentes.length} ventas{anuladas > 0 && ` · ${anuladas} anuladas`}
                </span>
                <span className="num font-semibold text-texto">{formatearPesos(total)}</span>
              </p>
              <ul className="max-h-[60vh] divide-y divide-suave overflow-y-auto">
                {ventas.map((v) => (
                  <li key={v.id} className={`flex items-center gap-3 py-1 ${v.anulada_en ? "text-texto-3" : ""}`}>
                    <span className={`num w-14 font-semibold ${v.anulada_en ? "line-through" : ""}`}>#{v.numero}</span>
                    <span className="num w-24 shrink-0 text-sm whitespace-nowrap text-texto-3">{formatearHora(v.creado_en)}</span>
                    <span className="min-w-0 flex-1 text-sm text-texto-2">
                      {nombreMetodo(v.metodo)}
                      {v.anulada_en && (
                        <span className="block truncate text-xs text-peligro" title={v.motivo_anulacion ?? undefined}>
                          Anulada · {v.motivo_anulacion}
                        </span>
                      )}
                    </span>
                    <span className={`num font-semibold ${v.anulada_en ? "line-through" : ""}`}>{formatearPesos(v.total)}</span>
                    <button
                      type="button"
                      aria-label={`Reimprimir venta ${v.numero}`}
                      disabled={imprimiendo === v.id}
                      onClick={() => reimprimir(v.id)}
                      className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave disabled:opacity-50"
                    >
                      <Printer size={20} />
                    </button>
                    {v.anulada_en === null ? (
                      <button
                        type="button"
                        aria-label={`Anular venta ${v.numero}`}
                        onClick={() => pedirAnulacion(v)}
                        className="flex size-12 items-center justify-center rounded-control text-peligro hover:bg-peligro-suave"
                      >
                        <Ban size={18} />
                      </button>
                    ) : (
                      <span className="w-12" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
              {ventas.length === 0 && <p className="py-6 text-center text-texto-3">Aún no hay ventas</p>}
            </>
          )}
        </div>
      </Modal>

      <Modal abierto={Boolean(anulando)} titulo="Anular venta" onCerrar={() => setAnulando(null)} ancho="sm">
        {anulando && (
          <form onSubmit={anular} className="flex flex-col gap-4">
            <p>
              ¿Anular la venta <strong className="num">#{anulando.numero}</strong> por{" "}
              <strong className="num">{formatearPesos(anulando.total)}</strong> ({nombreMetodo(anulando.metodo)})?
            </p>
            <Campo
              etiqueta="Motivo"
              value={motivo}
              maxLength={120}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErrorMotivo(undefined);
              }}
              error={errorMotivo}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Boton type="button" onClick={() => setAnulando(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="peligro" disabled={enviando}>
                {enviando ? "Anulando…" : "Anular"}
              </Boton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
