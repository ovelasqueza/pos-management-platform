"use client";

import { memo, useMemo, useRef, useState } from "react";
import { Search, ShoppingBag, Utensils, X } from "lucide-react";
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
  oculto?: boolean;
};

/** Tarjeta individual memoizada: al agregar un producto al carrito solo se repinta esa tarjeta. */
const TarjetaProducto = memo(function TarjetaProducto({
  producto,
  cantidad,
  onTocar,
}: {
  producto: ProductoVendible;
  cantidad: number | undefined;
  onTocar: (p: ProductoVendible) => void;
}) {
  const borde = cantidad
    ? "border-primario ring-1 ring-primario"
    : producto.modalidad === "mesa"
      ? "border-sky-200 hover:border-sky-400"
      : producto.modalidad === "llevar"
        ? "border-amber-200 hover:border-amber-400"
        : "border-borde hover:border-borde-activo";

  return (
    <li>
      <button
        type="button"
        onClick={() => onTocar(producto)}
        className={`relative flex h-full min-h-36 w-full flex-col items-center justify-between gap-1 rounded-tarjeta border bg-superficie p-2 text-center active:bg-suave ${borde}`}
      >
        {producto.modalidad === "mesa" && (
          <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-sky-800">
            <Utensils size={10} aria-hidden />
            Mesa
          </span>
        )}
        {producto.modalidad === "llevar" && (
          <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-amber-800">
            <ShoppingBag size={10} aria-hidden />
            Llevar
          </span>
        )}
        {cantidad && (
          <span className="num absolute top-1 right-1 flex min-w-6 items-center justify-center rounded-full bg-primario px-1.5 text-xs font-bold text-white">
            {cantidad}
          </span>
        )}
        <MiniaturaProducto nombre={producto.nombre} url={producto.imagenUrl} tamano={80} />
        <span className="line-clamp-2 text-sm leading-tight font-semibold">{producto.nombre}</span>
        <span className="num text-base font-semibold">{formatearPesos(producto.precio)}</span>
      </button>
    </li>
  );
});

/**
 * Productos para vender. Ocupa exactamente el alto disponible: la página no se mueve,
 * solo la lista de productos se desplaza por dentro.
 * Se mantiene montada durante el cobro (oculta con CSS) para no destruir ni recargar las imágenes.
 */
