"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, Lock, LogOut, Receipt, ShoppingCart, Wallet, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { cargarProductosVendibles } from "@/lib/caja/productos";
import {
  conciliarCarrito,
  firmaCarrito,
  reducirCarrito,
  totalCarrito,
  type AccionCarrito,
  type Carrito,
  type ProductoVendible,
} from "@/lib/dominio/carrito";
import type { MetodoPago } from "@/lib/dominio/cobro";
import { formatearPesos } from "@/lib/dominio/dinero";
import { esConsumidorFinal, type Cliente } from "@/lib/dominio/cliente";
import { nuevoUUID } from "@/lib/uuid";
import type { DatosReporte, DatosTicket } from "@/lib/dominio/documentos";
import { esCodigo, esErrorDeRed, mensajeDeError } from "@/lib/dominio/errores";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Modal } from "@/components/ui/Modal";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";
import { CuadriculaProductos } from "./CuadriculaProductos";
import { PanelCarrito } from "./PanelCarrito";
import { PanelCobro, type ResultadoCobro } from "./PanelCobro";
import { PanelVentas } from "./PanelVentas";
import { PanelGastos } from "./PanelGastos";
import { CierreTurno } from "./CierreTurno";
import { ResultadoCierre } from "./ResultadoCierre";

type Props = {
  turnoId: string;
  sede: string;
  cajero: string;
  productosIniciales: ProductoVendible[];
};

type Ventana = "cobro" | "ventas" | "gastos" | "cierre" | "salir" | null;

const REFRESCO_MS = 30_000;

/** "Maria Gainza" → "MG" */
const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
const claveCarrito = (turno: string) => `pos:carrito:${turno}`;
const claveCobro = (turno: string) => `pos:cobro:${turno}`;

