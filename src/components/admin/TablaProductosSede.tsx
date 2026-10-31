"use client";

import { useMemo, useState } from "react";
import { RotateCw, Search, Tag } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { normalizarTexto } from "@/lib/dominio/producto";
import type { TipoSede } from "@/lib/dominio/sede";
import { CampoAutoguardado } from "@/components/ui/CampoAutoguardado";
import { Interruptor } from "@/components/ui/Interruptor";
import { FotoProducto } from "@/components/admin/FotoProducto";
import { EditarProducto, type OpcionCategoria } from "@/components/admin/FormularioProducto";

export type FilaProductoSede = {
  productoId: string;
  nombre: string;
  categoriaId: string | null;
  categoria: string | null;
  imagenUrl: string | null;
  precioReferencia: number;
  activo: boolean;
  habilitado: boolean;
  precioVenta: number;
  costo: number | null;
};

const sinSigno = (v: number) => formatearPesos(v).replace("$ ", "");

// Valores especiales del filtro de categoría (los ids reales son uuid)
const TODAS = "";
const SIN_CATEGORIA = "sin-categoria";

/** Interruptor "Vende" con guardado automático y Reintentar si falla. */
function Vende({ fila, guardar }: { fila: FilaProductoSede; guardar: (v: boolean) => Promise<boolean> }) {
  const [activo, setActivo] = useState(fila.habilitado);
  const [fallo, setFallo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function enviar(v: boolean) {
    setActivo(v); // conserva el estado tocado aunque falle
    setGuardando(true);
    const ok = await guardar(v).catch(() => false);
    setGuardando(false);
    setFallo(!ok);
  }

  return (
    <div className="flex flex-col items-center">
      <Interruptor activo={activo} etiqueta={`${fila.nombre}: activo en esta sede`} deshabilitado={guardando} onCambiar={enviar} />
      {fallo && (
        <button
          type="button"
          role="alert"
          onClick={() => enviar(activo)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-peligro underline"
        >
          <RotateCw size={12} aria-hidden />
          Reintentar
        </button>
      )}
    </div>
  );
}

type Props = {
  sedeId: string;
  tipo: TipoSede;
  filas: FilaProductoSede[];
  categorias: OpcionCategoria[];
};

/** Productos de una sede: datos del producto + vende + precio de venta + costo, todo en una tabla. */
export function TablaProductosSede({ sedeId, tipo, filas, categorias }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState(TODAS);
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const haySinCategoria = useMemo(() => filas.some((f) => f.categoriaId === null), [filas]);

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return filas.filter(
      (f) =>
        (categoria === TODAS || (categoria === SIN_CATEGORIA ? f.categoriaId === null : f.categoriaId === categoria)) &&
        (!q || normalizarTexto(f.nombre).includes(q)),
    );
  }, [busqueda, categoria, filas]);

  // Cada guardado verifica que la fila cambió (si la RLS lo bloquea, no hay filas).
  const actualizar = async (productoId: string, cambios: { precio_venta?: number; habilitado?: boolean }) => {
    const { data, error } = await supabase
      .from("productos_sede")
      .update(cambios)
      .eq("sede_id", sedeId)
      .eq("producto_id", productoId)
      .select("producto_id");
    return !error && data.length === 1;
  };

  const guardarCosto = (productoId: string) => async (costo: number) => {
    const { error } = await supabase
      .from("costos_producto_sede")
      .upsert({ sede_id: sedeId, producto_id: productoId, costo }, { onConflict: "sede_id,producto_id" });
    return !error;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="relative w-full max-w-sm">
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
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Filtrar por categoría</span>
          <Tag size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-4 pl-10 focus:border-primario focus:outline-none"
          >
            <option value={TODAS}>Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
            {haySinCategoria && <option value={SIN_CATEGORIA}>Sin categoría</option>}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="w-20 px-2 py-3 text-center font-medium" title="Activar o desactivar el producto en esta sede">
                Activo
              </th>
              <th className="px-4 py-3 text-right font-medium">Precio venta</th>
              <th className="px-4 py-3 text-right font-medium">Costo</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.productoId} className="border-b border-suave align-top last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <FotoProducto id={f.productoId} nombre={f.nombre} url={f.imagenUrl} />
                    <div className="min-w-0">
                      <p className={`font-medium ${f.activo ? "" : "text-texto-3"}`}>{f.nombre}</p>
                      <p className="text-xs text-texto-3">
                        {f.categoria ?? "Sin categoría"}
                        {!f.activo && " · Inactivo en todas las sedes"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1">
                  <Vende fila={f} guardar={(habilitado) => actualizar(f.productoId, { habilitado })} />
                </td>
                <td className="px-4 py-1">
                  <CampoAutoguardado
                    etiqueta={`Precio de ${f.nombre}`}
                    valor={f.precioVenta}
                    leer={(t) => leerPesos(t)}
                    guardar={(precio) => actualizar(f.productoId, { precio_venta: precio })}
                    formatear={sinSigno}
                  />
                </td>
                <td className="px-4 py-1">
                  <CampoAutoguardado
                    etiqueta={`Costo de ${f.nombre}`}
                    valor={f.costo}
                    leer={(t) => leerPesos(t)}
                    guardar={guardarCosto(f.productoId)}
                    formatear={sinSigno}
                    placeholder="Sin costo"
                  />
                </td>
                <td className="px-1 py-1">
                  <EditarProducto
                    tipo={tipo}
                    categorias={categorias}
                    producto={{
                      id: f.productoId,
                      nombre: f.nombre,
                      categoriaId: f.categoriaId,
                      precioReferencia: f.precioReferencia,
                      imagenUrl: f.imagenUrl,
                      activo: f.activo,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <p className="p-6 text-center text-texto-3">{filas.length ? "Sin resultados" : "Aún no hay productos. Crea el primero"}</p>
        )}
      </div>
    </div>
  );
}
