"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, CloudUpload, Lock, LogOut, Receipt, ShoppingCart, Vault, Wallet, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { cargarProductosVendibles } from "@/lib/caja/productos";
import { BOTON_CAJON_ACTIVO, abrirCajonSinPapel } from "@/lib/caja/cajon";
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
import { CONSUMIDOR_FINAL, esConsumidorFinal, type Cliente } from "@/lib/dominio/cliente";
import { nuevoUUID } from "@/lib/uuid";
import type { DatosReporte, DatosTicket } from "@/lib/dominio/documentos";
import { esCodigo, esErrorDeRed, esErrorDeSesion, mensajeDeError } from "@/lib/dominio/errores";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Modal } from "@/components/ui/Modal";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";
import { SelectorPapel } from "@/components/impresion/SelectorPapel";
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

/** Texto del botón Cajón según el resultado: "papel" = el agente no respondió y se imprimió la página mínima. */
const TEXTO_CAJON = {
  listo: "Cajón",
  abriendo: "Abriendo…",
  abierto: "¡Abierto!",
  papel: "Abierto (papel)",
} as const;

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
const claveColaVentas = (turno: string) => `pos:cola_ventas:${turno}`;

type VentaEncolada = {
  clave: string;
  metodo: MetodoPago;
  lineas: { producto_id: string; nombre: string; cantidad: number; precio: number }[];
  recibido: number | null;
  total: number;
  cambio: number | null;
  cliente: Cliente | null;
  fecha: string;
};

