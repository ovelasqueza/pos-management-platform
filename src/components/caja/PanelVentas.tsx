"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Ban, Package, Printer, Receipt, RotateCw, Search } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearHora } from "@/lib/dominio/fechas";
import { nombreMetodo, type MetodoPago } from "@/lib/dominio/cobro";
import { normalizarTexto } from "@/lib/dominio/producto";
import { esCodigo, esErrorDeRed, mensajeDeError } from "@/lib/dominio/errores";
import type { DatosTicket } from "@/lib/dominio/documentos";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

export type LineaVentaDB = {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type Venta = {
  id: string;
  numero: number;
  creado_en: string;
  total: number;
  metodo: MetodoPago;
  monto_efectivo?: number | null;
  monto_transferencia?: number | null;
  /** Script 18; null si la venta está vigente */
  anulada_en?: string | null;
  motivo_anulacion?: string | null;
  lineas_venta?: LineaVentaDB[] | null;
};

export type LineaVentaSimple = {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type VentaEncoladaSimple = {
  clave: string;
  lineas: LineaVentaSimple[];
};

type Props = {
  abierto: boolean;
  turnoId: string;
  colaVentas?: VentaEncoladaSimple[];
  onCerrar: () => void;
  onTurnoCerrado: () => void;
};

export function PanelVentas({ abierto, turnoId, colaVentas, onCerrar, onTurnoCerrado }: Props) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const imprimir = useImprimir();
  const [pestana, setPestana] = useState<"productos" | "tickets">("productos");
  const [busqueda, setBusqueda] = useState("");
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [error, setError] = useState<string>();
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  const consultar = useCallback(async () => {
    // Intenta traer ventas con lineas_venta y motivo_anulacion
    const r = await supabase
      .from("ventas")
      .select(
        "id, numero, creado_en, total, metodo, monto_efectivo, monto_transferencia, anulada_en, motivo_anulacion, lineas_venta(producto_id, nombre, precio, cantidad)",
      )
      .eq("turno_id", turnoId)
      .order("creado_en", { ascending: false });

    if (!r.error) return r;

    // Respaldo 1: si faltan columnas de pago mixto o anulación
    if (r.error?.code === "42703") {
      const r1 = await supabase
        .from("ventas")
        .select("id, numero, creado_en, total, metodo, anulada_en, motivo_anulacion, lineas_venta(producto_id, nombre, precio, cantidad)")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false });
      if (!r1.error) return r1;

      const r2 = await supabase
        .from("ventas")
        .select("id, numero, creado_en, total, metodo, lineas_venta(producto_id, nombre, precio, cantidad)")
        .eq("turno_id", turnoId)
        .order("creado_en", { ascending: false });
      if (!r2.error) return r2;
    }

    // Respaldo 2: consulta las ventas y sus líneas por separado
    const { data: ventasBasicas, error: errorBasicas } = await supabase
      .from("ventas")
      .select("id, numero, creado_en, total, metodo")
      .eq("turno_id", turnoId)
      .order("creado_en", { ascending: false });

    if (errorBasicas || !ventasBasicas) return { data: null, error: errorBasicas };

    const ids = ventasBasicas.map((v) => v.id);
    if (ids.length === 0) return { data: [], error: null };

    const { data: lineas } = await supabase
      .from("lineas_venta")
      .select("venta_id, producto_id, nombre, precio, cantidad")
      .in("venta_id", ids);

    const porVenta = new Map<string, LineaVentaDB[]>();
    for (const l of (lineas ?? []) as (LineaVentaDB & { venta_id: string })[]) {
      const arr = porVenta.get(l.venta_id) ?? [];
      arr.push({ producto_id: l.producto_id, nombre: l.nombre, precio: l.precio, cantidad: l.cantidad });
      porVenta.set(l.venta_id, arr);
    }

    const resultado: Venta[] = ventasBasicas.map((v) => ({
      ...v,
      lineas_venta: porVenta.get(v.id) ?? [],
    }));

    return { data: resultado, error: null };
  }, [supabase, turnoId]);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultar>>) => {
    if (r.error) setError("No se pudieron cargar las ventas");
    else {
      setError(undefined);
      setVentas(r.data as Venta[]);
    }
  }, []);

  const cargar = () => consultar().then(aplicar);

  useEffect(() => {
    if (!abierto) return;
    setBusqueda("");
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

  const vigentes = useMemo(() => ventas?.filter((v) => !v.anulada_en) ?? [], [ventas]);
  const total = useMemo(() => vigentes.reduce((s, v) => s + v.total, 0), [vigentes]);
  const anuladas = (ventas?.length ?? 0) - vigentes.length;

  // ── Agrupación de productos vendidos hasta el momento ──
  const resumenProductos = useMemo(() => {
    const mapa = new Map<string, { id: string; nombre: string; unidades: number; total: number }>();

    // 1. De las ventas válidas (no anuladas) en base de datos
    for (const v of vigentes) {
      for (const l of v.lineas_venta ?? []) {
        const clave = l.producto_id || l.nombre;
        const actual = mapa.get(clave) ?? { id: l.producto_id, nombre: l.nombre, unidades: 0, total: 0 };
        actual.unidades += l.cantidad;
        actual.total += l.cantidad * l.precio;
        mapa.set(clave, actual);
      }
    }

    // 2. De las ventas locales en cola (offline) que aún no estén en ventas de la BD
    const clavesBD = new Set(ventas?.map((v) => v.id) ?? []);
    for (const cv of colaVentas ?? []) {
      if (clavesBD.has(cv.clave)) continue;
      for (const l of cv.lineas ?? []) {
        const clave = l.producto_id || l.nombre;
        const actual = mapa.get(clave) ?? { id: l.producto_id, nombre: l.nombre, unidades: 0, total: 0 };
        actual.unidades += l.cantidad;
        actual.total += l.cantidad * l.precio;
        mapa.set(clave, actual);
      }
    }

    const lista = Array.from(mapa.values()).map((p) => ({
      ...p,
      precioPromedio: p.unidades > 0 ? Math.round(p.total / p.unidades) : 0,
    }));

    return lista.sort((a, b) => b.unidades - a.unidades || b.total - a.total);
  }, [vigentes, ventas, colaVentas]);

  const totalUnidades = useMemo(
    () => resumenProductos.reduce((s, p) => s + p.unidades, 0),
    [resumenProductos],
  );

  const totalDineroProductos = useMemo(
    () => resumenProductos.reduce((s, p) => s + p.total, 0),
    [resumenProductos],
  );

  const productosFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return resumenProductos;
    return resumenProductos.filter((p) => normalizarTexto(p.nombre).includes(q));
  }, [resumenProductos, busqueda]);

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

          {/* Selector de pestañas: Productos vendidos vs Historial de tickets */}
          <div className="flex gap-1 rounded-tarjeta bg-suave p-1" role="tablist" aria-label="Vista de ventas">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "productos"}
              onClick={() => setPestana("productos")}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors ${
                pestana === "productos"
                  ? "border border-borde bg-superficie text-texto shadow-sm"
                  : "text-texto-3 hover:text-texto"
              }`}
            >
              <Package size={16} aria-hidden />
              <span>Productos vendidos</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  pestana === "productos" ? "bg-primario text-white" : "bg-borde text-texto-2"
                }`}
              >
                {totalUnidades} u.
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "tickets"}
              onClick={() => setPestana("tickets")}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors ${
                pestana === "tickets"
                  ? "border border-borde bg-superficie text-texto shadow-sm"
                  : "text-texto-3 hover:text-texto"
              }`}
            >
              <Receipt size={16} aria-hidden />
              <span>Historial tickets</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  pestana === "tickets" ? "bg-primario text-white" : "bg-borde text-texto-2"
                }`}
              >
                {vigentes.length}
              </span>
            </button>
          </div>

          {ventas && pestana === "productos" && (
            <div className="flex flex-col gap-3">
              {/* Tarjetas de totales */}
              <div className="grid grid-cols-2 gap-2 rounded-tarjeta border border-borde bg-suave p-3 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-texto-3">Total unidades</p>
                  <p className="num text-2xl font-bold text-texto">{totalUnidades} u.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-texto-3">Total vendido</p>
                  <p className="num text-2xl font-bold text-primario-activo">
                    {formatearPesos(totalDineroProductos || total)}
                  </p>
                </div>
              </div>

              {/* Buscador de producto */}
              {resumenProductos.length > 5 && (
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto vendido…"
                    className="min-h-10 w-full rounded-control border border-borde-activo bg-superficie pr-3 pl-9 text-sm focus:border-primario focus:outline-none"
                  />
                </div>
              )}

              {/* Listado de productos vendidos */}
              <div className="max-h-[50vh] divide-y divide-suave overflow-y-auto rounded-tarjeta border border-borde bg-superficie">
                {productosFiltrados.map((p) => (
                  <div key={p.id || p.nombre} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-texto">{p.nombre}</p>
                      <p className="text-xs text-texto-3">
                        {formatearPesos(p.precioPromedio)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="rounded-control bg-suave px-2.5 py-1 text-sm font-bold text-texto">
                        {p.unidades} {p.unidades === 1 ? "ud" : "uds"}
                      </span>
                      <span className="num min-w-[5rem] font-bold text-texto">
                        {formatearPesos(p.total)}
                      </span>
                    </div>
                  </div>
                ))}
                {productosFiltrados.length === 0 && (
                  <p className="py-6 text-center text-sm text-texto-3">
                    {busqueda ? "Sin coincidencias" : "Aún no se han vendido productos en este turno"}
                  </p>
                )}
              </div>
            </div>
          )}

          {ventas && pestana === "tickets" && (
            <>
              <p className="flex justify-between text-sm text-texto-3">
                <span>
                  {vigentes.length} ventas{anuladas > 0 && ` · ${anuladas} anuladas`}
                </span>
                <span className="num font-semibold text-texto">{formatearPesos(total)}</span>
              </p>
              <ul className="max-h-[50vh] divide-y divide-suave overflow-y-auto">
                {ventas.map((v) => (
                  <li key={v.id} className={`flex items-center gap-3 py-1 ${v.anulada_en ? "text-texto-3" : ""}`}>
                    <span className={`num w-14 font-semibold ${v.anulada_en ? "line-through" : ""}`}>#{v.numero}</span>
                    <span className="num w-24 shrink-0 whitespace-nowrap text-sm text-texto-3">{formatearHora(v.creado_en)}</span>
                    <span className="min-w-0 flex-1 text-sm text-texto-2">
                      {nombreMetodo(v.metodo)}
                      {v.metodo === "mixto" && (
                        <span className="num block text-xs text-texto-3">
                          Efectivo {formatearPesos(v.monto_efectivo ?? 0)} · QR {formatearPesos(v.monto_transferencia ?? 0)}
                        </span>
                      )}
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
