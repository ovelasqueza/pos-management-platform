"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { CANTIDAD_MAX, subtotal, totalCarrito, unidadesCarrito, type AccionCarrito, type Carrito } from "@/lib/dominio/carrito";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { PantallaMonto, TecladoNumerico } from "./TecladoNumerico";

type Props = {
  carrito: Carrito;
  despachar: (a: AccionCarrito) => void;
  onCobrar: () => void;
  cobroDeshabilitado: boolean;
};

const botonIcono =
  "flex size-11 shrink-0 items-center justify-center rounded-control border border-borde bg-superficie active:bg-suave";

function Lineas({ carrito, despachar, onCantidad }: Pick<Props, "carrito" | "despachar"> & { onCantidad: (id: string) => void }) {
  if (carrito.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-texto-3">
        <ShoppingCart size={36} aria-hidden />
        <p>Toca un producto</p>
      </div>
    );
  }
  return (
    <ul className="barra-fina min-h-0 flex-1 divide-y divide-suave overflow-x-hidden overflow-y-auto">
      {carrito.map((l) => (
        <li key={l.productoId} className="flex flex-col gap-1 py-2">
          {/* Fila 1: nombre completo + quitar */}
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm leading-snug font-semibold">{l.nombre}</p>
            <button
              type="button"
              aria-label={`Quitar ${l.nombre}`}
              onClick={() => despachar({ tipo: "quitar", productoId: l.productoId })}
              className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-control text-peligro active:bg-peligro-suave"
            >
              <X size={18} />
            </button>
          </div>
          {/* Fila 2: precio unitario · − cantidad + · subtotal */}
          <div className="flex items-center gap-2">
            <span className="num min-w-0 flex-1 truncate text-xs text-texto-3">{formatearPesos(l.precio)} c/u</span>
            <button type="button" aria-label={`Restar ${l.nombre}`} onClick={() => despachar({ tipo: "restar", productoId: l.productoId })} className={botonIcono}>
              <Minus size={18} />
            </button>
            <button
              type="button"
              aria-label={`Cantidad de ${l.nombre}: ${l.cantidad}. Cambiar`}
              onClick={() => onCantidad(l.productoId)}
              className="num flex h-11 min-w-11 items-center justify-center rounded-control border border-borde-activo px-2 text-lg font-bold"
            >
              {l.cantidad}
            </button>
            <button
              type="button"
              aria-label={`Sumar ${l.nombre}`}
              disabled={l.cantidad >= CANTIDAD_MAX}
              onClick={() => despachar({ tipo: "sumar", productoId: l.productoId })}
              className={botonIcono}
            >
              <Plus size={18} />
            </button>
            <span className="num shrink-0 text-right font-bold">{formatearPesos(subtotal(l))}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PanelCarrito({
  carrito,
  despachar,
  onCobrar,
  cobroDeshabilitado,
}: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const [verMovil, setVerMovil] = useState(false);

  const total = totalCarrito(carrito);
  const unidades = unidadesCarrito(carrito);
  const lineaEditando = carrito.find((l) => l.productoId === editando);
  const cantidadValida = Number(texto) >= 1 && Number(texto) <= CANTIDAD_MAX;
  const sinAccion = carrito.length === 0 || cobroDeshabilitado;

  const abrirCantidad = (id: string) => {
    setEditando(id);
    setTexto("");
  };

  const fijarCantidad = () => {
    if (editando) despachar({ tipo: "fijar", productoId: editando, cantidad: Number(texto) });
    setEditando(null);
  };

  const botonCobrar = (
    <Boton
      variante="primario"
      tamano="lg"
      className="w-full px-3 text-lg"
      disabled={sinAccion}
      onClick={() => {
        setVerMovil(false);
        onCobrar();
      }}
    >
      Cobrar <span className="num">{formatearPesos(total)}</span>
    </Boton>
  );

  return (
    <>
      {/* Escritorio / tablet */}
      <aside className="hidden min-h-0 w-[34%] max-w-sm min-w-80 shrink-0 flex-col border-l border-borde bg-superficie p-3 md:flex">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Carrito</h2>
          {carrito.length > 0 && (
            <Boton variante="fantasma" icono={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmarVaciar(true)}>
              Vaciar
            </Boton>
          )}
        </div>
        <Lineas carrito={carrito} despachar={despachar} onCantidad={abrirCantidad} />
        <div className="mt-2 flex flex-col gap-3 border-t border-borde pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-texto-3">TOTAL · {unidades} und.</span>
            <span className="num text-[40px] leading-[48px] font-bold tracking-tight">{formatearPesos(total)}</span>
          </div>
          {botonCobrar}
        </div>
      </aside>

      {/* Móvil: barra fija abajo */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-borde bg-superficie p-3 md:hidden">
        <button
          type="button"
          onClick={() => setVerMovil(true)}
          className="flex min-h-14 items-center gap-2 rounded-control border border-borde-activo px-3"
          aria-label={`Ver carrito, ${unidades} unidades`}
        >
          <ShoppingCart size={22} aria-hidden />
          <span className="num font-bold">{unidades}</span>
        </button>
        <div className="flex-1">{botonCobrar}</div>
      </div>

      <Modal abierto={verMovil} titulo="Carrito" onCerrar={() => setVerMovil(false)}>
        <div className="flex max-h-[60vh] flex-col">
          <Lineas carrito={carrito} despachar={despachar} onCantidad={abrirCantidad} />
          {carrito.length > 0 && (
            <Boton variante="fantasma" className="mt-2" icono={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmarVaciar(true)}>
              Vaciar
            </Boton>
          )}
        </div>
      </Modal>

      <Modal abierto={Boolean(lineaEditando)} titulo={lineaEditando?.nombre ?? "Cantidad"} onCerrar={() => setEditando(null)} ancho="sm">
        <div className="flex flex-col gap-3">
          <PantallaMonto etiqueta="Cantidad" texto={texto || String(lineaEditando?.cantidad ?? "")} />
          <TecladoNumerico valor={texto} onCambiar={(v) => setTexto(v.slice(0, 3))} onEnter={() => cantidadValida && fijarCantidad()} />
          {texto !== "" && !cantidadValida && <p className="text-sm text-peligro">Entre 1 y {CANTIDAD_MAX}</p>}
          <Boton variante="primario" tamano="lg" disabled={!cantidadValida} onClick={fijarCantidad}>
            Listo
          </Boton>
        </div>
      </Modal>

      <Modal abierto={confirmarVaciar} titulo="Vaciar carrito" onCerrar={() => setConfirmarVaciar(false)} ancho="sm">
        <div className="grid grid-cols-2 gap-2">
          <Boton onClick={() => setConfirmarVaciar(false)}>Cancelar</Boton>
          <Boton
            variante="peligro"
            onClick={() => {
              despachar({ tipo: "vaciar" });
              setConfirmarVaciar(false);
              setVerMovil(false);
            }}
          >
            Vaciar
          </Boton>
        </div>
      </Modal>
    </>
  );
}
