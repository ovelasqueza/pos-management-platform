"use client";

import { useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora } from "@/lib/dominio/fechas";
import { nombreMetodo } from "@/lib/dominio/cobro";
import type { DatosTicket } from "@/lib/dominio/documentos";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

/** Abre el detalle (líneas) de una venta, con opción de reimprimir. */
export function DetalleVenta({ ventaId, numero }: { ventaId: string; numero: number }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const imprimir = useImprimir();
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string>();

  async function abrir() {
    setAbierto(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc("ticket_venta", { p_venta: ventaId });
    if (e || !data) setError("No se pudo cargar la venta");
    else setTicket(data as DatosTicket);
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Ver venta ${numero}`}
        onClick={abrir}
        className="inline-flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Eye size={18} />
      </button>
      <Modal abierto={abierto} titulo={`Venta #${numero}`} onCerrar={() => setAbierto(false)} ancho="sm">
        {error && <Aviso>{error}</Aviso>}
        {ticket && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-texto-3">
              {ticket.sede.nombre} · {ticket.cajero} · {formatearFechaHora(ticket.fecha)}
            </p>
            <ul className="divide-y divide-suave">
              {ticket.lineas.map((l) => (
                <li key={l.nombre} className="flex justify-between gap-2 py-2">
                  <span>
                    <span className="num font-semibold">{l.cantidad}</span> {l.nombre}
                  </span>
                  <span className="num">{formatearPesos(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-borde pt-2 text-lg font-bold">
              <span>Total · {nombreMetodo(ticket.metodo)}</span>
              <span className="num">{formatearPesos(ticket.total)}</span>
            </p>
            <Boton icono={<Printer size={18} aria-hidden />} onClick={() => imprimir({ tipo: "ticket", datos: ticket, copia: true })}>
              Reimprimir
            </Boton>
          </div>
        )}
      </Modal>
    </>
  );
}