function leerJSON<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function PuntoVenta({ turnoId, sede, cajero, productosIniciales }: Props) {
  const router = useRouter();
  const imprimir = useImprimir();
  const supabase = useMemo(() => crearClienteNavegador(), []);

  const [productos, setProductos] = useState(productosIniciales);
  const [carrito, despachar] = useReducer(reducirCarrito, [] as Carrito);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "advertencia" } | null>(null);
  const [ultimaVenta, setUltimaVenta] = useState<{ numero: number; cambio: number | null; total: number } | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [reporte, setReporte] = useState<DatosReporte | null>(null);
  const hidratado = useRef(false);
  /** true después de cerrar el turno: se detienen las revisiones y se muestra solo el resultado */
  const cerrado = useRef(false);

  // ── Carrito persistido por turno (sobrevive recargas) ──
  useEffect(() => {
    const guardado = leerJSON<Carrito>(claveCarrito(turnoId));
    if (guardado) {
      const { carrito: ajustado } = conciliarCarrito(guardado, productosIniciales);
      despachar({ tipo: "reemplazar", carrito: ajustado });
    }
    hidratado.current = true;
  }, [turnoId, productosIniciales]);

  useEffect(() => {
    if (hidratado.current) localStorage.setItem(claveCarrito(turnoId), JSON.stringify(carrito));
  }, [carrito, turnoId]);

  // ── Conexión ──
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  const turnoCerradoPorOtro = useCallback(() => {
    if (cerrado.current) return;
    localStorage.removeItem(claveCarrito(turnoId));
    localStorage.removeItem(claveCobro(turnoId));
    setVentana(null);
    setAviso({ texto: "Tu turno fue cerrado. Abre uno nuevo para vender", tipo: "advertencia" });
    router.refresh();
  }, [router, turnoId]);

  /**
   * Recarga los productos vendibles y ajusta el carrito (precios nuevos,
   * productos retirados). Devuelve el aviso de cambios o null.
   */
  const carritoRef = useRef(carrito);
  useEffect(() => {
    carritoRef.current = carrito;
  }, [carrito]);

  const sincronizar = useCallback(async (): Promise<string | null> => {
    const vigentes = await cargarProductosVendibles(supabase);
    setProductos(vigentes);
    const r = conciliarCarrito(carritoRef.current, vigentes);
    if (!r.cambio) return null;
    despachar({ tipo: "reemplazar", carrito: r.carrito });
    const partes = [];
    if (r.retirados.length) partes.push(`Ya no se venden: ${r.retirados.join(", ")}`);
    if (r.conPrecioNuevo.length) partes.push(`Precio nuevo: ${r.conPrecioNuevo.join(", ")}`);
    return partes.join(". ");
  }, [supabase]);

  // ── Refresco periódico: productos (≤ 60 s) y estado del turno ──
  useEffect(() => {
    async function tick() {
      if (cerrado.current) return;
      if (document.visibilityState !== "visible") return;
      try {
        const [cambios, turno] = await Promise.all([
          sincronizar(),
          supabase.from("turnos").select("cerrado_en").eq("id", turnoId).maybeSingle(),
        ]);
        if (turno.data?.cerrado_en) return turnoCerradoPorOtro();
        if (cambios) setAviso({ texto: cambios, tipo: "advertencia" });
      } catch {
        // sin conexión: se reintenta en el próximo ciclo
      }
    }
    const id = setInterval(tick, REFRESCO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [sincronizar, supabase, turnoId, turnoCerradoPorOtro]);

  /**
   * Cambios del carrito hechos por el cajero. Si lo deja vacío, abandonó ese cobro:
   * se descarta la clave pendiente para que un carrito idéntico posterior sea una venta nueva.
   */
  function cambiarCarrito(accion: AccionCarrito) {
    const quedaVacio = reducirCarrito(carrito, accion).length === 0;
    if (quedaVacio) localStorage.removeItem(claveCobro(turnoId));
    despachar(accion);
    // Si se vacía durante el cobro, se sale del cobro (si no, el siguiente producto abre el cobro de una vez)
    if (quedaVacio && ventana === "cobro") setVentana(null);
  }

  // ── Cobro ──
  async function cobrar(metodo: MetodoPago, recibido: number | null, cliente: Cliente | null): Promise<ResultadoCobro> {
    const firma = firmaCarrito(carrito);
    const pendiente = leerJSON<{ clave: string; firma: string }>(claveCobro(turnoId));
    // Mismo carrito → misma clave: si el cobro anterior sí llegó, la BD no lo duplica
    const clave = pendiente?.firma === firma ? pendiente.clave : nuevoUUID();
    localStorage.setItem(claveCobro(turnoId), JSON.stringify({ clave, firma }));

    const { data, error } = await supabase.rpc("registrar_venta", {
      p_clave: clave,
      p_metodo: metodo,
      p_lineas: carrito.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad, precio: l.precio })),
      p_recibido: recibido,
      // Consumidor Final no se envía: la BD lo pone por defecto
      ...(cliente && !esConsumidorFinal(cliente) ? { p_cliente: cliente } : {}),
    });

    if (error) {
      if (esCodigo(error, "TURNO_CERRADO")) {
        turnoCerradoPorOtro();
        return { ok: false, error: mensajeDeError(error), reintentable: false };
      }
      if (esCodigo(error, "PRECIOS_ACTUALIZADOS")) {
        const cambios = await sincronizar().catch(() => null);
        return {
          ok: false,
          error: `${cambios ?? "Algunos precios cambiaron"}. Revisa el total y confirma de nuevo`,
          reintentable: false,
        };
      }
      if (esErrorDeRed(error) || !navigator.onLine) {
        return { ok: false, error: "Sin conexión. El carrito se conserva", reintentable: true };
      }
      return { ok: false, error: mensajeDeError(error, "No se pudo registrar la venta"), reintentable: true };
    }

    const ticket = data as DatosTicket;
    localStorage.removeItem(claveCobro(turnoId));
    despachar({ tipo: "vaciar" });
    imprimir({ tipo: "ticket", datos: ticket, copia: false });
    // Sin ventana de confirmación: vuelve a vender y el cambio queda a la vista
    setUltimaVenta({ numero: ticket.numero, cambio: ticket.cambio, total: ticket.total });
    setVentana(null);
    return { ok: true, cambio: ticket.cambio };
  }

  // ── Cierre ──
  function pedirCierre() {
    if (carrito.length > 0) {
      setAviso({ texto: "Vacía el carrito antes de cerrar el turno", tipo: "advertencia" });
      return;
    }
    setVentana("cierre");
  }

  async function cerrarTurno(contado: number, aMayor: number) {
    const { data, error } = await supabase.rpc("cerrar_turno", { p_turno: turnoId, p_contado: contado, p_a_mayor: aMayor });
    if (error) {
      if (esCodigo(error, "TURNO_CERRADO")) {
        turnoCerradoPorOtro();
        return null;
      }
      const red = esErrorDeRed(error) || !navigator.onLine;
      return { error: red ? "Sin conexión. Intenta de nuevo" : mensajeDeError(error, "No se pudo cerrar"), reintentable: true };
    }
    const datos = data as DatosReporte;
    localStorage.removeItem(claveCarrito(turnoId));
    localStorage.removeItem(claveCobro(turnoId));
    setVentana(null);
    cerrado.current = true;
    setReporte(datos);
    imprimir({ tipo: "reporte", datos, copia: false });
    // Turno cerrado = fin de la sesión del cajero. La pantalla de resultado sigue visible
    // (con reimprimir), pero cualquier recarga lleva al inicio de sesión del siguiente cajero.
    void supabase.auth.signOut({ scope: "local" });
    return null;
  }

  if (reporte) return <ResultadoCierre reporte={reporte} />;

  const cantidades = new Map(carrito.map((l) => [l.productoId, l.cantidad]));
  const enCobro = ventana === "cobro" && carrito.length > 0;
  const botonCabecera =
    "flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-tarjeta px-3 font-semibold text-white hover:bg-white/15 active:bg-white/25";
  const botonDestacado =
    "flex min-h-12 items-center gap-2 rounded-tarjeta bg-white px-5 text-base font-bold text-primario-activo shadow-sm hover:bg-exito-suave active:scale-[0.97]";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Cabecera: mismo verde que la barra de la app instalada (PWA), para que se vean como una sola */}
      <header className="flex items-center gap-3 bg-primario px-3 py-2 text-white">
        {enCobro ? (
          <button
            type="button"
            onClick={() => setVentana(null)}
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-tarjeta bg-white/15 px-4 font-semibold hover:bg-white/25 active:bg-white/30"
          >
            <ArrowLeft size={20} aria-hidden />
            Volver a la venta
          </button>
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-tarjeta bg-white/15" aria-hidden>
            <ShoppingCart size={22} />
          </span>
        )}

        <div className="mr-auto min-w-0 border-l border-white/25 pl-3">
          <p className="truncate font-semibold">{sede}</p>
          <p className="text-xs text-white/75">{enCobro ? "Cobro" : "Venta"}</p>
        </div>

        {/* Ventas y Gastos: lo que el cajero usa durante el turno, bien visibles */}
        {!enCobro && (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setVentana("ventas")} className={botonDestacado}>
              <Receipt size={22} aria-hidden />
              Ventas
            </button>
            <button type="button" onClick={() => setVentana("gastos")} className={botonDestacado}>
              <Wallet size={22} aria-hidden />
              Gastos
            </button>
          </div>
        )}

        {/* Cajero, conexión y acciones del turno */}
        <div className="flex shrink-0 items-center gap-2 border-l border-white/25 pl-3">
          <div className="hidden items-center gap-2 xl:flex">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/25 text-sm font-bold" aria-hidden>
              {iniciales(cajero)}
            </span>
            <span>
              <span className="block text-[10px] font-semibold tracking-wider text-white/75 uppercase">Cajero en turno</span>
              <span className="block text-sm font-semibold">{cajero}</span>
            </span>
          </div>

          <span
            role="status"
            title={enLinea ? "En línea" : "Sin conexión"}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${enLinea ? "bg-white/15" : "bg-peligro"}`}
          >
            <span className={`size-2 rounded-full ${enLinea ? "bg-emerald-200" : "bg-white"}`} aria-hidden />
            <span className="hidden sm:inline">{enLinea ? "En línea" : "Sin conexión"}</span>
          </span>

          {/* Al cobrar no se puede cerrar ni salir a la mitad */}
          {!enCobro && (
            <>
              <button type="button" onClick={pedirCierre} className={botonCabecera}>
                <Lock size={20} aria-hidden />
                <span className="hidden lg:inline">Cerrar turno</span>
              </button>
              <button type="button" aria-label="Salir" onClick={() => setVentana("salir")} className={botonCabecera}>
                <LogOut size={20} aria-hidden />
              </button>
            </>
          )}
        </div>
      </header>

      {aviso && (
        <div className="px-3 pt-3">
          <Aviso
            tipo={aviso.tipo}
            accion={
              <Boton variante="fantasma" onClick={() => setAviso(null)}>
                OK
              </Boton>
            }
          >
            {aviso.texto}
          </Aviso>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3 pb-24 md:pb-3" aria-label={ventana === "cobro" ? "Cobro" : "Productos"}>
          {ultimaVenta && ventana !== "cobro" && (
            <div
              role="status"
              className="flex shrink-0 items-center gap-3 rounded-tarjeta border-2 border-primario bg-exito-suave px-4 py-2 text-primario-activo"
            >
              <CircleCheck size={28} aria-hidden />
              <p className="flex-1 font-semibold">
                Venta #{ultimaVenta.numero} registrada
                {ultimaVenta.cambio === null && " · " + formatearPesos(ultimaVenta.total)}
              </p>
              {ultimaVenta.cambio !== null && (
                <p className="text-right">
                  <span className="block text-xs font-semibold">CAMBIO</span>
                  <span className="num text-3xl leading-none font-bold">{formatearPesos(ultimaVenta.cambio)}</span>
                </p>
              )}
              <button
                type="button"
                aria-label="Ocultar"
                onClick={() => setUltimaVenta(null)}
                className="flex size-12 items-center justify-center rounded-control hover:bg-primario/10"
              >
                <X size={20} />
              </button>
            </div>
          )}
          {enCobro ? (
            <PanelCobro total={totalCarrito(carrito)} onCancelar={() => setVentana(null)} onConfirmar={cobrar} />
          ) : (
            <CuadriculaProductos
              productos={productos}
              cantidades={cantidades}
              onBuscando={(b) => b && setUltimaVenta(null)}
              onTocar={(p) => {
                setUltimaVenta(null);
                despachar({ tipo: "agregar", producto: p });
              }}
            />
          )}
        </section>
        <PanelCarrito
          carrito={carrito}
          despachar={cambiarCarrito}
          onCobrar={() => {
            setUltimaVenta(null);
            setVentana("cobro");
          }}
          cobroDeshabilitado={!enLinea || ventana === "cobro"}
        />
      </div>

      <PanelVentas abierto={ventana === "ventas"} turnoId={turnoId} onCerrar={() => setVentana(null)} />
      <PanelGastos abierto={ventana === "gastos"} turnoId={turnoId} onCerrar={() => setVentana(null)} onTurnoCerrado={turnoCerradoPorOtro} />
      <CierreTurno abierto={ventana === "cierre"} onCerrar={() => setVentana(null)} onConfirmar={cerrarTurno} />

      <Modal abierto={ventana === "salir"} titulo="Salir" onCerrar={() => setVentana(null)} ancho="sm">
        <div className="flex flex-col gap-4">
          <Aviso tipo="advertencia">Tu turno sigue abierto. Ciérralo antes de entregar la caja.</Aviso>
          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            <form action="/salir" method="post">
              <Boton type="submit" variante="peligro" className="w-full">
                Salir igual
              </Boton>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
