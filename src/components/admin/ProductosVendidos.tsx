"use client";

import { useMemo, useState } from "react";
import { Croissant, Flame, Search } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { normalizarTexto } from "@/lib/dominio/producto";
import type { TipoSede } from "@/lib/dominio/sede";

type Fila = {
  productoId: string;
  nombre: string;
  tipo: TipoSede;
  unidades: number;
  valor: number;
  porSede: { sede: string; unidades: number }[];
};

type Orden = "unidades" | "valor" | "nombre";

const ORDENES: { valor: Orden; nombre: string }[] = [
  { valor: "unidades", nombre: "Unidades" },
  { valor: "valor", nombre: "Valor" },
  { valor: "nombre", nombre: "Nombre" },
];

export function ProductosVendidos({ filas, todas }: { filas: Fila[]; todas: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("unidades");

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    const lista = q ? filas.filter((f) => normalizarTexto(f.nombre).includes(q)) : [...filas];
    return lista.sort((a, b) =>
      orden === "nombre"
        ? a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" })
        : orden === "valor"
          ? b.valor - a.valor
          : b.unidades - a.unidades,
    );
  }, [filas, busqueda, orden]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Buscar producto</span>
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-4 pl-10 focus:border-primario focus:outline-none"
          />
        </label>
        <div className="flex gap-1 rounded-tarjeta bg-suave p-1" role="group" aria-label="Ordenar por">
          {ORDENES.map((o) => (
            <button
              key={o.valor}
              type="button"
              aria-pressed={orden === o.valor}
              onClick={() => setOrden(o.valor)}
              className={`min-h-11 rounded-control px-3 text-sm font-medium ${
                orden === o.valor ? "border border-borde bg-superficie text-texto" : "text-texto-3"
              }`}
            >
              {o.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              {todas && <th className="hidden px-4 py-3 font-medium lg:table-cell">Por sede</th>}
              <th className="px-4 py-3 text-right font-medium">Unidades</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.productoId} className="border-b border-suave align-top last:border-0">
                <td className="px-4 py-2 font-medium">
                  <span className="flex items-center gap-2">
                    {todas &&
                      (f.tipo === "panaderia" ? (
                        <Croissant size={16} className="text-advertencia" aria-label="Panadería" />
                      ) : (
                        <Flame size={16} className="text-peligro" aria-label="Asadero" />
                      ))}
                    {f.nombre}
                  </span>
                </td>
                {todas && (
                  <td className="hidden px-4 py-2 text-sm text-texto-2 lg:table-cell">
                    {f.porSede.map((s) => (
                      <span key={s.sede} className="mr-3 inline-block">
                        {s.sede}: <span className="num font-semibold">{s.unidades}</span>
                      </span>
                    ))}
                  </td>
                )}
                <td className="num px-4 py-2 text-right font-semibold">{f.unidades}</td>
                <td className="num px-4 py-2 text-right">{formatearPesos(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && <p className="p-6 text-center text-texto-3">Sin ventas en el periodo</p>}
      </div>
    </div>
  );
}
