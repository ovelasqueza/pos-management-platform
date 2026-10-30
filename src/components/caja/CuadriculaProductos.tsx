"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { normalizarTexto } from "@/lib/dominio/producto";
import type { ProductoVendible } from "@/lib/dominio/carrito";
import { MiniaturaProducto } from "@/components/ui/MiniaturaProducto";

type Props = {
  productos: ProductoVendible[];
  cantidades: Map<string, number>;
  onTocar: (p: ProductoVendible) => void;
  /** Avisa al padre cuando se empieza/termina de buscar (para ocultar el aviso de venta) */
  onBuscando?: (buscando: boolean) => void;
};

/**
 * Productos para vender. Ocupa exactamente el alto disponible: la página no se mueve,
 * solo la lista de productos se desplaza por dentro.
 * Las categorías van arriba como cuadros pequeños que se acomodan en varias filas (todas visibles).
 * En pantallas táctiles el teclado tapa media pantalla: mientras se busca (campo enfocado o con
 * texto) las categorías se ocultan para que se vean los productos filtrados.
 */
export function CuadriculaProductos({ productos, cantidades, onTocar, onBuscando }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [enfocado, setEnfocado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const buscando = enfocado || busqueda.trim() !== "";

  // Solo categorías que tienen productos vendibles
  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos) if (p.categoriaId && p.categoria) m.set(p.categoriaId, p.categoria);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "es-CO"));
  }, [productos]);

  const categoriaActiva = categoria && categorias.some(([id]) => id === categoria) ? categoria : null;

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    // Al buscar se ignora la categoría: encuentra el producto esté donde esté
    if (q) return productos.filter((p) => normalizarTexto(p.nombre).includes(q));
    return categoriaActiva ? productos.filter((p) => p.categoriaId === categoriaActiva) : productos;
  }, [productos, busqueda, categoriaActiva]);

  const chip = (activo: boolean) =>
    `flex min-h-10 items-center justify-center rounded-control border px-2 text-center text-xs leading-tight font-semibold ${
      activo ? "border-primario bg-primario text-white" : "border-borde bg-superficie text-texto-2 hover:border-borde-activo"
    }`;

  const elegir = (id: string | null) => {
    setCategoria(id);
    setBusqueda("");
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <label htmlFor="buscar-producto" className="sr-only">
          Buscar producto
        </label>
        <Search size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
        <input
          id="buscar-producto"
          ref={campo}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={() => {
            setEnfocado(true);
            onBuscando?.(true);
          }}
          onBlur={() => {
            setEnfocado(false);
            onBuscando?.(busqueda.trim() !== "");
          }}
          onKeyDown={(e) => {
            // Enter cierra el teclado en pantalla y deja ver los resultados
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Buscar producto"
          className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-12 pl-11 text-base focus:border-primario focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {busqueda && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            // onMouseDown evita que el campo pierda el foco antes de borrar
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setBusqueda("");
              campo.current?.blur();
              onBuscando?.(false);
            }}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-texto-3 hover:bg-suave"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {categorias.length > 0 && !buscando && (
        <div className="grid shrink-0 grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5" role="group" aria-label="Categorías">
          <button type="button" onClick={() => elegir(null)} className={chip(!categoriaActiva && !busqueda)} aria-pressed={!categoriaActiva}>
            TODOS
          </button>
          {categorias.map(([id, nombre]) => (
            <button
              key={id}
              type="button"
              onClick={() => elegir(id)}
              className={chip(categoriaActiva === id && !busqueda)}
              aria-pressed={categoriaActiva === id}
            >
              <span className="line-clamp-2">{nombre}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="barra-fina grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1 pb-1 sm:grid-cols-4 lg:grid-cols-5">
        {visibles.map((p) => {
          const cant = cantidades.get(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onTocar(p)}
                className={`relative flex h-full min-h-36 w-full flex-col items-center justify-between gap-1 rounded-tarjeta border bg-superficie p-2 text-center active:bg-suave ${
                  cant ? "border-primario ring-1 ring-primario" : "border-borde hover:border-borde-activo"
                }`}
              >
                {cant && (
                  <span className="num absolute top-1 right-1 flex min-w-6 items-center justify-center rounded-full bg-primario px-1.5 text-xs font-bold text-white">
                    {cant}
                  </span>
                )}
                <MiniaturaProducto nombre={p.nombre} url={p.imagenUrl} tamano={80} />
                <span className="line-clamp-2 text-sm leading-tight font-semibold">{p.nombre}</span>
                <span className="num text-base font-semibold">{formatearPesos(p.precio)}</span>
              </button>
            </li>
          );
        })}
        {visibles.length === 0 && <li className="col-span-full py-10 text-center text-texto-3">Sin productos</li>}
      </ul>
    </div>
  );
}