const pausar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

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
  const [ultimaVenta, setUltimaVenta] = useState<{ numero: number | null; cambio: number | null; total: number } | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [reporte, setReporte] = useState<DatosReporte | null>(null);
  const [colaVentas, setColaVentas] = useState<VentaEncolada[]>([]);
  const [sincronizandoCola, setSincronizandoCola] = useState(false);
  const hidratado = useRef(false);
  /** true después de cerrar el turno: se detienen las revisiones y se muestra solo el resultado */
  const cerrado = useRef(false);

  // ── Carrito y cola de ventas persistidos por turno (sobreviven recargas y cortes) ──
  useEffect(() => {
    const guardado = leerJSON<Carrito>(claveCarrito(turnoId));
    if (guardado) {
      const { carrito: ajustado } = conciliarCarrito(guardado, productosIniciales);
      despachar({ tipo: "reemplazar", carrito: ajustado });
    }
    hidratado.current = true;
    const encoladas = leerJSON<VentaEncolada[]>(claveColaVentas(turnoId));
    if (Array.isArray(encoladas) && encoladas.length > 0) {
      const t = window.setTimeout(() => setColaVentas(encoladas), 0);
      return () => window.clearTimeout(t);
    }
  }, [turnoId, productosIniciales]);

  useEffect(() => {
    if (hidratado.current) localStorage.setItem(claveCarrito(turnoId), JSON.stringify(carrito));
  }, [carrito, turnoId]);

  useEffect(() => {
    if (!hidratado.current) return;
    if (colaVentas.length === 0) localStorage.removeItem(claveColaVentas(turnoId));
    else localStorage.setItem(claveColaVentas(turnoId), JSON.stringify(colaVentas));
  }, [colaVentas, turnoId]);

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

  const alTocarProducto = useCallback((p: ProductoVendible) => {
    setUltimaVenta(null);
    despachar({ tipo: "agregar", producto: p });
  }, []);

  const alBuscarProducto = useCallback((b: boolean) => {
    if (b) setUltimaVenta(null);
  }, []);

  /**
   * Envía una venta a Supabase con hasta 3 intentos automáticos, refresco de sesión
   * si el token expiró durante un turno 24/7 y recuperación ante colisión 23505.
   */
  const enviarVentaASupabase = useCallback(
    async (
      clave: string,
      metodo: MetodoPago,
      lineas: { producto_id: string; cantidad: number; precio: number }[],
      recibido: number | null,
      cliente: Cliente | null,
    ): Promise<{ ticket: DatosTicket | null; error: { code?: string; message?: string } | null }> => {
      const esperas = [0, 800, 1800];
      let ultimoError: { code?: string; message?: string } | null = null;
      let lineasActuales = lineas;

      for (let intento = 0; intento < esperas.length; intento++) {
        if (esperas[intento] > 0) await pausar(esperas[intento]);

        const { data, error } = await supabase.rpc("registrar_venta", {
          p_clave: clave,
          p_metodo: metodo,
          p_lineas: lineasActuales,
          p_recibido: recibido,
          ...(cliente && !esConsumidorFinal(cliente) ? { p_cliente: cliente } : {}),
        });

        if (!error && data) {
          return { ticket: data as DatosTicket, error: null };
        }

        ultimoError = error;
        if (!error) continue;

        // Si el intento anterior sí llegó y chocó en la restricción única de clave (23505), recuperamos el ticket
        if (error.code === "23505") {
          const { data: existente } = await supabase.from("ventas").select("id").eq("clave", clave).maybeSingle();
          if (existente?.id) {
            const { data: recuperado } = await supabase.rpc("ticket_venta", { p_venta: existente.id });
            if (recuperado) return { ticket: recuperado as DatosTicket, error: null };
          }
        }

        // Si la sesión expiró tras horas de inactividad en un turno 24/7, la refrescamos y reintentamos
        if (esErrorDeSesion(error)) {
          await supabase.auth.refreshSession().catch(() => null);
          continue;
        }

        // Si el admin cambió precios y la BD aún exige coincidencia estricta, conciliamos y reintentamos si cubre el total
        if (esCodigo(error, "PRECIOS_ACTUALIZADOS")) {
          try {
            const vigentes = await cargarProductosVendibles(supabase);
            setProductos(vigentes);
            const mapaPrecios = new Map(vigentes.map((p) => [p.id, p.precio]));
            const todasDisponibles = lineasActuales.every((l) => mapaPrecios.has(l.producto_id));
            if (todasDisponibles) {
              const nuevasLineas = lineasActuales.map((l) => ({
                ...l,
                precio: mapaPrecios.get(l.producto_id) ?? l.precio,
              }));
              const nuevoTotal = nuevasLineas.reduce((s, l) => s + l.cantidad * l.precio, 0);
              if (metodo !== "efectivo" || (recibido !== null && recibido >= nuevoTotal)) {
                lineasActuales = nuevasLineas;
                continue;
              }
            }
          } catch {
            // Si falla la recarga, sale por el flujo normal
          }
          break;
        }

        // Errores de negocio definitivos no se reintentan
        if (!esErrorDeRed(error)) break;
      }

      return { ticket: null, error: ultimoError };
    },
    [supabase],
  );

  // ── Sincronizador automático de la cola de ventas guardadas cuando hubo corte de red ──
  const procesandoColaRef = useRef(false);
  const sincronizarCola = useCallback(async (): Promise<boolean> => {
    if (procesandoColaRef.current || cerrado.current) return false;
    const pendientes = leerJSON<VentaEncolada[]>(claveColaVentas(turnoId)) ?? [];
    if (pendientes.length === 0) {
      setColaVentas([]);
      return true;
    }
    procesandoColaRef.current = true;
    setSincronizandoCola(true);
    try {
      const restantes = [...pendientes];
      while (restantes.length > 0) {
        const actual = restantes[0];
        const { ticket, error } = await enviarVentaASupabase(
          actual.clave,
          actual.metodo,
          actual.lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio: l.precio })),
          actual.recibido,
          actual.cliente,
        );
        if (ticket) {
          restantes.shift();
          setColaVentas([...restantes]);
          if (restantes.length === 0) localStorage.removeItem(claveColaVentas(turnoId));
          else localStorage.setItem(claveColaVentas(turnoId), JSON.stringify(restantes));
          continue;
        }
        if (error && esCodigo(error, "TURNO_CERRADO")) {
          turnoCerradoPorOtro();
          return false;
        }
        // Si sigue sin internet, conservamos el resto en la cola para el próximo intento
        return false;
      }
      return true;
    } finally {
      procesandoColaRef.current = false;
      setSincronizandoCola(false);
    }
  }, [enviarVentaASupabase, turnoId, turnoCerradoPorOtro]);

  // Solo activa temporizador de reintento cuando existen ventas pendientes en la cola (0 peticiones en reposo)
  useEffect(() => {
    if (colaVentas.length === 0) return;
    const inicial = window.setTimeout(() => void sincronizarCola(), 50);
    const alVolverEnLinea = () => void sincronizarCola();
    window.addEventListener("online", alVolverEnLinea);
    const id = window.setInterval(() => {
      if (navigator.onLine) void sincronizarCola();
    }, 12_000);
    return () => {
      window.clearTimeout(inicial);
      window.removeEventListener("online", alVolverEnLinea);
      window.clearInterval(id);
    };
  }, [colaVentas.length, sincronizarCola]);

  // ── Cobro garantizado (reintentos en caliente + cola local ante caída total de red) ──
  const cobrandoRef = useRef(false);
  async function cobrar(metodo: MetodoPago, recibido: number | null, cliente: Cliente | null): Promise<ResultadoCobro> {
    if (cobrandoRef.current) {
      return { ok: false, error: "Registrando la venta…", reintentable: false };
    }
    cobrandoRef.current = true;
    try {
      const firma = firmaCarrito(carrito);
      const pendiente = leerJSON<{ clave: string; firma: string }>(claveCobro(turnoId));
      // Mismo carrito → misma clave: si el cobro anterior sí llegó, la BD no lo duplica
      const clave = pendiente?.firma === firma ? pendiente.clave : nuevoUUID();
      localStorage.setItem(claveCobro(turnoId), JSON.stringify({ clave, firma }));

      const lineasEnvio = carrito.map((l) => ({
        producto_id: l.productoId,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio: l.precio,
      }));
      const total = totalCarrito(carrito);
      const montoRecibido = metodo === "efectivo" ? recibido : null;
      const cambio = montoRecibido !== null ? montoRecibido - total : null;

      const { ticket, error } = await enviarVentaASupabase(
        clave,
        metodo,
        lineasEnvio.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio: l.precio })),
        montoRecibido,
        cliente,
      );

      if (ticket) {
        localStorage.removeItem(claveCobro(turnoId));
        despachar({ tipo: "vaciar" });
        imprimir({ tipo: "ticket", datos: ticket, copia: false });
        setUltimaVenta({ numero: ticket.numero, cambio: ticket.cambio, total: ticket.total });
        setVentana(null);
        if (colaVentas.length > 0) void sincronizarCola();
        return { ok: true, cambio: ticket.cambio };
      }

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
        // Si después de los 3 intentos automáticos no hay red, guardamos la venta en la cola persistente
        // del turno para que jamás se pierda ni detenga la fila de clientes, y la subimos apenas vuelva la red.
        if (esErrorDeRed(error) || !navigator.onLine) {
          const nuevaEncolada: VentaEncolada = {
            clave,
            metodo,
            lineas: lineasEnvio,
            recibido: montoRecibido,
            total,
            cambio,
            cliente: cliente && !esConsumidorFinal(cliente) ? cliente : null,
            fecha: new Date().toISOString(),
          };
          const actuales = leerJSON<VentaEncolada[]>(claveColaVentas(turnoId)) ?? [];
          const actualizadas = actuales.some((v) => v.clave === clave) ? actuales : [...actuales, nuevaEncolada];
          localStorage.setItem(claveColaVentas(turnoId), JSON.stringify(actualizadas));
          setColaVentas(actualizadas);

          const clienteTicket = cliente ?? CONSUMIDOR_FINAL;
          const ticketLocal: DatosTicket = {
            venta_id: clave,
            numero: 0,
            fecha: nuevaEncolada.fecha,
            sede: { nombre: sede, direccion: null, telefono: null },
            cajero,
            metodo,
            total,
            recibido: montoRecibido,
            cambio,
            cliente: { tipo: clienteTicket.tipo, documento: clienteTicket.documento, nombre: clienteTicket.nombre },
            lineas: lineasEnvio.map((l) => ({
              nombre: l.nombre,
              cantidad: l.cantidad,
              precio: l.precio,
              subtotal: l.cantidad * l.precio,
            })),
          };

          localStorage.removeItem(claveCobro(turnoId));
          despachar({ tipo: "vaciar" });
          imprimir({ tipo: "ticket", datos: ticketLocal, copia: false });
          setUltimaVenta({ numero: null, cambio, total });
          setVentana(null);
          return { ok: true, cambio };
        }

        return { ok: false, error: mensajeDeError(error, "No se pudo registrar la venta"), reintentable: true };
      }

      return { ok: false, error: "No se pudo registrar la venta", reintentable: true };
    } finally {
      cobrandoRef.current = false;
    }
  }

  // ── Cajón: sin papel con el agente del equipo; si no está, con la impresión mínima ──
  const abriendoCajon = useRef(false);
  const temporizadorCajon = useRef<number | null>(null);
  const [estadoCajon, setEstadoCajon] = useState<"listo" | "abriendo" | "abierto" | "papel">("listo");
  useEffect(
    () => () => {
      if (temporizadorCajon.current !== null) window.clearTimeout(temporizadorCajon.current);
    },
    [],
  );
  async function abrirCajon() {
    if (abriendoCajon.current) return;
    abriendoCajon.current = true;
    if (temporizadorCajon.current !== null) window.clearTimeout(temporizadorCajon.current);
    navigator.vibrate?.(12);
    setEstadoCajon("abriendo");
    try {
      const sinPapel = await abrirCajonSinPapel();
      if (!sinPapel) imprimir({ tipo: "cajon" });
      setEstadoCajon(sinPapel ? "abierto" : "papel");
    } finally {
      abriendoCajon.current = false;
      temporizadorCajon.current = window.setTimeout(() => setEstadoCajon("listo"), 1600);
    }
  }

  // ── Cierre ──
  async function pedirCierre() {
    if (carrito.length > 0) {
      setAviso({ texto: "Vacía el carrito antes de cerrar el turno", tipo: "advertencia" });
      return;
    }
    if (colaVentas.length > 0) {
      const ok = await sincronizarCola();
      if (!ok) {
        setAviso({
          texto: `Hay ${colaVentas.length} venta(s) pendiente(s) por subir a la nube. Verifica el internet antes de cerrar el turno.`,
          tipo: "advertencia",
        });
        return;
      }
    }
    setVentana("cierre");
  }

  const cerrandoRef = useRef(false);
  async function cerrarTurno(contado: number, aMayor: number) {
    if (cerrandoRef.current) return null;
    cerrandoRef.current = true;
    try {
      if (colaVentas.length > 0) {
        const ok = await sincronizarCola();
        if (!ok) {
          return { error: "Aún hay ventas guardadas subiendo a la nube. Revisa la conexión e intenta de nuevo", reintentable: true };
        }
      }
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
    } finally {
      cerrandoRef.current = false;
    }
  }

  const cantidades = useMemo(() => new Map(carrito.map((l) => [l.productoId, l.cantidad])), [carrito]);

  if (reporte) return <ResultadoCierre reporte={reporte} />;

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

          {colaVentas.length > 0 && (
            <button
              type="button"
              onClick={() => void sincronizarCola()}
              disabled={sincronizandoCola}
              className="flex items-center gap-1.5 rounded-full bg-advertencia px-3 py-1.5 text-xs font-semibold text-white"
              title="Ventas guardadas en este equipo pendientes por subir a Supabase"
            >
              <CloudUpload size={16} aria-hidden />
              <span>
                {sincronizandoCola ? "Subiendo…" : `${colaVentas.length} por sincronizar`}
              </span>
            </button>
          )}

          {/* Solo se muestra sin conexión (con conexión no hace falta avisar) */}
          {!enLinea && (
            <span role="status" className="flex items-center gap-2 rounded-full bg-peligro px-3 py-1.5 text-xs font-semibold">
              <span className="size-2 rounded-full bg-white" aria-hidden />
              <span className="hidden sm:inline">Sin conexión</span>
            </span>
          )}

          {/* Al cobrar no se puede cerrar ni salir a la mitad */}
          {!enCobro && (
            <>
              <div className="hidden md:block">
                <SelectorPapel />
              </div>
              {BOTON_CAJON_ACTIVO && (
                <button
                  type="button"
                  onClick={abrirCajon}
                  disabled={estadoCajon === "abriendo"}
                  className={botonCabecera}
                  aria-label="Abrir cajón"
                >
                  <Vault size={20} aria-hidden />
                  <span className="hidden lg:inline">{TEXTO_CAJON[estadoCajon]}</span>
                  <span className="sr-only" role="status" aria-live="polite">
                    {estadoCajon === "listo" ? "" : TEXTO_CAJON[estadoCajon]}
                  </span>
                </button>
              )}
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
                {ultimaVenta.numero !== null ? `Venta #${ultimaVenta.numero} registrada` : "Venta guardada (se subirá al volver la red)"}
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
          {enCobro && <PanelCobro total={totalCarrito(carrito)} onCancelar={() => setVentana(null)} onConfirmar={cobrar} />}
          <CuadriculaProductos
            productos={productos}
            cantidades={cantidades}
            oculto={enCobro}
            onBuscando={alBuscarProducto}
            onTocar={alTocarProducto}
          />
        </section>
        <PanelCarrito
          carrito={carrito}
          despachar={cambiarCarrito}
          onCobrar={() => {
            setUltimaVenta(null);
            setVentana("cobro");
          }}
          cobroDeshabilitado={ventana === "cobro"}
        />
      </div>

      <PanelVentas abierto={ventana === "ventas"} turnoId={turnoId} onCerrar={() => setVentana(null)} onTurnoCerrado={turnoCerradoPorOtro} />
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
