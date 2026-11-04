"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Ban, Eye, Printer } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora } from "@/lib/dominio/fechas";
import { nombreMetodo } from "@/lib/dominio/cobro";
import { esConsumidorFinal } from "@/lib/dominio/cliente";
import type { DatosTicket } from "@/lib/dominio/documentos";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

/** Fila etiqueta / valor del encabezado de la venta. */
function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3">
      <dt className="text-texto-3">{etiqueta}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

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

  const anulada = Boolean(ticket?.anulada_en);

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
      <Modal abierto={abierto} titulo={`Venta #${numero}`} onCerrar={() => setAbierto(false)} ancho="md">
        {error && <Aviso>{error}</Aviso>}
        {!ticket && !error && <p className="py-6 text-center text-texto-3">Cargando…</p>}
        {ticket && (
          <div className="flex flex-col gap-5">
            <dl className="flex flex-col gap-2 text-sm">
              <Dato etiqueta="Sede">{ticket.sede.nombre}</Dato>
              <Dato etiqueta="Cajero">{ticket.cajero}</Dato>
              <Dato etiqueta="Fecha de venta">
                <span className="num">{formatearFechaHora(ticket.fecha)}</span>
              </Dato>
              <Dato etiqueta="Pago">{nombreMetodo(ticket.metodo)}</Dato>
              {ticket.cliente && !esConsumidorFinal(ticket.cliente) && (
                <Dato etiqueta="Cliente">
                  {ticket.cliente.nombre} · <span className="num">{ticket.cliente.tipo} {ticket.cliente.documento}</span>
                </Dato>
              )}
            </dl>

            {anulada && (
              <section className="flex flex-col gap-2 rounded-tarjeta border border-peligro/40 bg-peligro-suave p-4 text-sm">
                <p className="flex items-center gap-2 font-bold text-peligro">
                  <Ban size={18} aria-hidden /> VENTA ANULADA
                </p>
                <dl className="flex flex-col gap-2 text-texto">
                  <Dato etiqueta="Anulada">
                    <span className="num">{formatearFechaHora(ticket.anulada_en!)}</span>
                  </Dato>
                  <Dato etiqueta="Motivo">{ticket.motivo_anulacion}</Dato>
                </dl>
              </section>
            )}

            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-texto-3">Productos</h3>
              <ul className="divide-y divide-suave rounded-tarjeta border border-borde">
                {ticket.lineas.map((l) => (
                  <li key={l.nombre} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-medium break-words">{l.nombre}</span>
                      <span className="num text-sm text-texto-3">
                        {l.cantidad} × {formatearPesos(l.precio)}
                      </span>
                    </span>
                    <span className="num shrink-0 font-semibold">{formatearPesos(l.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="flex items-center justify-between border-t border-borde pt-4 text-lg font-bold">
              <span>Total</span>
              <span className={`num text-2xl ${anulada ? "text-texto-3 line-through" : ""}`}>{formatearPesos(ticket.total)}</span>
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
