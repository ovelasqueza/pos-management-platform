"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, RotateCw } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearHora } from "@/lib/dominio/fechas";
import { nombreMetodo, type MetodoPago } from "@/lib/dominio/cobro";
import type { DatosTicket } from "@/lib/dominio/documentos";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

type Venta = { id: string; numero: number; creado_en: string; total: number; metodo: MetodoPago };

export function PanelVentas({ abierto, turnoId, onCerrar }: { abierto: boolean; turnoId: string; onCerrar: () => void }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const imprimir = useImprimir();
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [error, setError] = useState<string>();
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);

  const consultar = useCallback(
    () =>
      supabase
        .from("ventas")
        .select("id, numero, creado_en, total, metodo")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false })
        .returns<Venta[]>(),
    [supabase, turnoId],
  );

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

  const total = ventas?.reduce((s, v) => s + v.total, 0) ?? 0;

  return (
    <Modal abierto={abierto} titulo="Ventas del turno" onCerrar={onCerrar} ancho="md">
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
              <span>{ventas.length} ventas</span>
              <span className="num font-semibold text-texto">{formatearPesos(total)}</span>
            </p>
            <ul className="max-h-[60vh] divide-y divide-suave overflow-y-auto">
              {ventas.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-1">
                  <span className="num w-14 font-semibold">#{v.numero}</span>
                  <span className="num w-24 shrink-0 text-sm whitespace-nowrap text-texto-3">{formatearHora(v.creado_en)}</span>
                  <span className="flex-1 text-sm text-texto-2">{nombreMetodo(v.metodo)}</span>
                  <span className="num font-semibold">{formatearPesos(v.total)}</span>
                  <button
                    type="button"
                    aria-label={`Reimprimir venta ${v.numero}`}
                    disabled={imprimiendo === v.id}
                    onClick={() => reimprimir(v.id)}
                    className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave disabled:opacity-50"
                  >
                    <Printer size={20} />
                  </button>
                </li>
              ))}
            </ul>
            {ventas.length === 0 && <p className="py-6 text-center text-texto-3">Aún no hay ventas</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
