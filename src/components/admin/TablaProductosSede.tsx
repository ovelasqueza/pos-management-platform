"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    setActivo(fila.habilitado);
  }, [fila.habilitado]);

  async function enviar(v: boolean) {
    setActivo(v); // conserva el estado tocado aunque falle
    setGuardando(true);
    const ok = await guardar(v).catch(() => false);
    setGuardando(false);
    setFallo(!ok);
    if (!ok) {
      setActivo(fila.habilitado);
    }
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
  const [pestana, setPestana] = useState<"activos" | "desactivados">("activos");
  const [filasLocales, setFilasLocales] = useState(filas);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState(TODAS);
  const supabase = useMemo(() => crearClienteNavegador(), []);

  useEffect(() => {
    setFilasLocales(filas);
  }, [filas]);

  const haySinCategoria = useMemo(() => filasLocales.some((f) => f.categoriaId === null), [filasLocales]);

  const conteoActivos = useMemo(
    () => filasLocales.filter((f) => f.habilitado && f.activo).length,
    [filasLocales]
  );
  const conteoDesactivados = useMemo(
    () => filasLocales.filter((f) => !f.habilitado || !f.activo).length,
    [filasLocales]
  );

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return filasLocales.filter((f) => {
      const estaActivo = f.habilitado && f.activo;
      const coincideEstado = pestana === "activos" ? estaActivo : !estaActivo;
      if (!coincideEstado) return false;

      const coincideCategoria =
        categoria === TODAS || (categoria === SIN_CATEGORIA ? f.categoriaId === null : f.categoriaId === categoria);
      if (!coincideCategoria) return false;

      if (q && !normalizarTexto(f.nombre).includes(q)) return false;
      return true;
    });
  }, [busqueda, categoria, filasLocales, pestana]);

  // Cada guardado verifica que la fila cambió (si la RLS lo bloquea, no hay filas).
  const actualizar = async (productoId: string, cambios: { precio_venta?: number; habilitado?: boolean }) => {
    const { data, error } = await supabase
      .from("productos_sede")
      .update(cambios)
      .eq("sede_id", sedeId)
      .eq("producto_id", productoId)
      .select("producto_id");
    const ok = !error && data.length === 1;
    if (ok) {
      setFilasLocales((prev) =>
        prev.map((f) => {
          if (f.productoId !== productoId) return f;
          return {
            ...f,
            ...(cambios.habilitado !== undefined ? { habilitado: cambios.habilitado } : {}),
            ...(cambios.precio_venta !== undefined ? { precioVenta: cambios.precio_venta } : {}),
          };
        })
      );
    }
    return ok;
  };

  const guardarCosto = (productoId: string) => async (costo: number) => {
    const { error } = await supabase
      .from("costos_producto_sede")
      .upsert({ sede_id: sedeId, producto_id: productoId, costo }, { onConflict: "sede_id,producto_id" });
    const ok = !error;
    if (ok) {
      setFilasLocales((prev) =>
        prev.map((f) => (f.productoId === productoId ? { ...f, costo } : f))
      );
    }
    return ok;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Pestañas para separar productos activos de desactivados */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-tarjeta bg-suave p-1" role="tablist" aria-label="Filtro por estado de productos">
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "activos"}
            onClick={() => setPestana("activos")}
            className={`flex min-h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors ${
              pestana === "activos"
                ? "border border-borde bg-superficie text-texto shadow-sm"
                : "text-texto-3 hover:text-texto"
            }`}
          >
            <span>Activos</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                pestana === "activos" ? "bg-primario text-white" : "bg-borde text-texto-2"
              }`}
            >
              {conteoActivos}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "desactivados"}
            onClick={() => setPestana("desactivados")}
            className={`flex min-h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors ${
              pestana === "desactivados"
                ? "border border-borde bg-superficie text-texto shadow-sm"
                : "text-texto-3 hover:text-texto"
            }`}
          >
            <span>Desactivados</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                pestana === "desactivados" ? "bg-peligro text-white" : "bg-borde text-texto-2"
              }`}
            >
              {conteoDesactivados}
            </span>
          </button>
        </div>
      </div>

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
              <tr key={f.productoId} className="border-b border-suave align-middle last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-4">
                    <FotoProducto id={f.productoId} nombre={f.nombre} url={f.imagenUrl} tamano={120} />
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
          <p className="p-6 text-center text-texto-3">
            {busqueda || categoria !== TODAS
              ? "Sin resultados para los filtros aplicados"
              : pestana === "activos"
                ? "No hay productos activos en esta sede"
                : "No hay productos desactivados"}
          </p>
        )}
      </div>
    </div>
  );
}