export function CuadriculaProductos({ productos, cantidades, onTocar, onBuscando, oculto = false }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [filtroModalidad, setFiltroModalidad] = useState<"todas" | "mesa" | "llevar">("todas");
  const [enfocado, setEnfocado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const buscando = enfocado || busqueda.trim() !== "";

  // Índice de búsqueda precalculado una sola vez cuando cambia el catálogo
  const productosIndexados = useMemo(
    () => productos.map((p) => ({ producto: p, texto: normalizarTexto(p.nombre) })),
    [productos],
  );

  // Solo categorías que tienen productos vendibles
  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos) if (p.categoriaId && p.categoria) m.set(p.categoriaId, p.categoria);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "es-CO"));
  }, [productos]);

  const categoriaActiva = categoria && categorias.some(([id]) => id === categoria) ? categoria : null;

  const baseVisibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    // Al buscar se ignora la categoría: encuentra el producto esté donde esté
    if (q) return productosIndexados.filter((x) => x.texto.includes(q)).map((x) => x.producto);
    return categoriaActiva ? productos.filter((p) => p.categoriaId === categoriaActiva) : productos;
  }, [productos, productosIndexados, busqueda, categoriaActiva]);

  const { productosMesa, productosLlevar, productosOtros } = useMemo(() => {
    const mesa: ProductoVendible[] = [];
    const llevar: ProductoVendible[] = [];
    const otros: ProductoVendible[] = [];
    for (const p of baseVisibles) {
      if (p.modalidad === "mesa") mesa.push(p);
      else if (p.modalidad === "llevar") llevar.push(p);
      else otros.push(p);
    }
    // Si solo se usa el interruptor "Llevar", los demás productos de esa vista se entienden para la mesa
    if (mesa.length === 0 && llevar.length > 0) {
      return { productosMesa: otros, productosLlevar: llevar, productosOtros: [] };
    }
    return { productosMesa: mesa, productosLlevar: llevar, productosOtros: otros };
  }, [baseVisibles]);

  const tieneModalidades = productosMesa.length > 0 || productosLlevar.length > 0;
  const modalidadActiva =
    (filtroModalidad === "mesa" && productosMesa.length > 0) ||
    (filtroModalidad === "llevar" && productosLlevar.length > 0)
      ? filtroModalidad
      : "todas";

  const visibles = useMemo(() => {
    if (buscando || modalidadActiva === "todas") return baseVisibles;
    return modalidadActiva === "mesa" ? productosMesa : productosLlevar;
  }, [buscando, modalidadActiva, baseVisibles, productosMesa, productosLlevar]);

  const chip = (activo: boolean) =>
    `flex min-h-10 items-center justify-center rounded-control border px-2 text-center text-xs leading-tight font-semibold ${
      activo ? "border-primario bg-primario text-white" : "border-borde bg-superficie text-texto-2 hover:border-borde-activo"
    }`;

  const elegir = (id: string | null) => {
    setCategoria(id);
    setFiltroModalidad("todas");
    setBusqueda("");
  };

  return (
    <div className={oculto ? "hidden" : "flex min-h-0 min-w-0 flex-1 flex-col gap-2"} aria-hidden={oculto || undefined}>
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

      {tieneModalidades && !buscando && (
        <div className="flex shrink-0 flex-wrap gap-1.5" role="group" aria-label="Tipo de entrega">
          <button
            type="button"
            onClick={() => setFiltroModalidad("todas")}
            aria-pressed={modalidadActiva === "todas"}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold ${
              modalidadActiva === "todas"
                ? "border-texto bg-texto text-white"
                : "border-borde bg-superficie text-texto-2 hover:border-borde-activo"
            }`}
          >
            Todos ({baseVisibles.length})
          </button>
          {productosMesa.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltroModalidad("mesa")}
              aria-pressed={modalidadActiva === "mesa"}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold ${
                modalidadActiva === "mesa"
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400"
              }`}
            >
              <Utensils size={14} aria-hidden />
              Para la mesa ({productosMesa.length})
            </button>
          )}
          {productosLlevar.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltroModalidad("llevar")}
              aria-pressed={modalidadActiva === "llevar"}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold ${
                modalidadActiva === "llevar"
                  ? "border-amber-700 bg-amber-700 text-white"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400"
              }`}
            >
              <ShoppingBag size={14} aria-hidden />
              Para llevar ({productosLlevar.length})
            </button>
          )}
        </div>
      )}

      {!buscando && tieneModalidades && modalidadActiva === "todas" ? (
        <div className="barra-fina flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">
          {[
            {
              clave: "mesa",
              titulo: "Para la mesa",
              icono: <Utensils size={15} aria-hidden />,
              estiloTitulo: "text-sky-800 border-sky-200 bg-sky-50",
              lista: productosMesa,
            },
            {
              clave: "llevar",
              titulo: "Para llevar",
              icono: <ShoppingBag size={15} aria-hidden />,
              estiloTitulo: "text-amber-800 border-amber-200 bg-amber-50",
              lista: productosLlevar,
            },
            {
              clave: "otros",
              titulo: "Otros",
              icono: null,
              estiloTitulo: "text-texto-2 border-borde bg-suave",
              lista: productosOtros,
            },
          ]
            .filter((s) => s.lista.length > 0)
            .map((seccion) => (
              <section key={seccion.clave} className="flex flex-col gap-2">
                <h3 className={`inline-flex w-fit items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${seccion.estiloTitulo}`}>
                  {seccion.icono}
                  {seccion.titulo} ({seccion.lista.length})
                </h3>
                <ul className="grid auto-rows-min grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {seccion.lista.map((p) => (
                    <TarjetaProducto key={p.id} producto={p} cantidad={cantidades.get(p.id)} onTocar={onTocar} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : (
        <ul className="barra-fina grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1 pb-1 sm:grid-cols-4 lg:grid-cols-5">
          {visibles.map((p) => (
            <TarjetaProducto key={p.id} producto={p} cantidad={cantidades.get(p.id)} onTocar={onTocar} />
          ))}
          {visibles.length === 0 && <li className="col-span-full py-10 text-center text-texto-3">Sin productos</li>}
        </ul>
      )}
    </div>
  );
}
