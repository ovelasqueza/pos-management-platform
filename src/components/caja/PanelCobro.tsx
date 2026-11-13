"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeftRight, Banknote, Delete, Pencil, Printer, QrCode, RotateCw, UserRound, X, type LucideIcon } from "lucide-react";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { calcularEfectivo, type MetodoPago } from "@/lib/dominio/cobro";
import {
  CONSUMIDOR_FINAL,
  TIPOS_DOCUMENTO,
  esConsumidorFinal,
  validarCliente,
  type Cliente,
} from "@/lib/dominio/cliente";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { useTecladoFisico } from "./tecladoFisico";

export type ResultadoCobro = { ok: true; cambio: number | null } | { ok: false; error: string; reintentable: boolean };
export type PartesMixto = { efectivo: number; transferencia: number };

type Props = {
  total: number;
  onCancelar: () => void;
  onConfirmar: (
    metodo: MetodoPago,
    recibido: number | null,
    cliente: Cliente | null,
    imprimirTicket: boolean,
    mixto?: PartesMixto | null,
  ) => Promise<ResultadoCobro>;
};

/* Billetes y monedas de Colombia: imágenes en public/billetes (Banco de la República). */
const BILLETES = [2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
const MONEDAS = [50, 100, 200, 500, 1_000];
const TECLAS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "000", "0", "borrar"] as const;
type Tecla = (typeof TECLAS)[number] | "limpiar";

const METODOS: { valor: MetodoPago; nombre: string; etiqueta?: ReactNode; icono: LucideIcon }[] = [
  { valor: "efectivo", nombre: "Efectivo", icono: Banknote },
  { valor: "transferencia", nombre: "QR", icono: QrCode },
  {
    valor: "mixto",
    nombre: "Pago combinado",
    etiqueta: (
      <>
        Pago
        <br />
        combinado
      </>
    ),
    icono: ArrowLeftRight,
  },
];

const miles = (v: number) => new Intl.NumberFormat("es-CO").format(v);

const tarjeta = "rounded-tarjeta border border-borde bg-superficie hover:border-borde-activo active:scale-[0.97] active:bg-suave";

/** Columnas compartidas por el resumen y por billetes/teclado: 3 iguales · separador · teclado. */
const COLUMNAS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1rem_minmax(14rem,19rem)]";

/**
 * Cobro en la misma pantalla.
 * Fila 1: Volver + métodos de pago (grandes, ancho completo).
 * Fila 2: Total · Recibido · Cambio/Falta · Exacto (4 columnas iguales).
 * Fila 3: billetes y monedas | separador | teclado numérico (filas alineadas).
 */
export function PanelCobro({ total, onCancelar, onConfirmar }: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [recibido, setRecibido] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [error, setError] = useState<{
    texto: string;
    reintentable: boolean;
    recibido: number | null;
    mixto?: PartesMixto | null;
  } | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<{
    metodo: MetodoPago;
    monto: number | null;
    mixto?: PartesMixto | null;
  } | null>(null);
  const [cliente, setCliente] = useState<Cliente>(CONSUMIDOR_FINAL);
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [editandoMixto, setEditandoMixto] = useState(false);
  const [imprimirTicket, setImprimirTicket] = useState(false);

  const efectivo = calcularEfectivo(total, recibido);

  /** Pide confirmación antes de cobrar (salvo Paga Exacto, que ejecuta directo). */
  function confirmar(m: MetodoPago, monto: number | null, mixto?: PartesMixto | null) {
    if (enviandoRef.current || enviando) return;
    setPorConfirmar({ metodo: m, monto, mixto: mixto ?? null });
  }

  async function ejecutar(m: MetodoPago, monto: number | null, mixto?: PartesMixto | null) {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setPorConfirmar(null);
    setEnviando(true);
    setError(null);
    try {
      const r = await onConfirmar(m, monto, esConsumidorFinal(cliente) ? null : cliente, imprimirTicket, mixto ?? null);
      if (!r.ok) setError({ texto: r.error, reintentable: r.reintentable, recibido: monto, mixto: mixto ?? null });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  // Enter = confirmar el cobro pendiente; Escape = cancelar la confirmación o volver a la venta
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (enviando || editandoCliente || editandoMixto) return;
      if (porConfirmar && e.key === "Enter") {
        e.preventDefault();
        void ejecutar(porConfirmar.metodo, porConfirmar.monto, porConfirmar.mixto);
      } else if (e.key === "Escape") {
        if (porConfirmar) setPorConfirmar(null);
        else onCancelar();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  const sumar = (v: number) => {
    setError(null);
    setRecibido((r) => Math.min(r + v, 999_999_999));
  };

  /** Teclado numérico: edita el valor recibido dígito a dígito. */
  const teclear = (t: Tecla) => {
    setError(null);
    if (t === "limpiar") return setRecibido(0);
    setRecibido((r) => {
      const actual = r === 0 ? "" : String(r);
      if (t === "borrar") return Number(actual.slice(0, -1) || "0");
      const nuevo = actual + t;
      return nuevo.length > 9 ? r : Number(nuevo);
    });
  };

  // Teclado físico: dígitos y Retroceso/Supr para el recibido; Enter = Cobrar
  const raiz = useRef<HTMLDivElement>(null);
  useTecladoFisico(raiz, (t) => {
    if (porConfirmar || enviando || editandoCliente || editandoMixto) return false;
    if (t === "enter") {
      if (metodo === "transferencia") return confirmar(metodo, null);
      if (!efectivo.completo) return false;
      if (efectivo.cambio === 0) return void ejecutar("efectivo", recibido);
      return confirmar("efectivo", recibido);
    }
    if (metodo !== "efectivo") return false;
    teclear(t);
  });

  return (
    <div ref={raiz} className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {porConfirmar && (
        <Confirmacion
          total={total}
          metodo={porConfirmar.metodo}
          recibido={porConfirmar.monto}
          mixto={porConfirmar.mixto}
          imprimirTicket={imprimirTicket}
          onCambiarImprimir={setImprimirTicket}
          onSi={() => ejecutar(porConfirmar.metodo, porConfirmar.monto, porConfirmar.mixto)}
          onNo={() => setPorConfirmar(null)}
          cliente={cliente}
        />
      )}

      <DatosCliente
        abierto={editandoCliente}
        actual={cliente}
        onGuardar={(c) => {
          setCliente(c);
          setEditandoCliente(false);
        }}
        onCerrar={() => setEditandoCliente(false)}
      />

      <ModalPagoCombinado
        abierto={editandoMixto}
        total={total}
        enviando={enviando}
        onCerrar={() => setEditandoMixto(false)}
        onConfirmar={(partes) => {
          setEditandoMixto(false);
          void ejecutar("mixto", partes.efectivo, partes);
        }}
      />

      {/* Fila 1: métodos de pago + cliente (Volver está en la barra superior de cobro) */}
      <div className="flex shrink-0 gap-2">
        <div className="grid flex-1 grid-cols-3 gap-2" role="radiogroup" aria-label="Método de pago">
          {METODOS.map(({ valor, nombre, etiqueta, icono: Icono }) => {
            const activo = valor === "mixto" ? editandoMixto : metodo === valor && !editandoMixto;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={nombre}
                onClick={() => {
                  setError(null);
                  if (valor === "mixto") {
                    setEditandoMixto(true);
                  } else {
                    setMetodo(valor);
                  }
                }}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-tarjeta border-2 px-2 text-lg leading-tight font-bold ${
                  activo
                    ? "border-primario bg-primario text-white"
                    : "border-borde bg-superficie text-texto-2 hover:border-borde-activo"
                }`}
              >
                <Icono size={24} className="shrink-0" aria-hidden />
                <span className="text-left">{etiqueta ?? nombre}</span>
              </button>
            );
          })}
        </div>

        {/* Impresión opcional: por defecto apagada ("Sin impresión"). Tocar para activar/desactivar. */}
        <button
          type="button"
          role="switch"
          aria-checked={imprimirTicket}
          onClick={() => setImprimirTicket((v) => !v)}
          className={`flex min-h-14 shrink-0 items-center gap-2.5 rounded-tarjeta border-2 px-3.5 text-left transition-colors ${
            imprimirTicket
              ? "border-primario bg-exito-suave text-primario-activo"
              : "border-borde bg-superficie text-texto-3 hover:border-borde-activo"
          }`}
        >
          <Printer size={22} className={imprimirTicket ? "text-primario" : "text-texto-3"} aria-hidden />
          <span className="leading-tight">
            <span className="block text-[10px] font-bold tracking-wider uppercase">Recibo</span>
            <span className="block text-sm font-bold">{imprimirTicket ? "Sí imprimir" : "Sin impresión"}</span>
          </span>
        </button>

        {/* Cliente: por defecto Consumidor Final (DIAN). Tocar para poner los datos. */}
        <button
          type="button"
          onClick={() => setEditandoCliente(true)}
          aria-label={`Cliente: ${cliente.nombre}, ${cliente.tipo} ${cliente.documento}. Cambiar`}
          className={`flex min-h-14 w-56 shrink-0 items-center gap-3 rounded-tarjeta border-2 px-3 text-left ${
            esConsumidorFinal(cliente)
              ? "border-borde bg-superficie hover:border-borde-activo"
              : "border-primario bg-exito-suave"
          }`}
        >
          <UserRound size={24} className={esConsumidorFinal(cliente) ? "text-texto-3" : "text-primario"} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{cliente.nombre}</span>
            <span className="num block truncate text-xs text-texto-3">
              {cliente.tipo} {cliente.documento}
            </span>
          </span>
          <Pencil size={16} className="shrink-0 text-texto-3" aria-hidden />
        </button>
      </div>

      {metodo === "efectivo" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Fila 2: Total · Falta/Cambio · Recibido encima del teclado */}
          <div className={`mb-2 grid shrink-0 gap-x-2 ${COLUMNAS}`}>
            <Dato titulo="TOTAL" valor={total} />
            <div className="col-span-2">
              {efectivo.completo ? (
                <Dato titulo="CAMBIO A ENTREGAR" valor={efectivo.cambio} estilo="border-2 border-primario bg-exito-suave text-primario-activo" grande vivo />
              ) : (
                <Dato titulo="FALTA" valor={efectivo.falta} estilo="border-advertencia/40 bg-advertencia-suave text-advertencia" grande vivo />
              )}
            </div>
            <span aria-hidden />
            {/* Recibido: se llena al digitar o tocar billetes */}
            <div className="relative flex flex-col justify-center rounded-tarjeta border-2 border-primario bg-superficie px-3 py-2" aria-live="polite">
              <p className="text-xs font-semibold text-texto-3">RECIBIDO</p>
              <p className={`num truncate pr-9 text-right text-3xl font-bold tracking-tight ${recibido ? "text-texto" : "text-texto-3"}`}>
                {formatearPesos(recibido)}
                <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-primario align-middle" style={{ height: "0.9em" }} aria-hidden />
              </p>
              <button
                type="button"
                onClick={() => teclear("limpiar")}
                disabled={recibido === 0}
                aria-label="Borrar todo lo recibido"
                title="Borrar todo"
                className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full text-texto-3 hover:bg-peligro-suave hover:text-peligro disabled:opacity-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Fila 3: billetes | teclado — y abajo monedas | Exacto */}
          <div className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 ${COLUMNAS}`}>
            {/* Billetes: 3 columnas alineadas con el resumen */}
            <div className="col-span-3 grid min-h-0 grid-cols-3 grid-rows-2 gap-2">
              {BILLETES.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => sumar(valor)}
                  aria-label={`Billete de ${miles(valor)}`}
                  className={`flex min-h-0 flex-col items-center gap-1 p-2 ${tarjeta}`}
                >
                  <span className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- WebP local cacheado por el Service Worker */}
                    <img
                      src={`/billetes/${valor}_new.webp`}
                      alt=""
                      decoding="async"
                      draggable={false}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  </span>
                  <span className="num shrink-0 text-lg font-bold">${miles(valor)}</span>
                </button>
              ))}
            </div>

            {/* Separación (solo espacio, sin línea) */}
            <div className="row-span-2" aria-hidden />

            {/* Teclado */}
            <div className="grid min-h-0 grid-cols-3 grid-rows-4 gap-2" role="group" aria-label="Teclado numérico">
              {TECLAS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => teclear(t)}
                  aria-label={t === "borrar" ? "Borrar último dígito" : t}
                  disabled={t === "borrar" && recibido === 0}
                  className={`num flex min-h-0 items-center justify-center text-3xl font-bold disabled:opacity-40 ${tarjeta}`}
                >
                  {t === "borrar" ? <Delete size={30} aria-hidden /> : t}
                </button>
              ))}
            </div>

            {/* Monedas */}
            <div className="col-span-3 grid grid-cols-5 gap-2">
              {MONEDAS.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => sumar(valor)}
                  aria-label={`Moneda de ${miles(valor)}`}
                  className={`flex flex-col items-center gap-1 p-2 ${tarjeta}`}
                >
                  <span className="relative flex size-12 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- WebP local cacheado por el Service Worker */}
                    <img
                      src={`/billetes/moneda-${valor}.webp`}
                      alt=""
                      width={48}
                      height={48}
                      decoding="async"
                      draggable={false}
                      className="size-12 select-none object-contain"
                    />
                  </span>
                  <span className="num text-sm font-bold">${miles(valor)}</span>
                </button>
              ))}
            </div>

            {/* Exacto (efectivo) o Mitad y mitad (mixto) */}
            <button
              type="button"
              disabled={enviando}
              onClick={() => void ejecutar("efectivo", total)}
              className="col-start-5 flex flex-col items-center justify-center rounded-tarjeta border-2 border-primario bg-exito-suave font-bold text-primario-activo active:scale-[0.97] active:bg-primario active:text-white"
            >
              <span className="text-xs tracking-wider">{enviando ? "REGISTRANDO…" : "PAGA EXACTO"}</span>
              <span className="num text-2xl">{formatearPesos(total)}</span>
            </button>
          </div>

          {error && (
            <ErrorCobro
              error={error}
              enviando={enviando}
              reintentar={() => ejecutar(error.mixto ? "mixto" : metodo, error.recibido, error.mixto)}
            />
          )}

          <Boton
            variante="primario"
            tamano="lg"
            className="w-full shrink-0 text-xl"
            disabled={!efectivo.completo || enviando}
            onClick={() => (efectivo.completo && efectivo.cambio === 0 ? void ejecutar("efectivo", recibido) : confirmar("efectivo", recibido))}
          >
            {enviando
              ? "Registrando…"
              : efectivo.completo
                ? `Cobrar · Cambio ${formatearPesos(efectivo.cambio)}`
                : "Toca los billetes o escribe lo que entrega el cliente"}
          </Boton>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="flex size-28 items-center justify-center rounded-full bg-exito-suave text-primario">
            <QrCode size={64} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-texto-3">TOTAL</p>
            <p className="num text-5xl font-bold tracking-tight">{formatearPesos(total)}</p>
          </div>
          <p className="max-w-md text-lg text-texto-2">
            Muestra el QR al cliente y confirma cuando veas el pago (Nequi, Daviplata o banco).
          </p>
          {error && <ErrorCobro error={error} enviando={enviando} reintentar={() => ejecutar(metodo, null)} />}
          <Boton variante="primario" tamano="lg" className="w-full max-w-md text-xl" disabled={enviando} onClick={() => confirmar(metodo, null)}>
            {enviando ? "Registrando…" : `Confirmar pago ${formatearPesos(total)}`}
          </Boton>
        </div>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  estilo = "border-borde bg-superficie",
  vivo,
  grande,
}: {
  titulo: string;
  valor: number;
  estilo?: string;
  vivo?: boolean;
  grande?: boolean;
}) {
  return (
    <div className={`flex h-full flex-col justify-center rounded-tarjeta border px-3 py-2 ${estilo}`} aria-live={vivo ? "polite" : undefined}>
      <p className="text-xs font-semibold opacity-80">{titulo}</p>
      <p className={`num truncate font-bold ${grande ? "text-3xl tracking-tight" : "text-2xl"}`}>{formatearPesos(valor)}</p>
    </div>
  );
}

/** Datos del cliente (opcional). "Consumidor final" vuelve al valor por defecto. */
function DatosCliente({
  abierto,
  actual,
  onGuardar,
  onCerrar,
}: {
  abierto: boolean;
  actual: Cliente;
  onGuardar: (c: Cliente) => void;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} titulo="Cliente" onCerrar={onCerrar} ancho="sm">
      {abierto && <FormCliente actual={actual} onGuardar={onGuardar} />}
    </Modal>
  );
}

function FormCliente({ actual, onGuardar }: { actual: Cliente; onGuardar: (c: Cliente) => void }) {
  const inicial = esConsumidorFinal(actual) ? { tipo: "CC", documento: "", nombre: "" } : actual;
  const [tipo, setTipo] = useState<string>(inicial.tipo);
  const [documento, setDocumento] = useState(inicial.documento);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [errores, setErrores] = useState<Partial<Record<keyof Cliente, string>>>({});

  function guardar(e: FormEvent) {
    e.preventDefault();
    const r = validarCliente({ tipo, documento, nombre });
    if (!r.ok) return setErrores(r.errores);
    onGuardar(r.cliente);
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <Boton tamano="lg" icono={<UserRound size={20} aria-hidden />} onClick={() => onGuardar(CONSUMIDOR_FINAL)}>
        Consumidor final (222222222222)
      </Boton>
      <p className="text-center text-xs text-texto-3">o escribe los datos del cliente</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="cliente-tipo" className="text-sm font-semibold text-texto-2">
          Tipo de documento
        </label>
        <select
          id="cliente-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="min-h-12 rounded-control border border-borde-activo bg-superficie px-4 focus:border-primario focus:outline-none"
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.nombre} ({t.valor})
            </option>
          ))}
        </select>
      </div>
      <Campo
        etiqueta="Número"
        inputMode="numeric"
        autoComplete="off"
        value={documento}
        onChange={(e) => setDocumento(e.target.value.replace(/[^0-9-]/g, "").slice(0, 17))}
        error={errores.documento}
        className="num"
        autoFocus
      />
      <Campo etiqueta="Nombre o razón social" autoComplete="off" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} />
      <Boton type="submit" variante="primario" tamano="lg">
        Usar este cliente
      </Boton>
    </form>
  );
}

/** Confirmación corta sobre el panel de cobro: lo esencial y dos botones. Enter = sí, Esc = no. */
function Confirmacion({
  total,
  metodo,
  recibido,
  mixto,
  imprimirTicket,
  onCambiarImprimir,
  onSi,
  onNo,
  cliente,
}: {
  total: number;
  metodo: MetodoPago;
  recibido: number | null;
  mixto?: PartesMixto | null;
  imprimirTicket: boolean;
  onCambiarImprimir: (v: boolean) => void;
  onSi: () => void;
  onNo: () => void;
  cliente: Cliente;
}) {
  const nombre = METODOS.find((m) => m.valor === metodo)?.nombre ?? metodo;
  const cambio = metodo === "efectivo" && recibido !== null ? recibido - total : null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-tarjeta bg-fondo/80 p-4" role="alertdialog" aria-modal="true" aria-label="Confirmar cobro">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-modal border border-borde-activo bg-superficie p-5 text-center shadow-modal">
        <div>
          <p className="text-sm font-semibold text-texto-3">¿Cobrar con {nombre === "QR" ? "QR" : nombre.toLowerCase()}?</p>
          <p className="num text-4xl font-bold tracking-tight">{formatearPesos(total)}</p>
          {metodo === "mixto" && mixto && (
            <p className="num mt-1 text-sm font-semibold text-texto-2">
              Efectivo {formatearPesos(mixto.efectivo)} · QR {formatearPesos(mixto.transferencia)}
            </p>
          )}
          <p className="mt-1 truncate text-sm text-texto-2">
            {cliente.nombre} · {cliente.tipo} {cliente.documento}
          </p>
        </div>
        {cambio !== null && (
          <div className="rounded-tarjeta bg-exito-suave py-2 text-primario-activo">
            <p className="text-xs font-semibold">CAMBIO</p>
            <p className="num text-3xl font-bold">{formatearPesos(cambio)}</p>
          </div>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={imprimirTicket}
          onClick={() => onCambiarImprimir(!imprimirTicket)}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-control border text-sm font-semibold ${
            imprimirTicket
              ? "border-primario bg-exito-suave text-primario-activo"
              : "border-borde bg-suave text-texto-3"
          }`}
        >
          <Printer size={18} aria-hidden />
          {imprimirTicket ? "Imprimir recibo: Sí" : "Imprimir recibo: No (sin impresión)"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Boton tamano="lg" onClick={onNo}>
            No
          </Boton>
          <Boton variante="primario" tamano="lg" onClick={onSi} autoFocus>
            Sí, cobrar
          </Boton>
        </div>
      </div>
    </div>
  );
}

function ErrorCobro({
  error,
  enviando,
  reintentar,
}: {
  error: { texto: string; reintentable: boolean };
  enviando: boolean;
  reintentar: () => void;
}) {
  return (
    <Aviso
      accion={
        error.reintentable && (
          <Boton variante="secundario" icono={<RotateCw size={16} aria-hidden />} onClick={reintentar} disabled={enviando}>
            Reintentar
          </Boton>
        )
      }
    >
      {error.texto}
    </Aviso>
  );
}

const conMiles = (texto: string) => {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9);
  return digitos ? new Intl.NumberFormat("es-CO").format(Number(digitos)) : "";
};

function ModalPagoCombinado({
  abierto,
  total,
  enviando,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  total: number;
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (partes: PartesMixto) => void;
}) {
  const [textoEfectivo, setTextoEfectivo] = useState("");
  const [textoQr, setTextoQr] = useState("");

  if (!abierto) return null;

  const montoEfectivo = leerPesos(textoEfectivo, 0) ?? 0;
  const montoQr = leerPesos(textoQr, 0) ?? 0;
  const suma = montoEfectivo + montoQr;
  const diferencia = total - suma;
  const completo = suma === total && montoEfectivo > 0 && montoQr > 0;

  const cerrar = () => {
    setTextoEfectivo("");
    setTextoQr("");
    onCerrar();
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!completo || enviando) return;
    onConfirmar({ efectivo: montoEfectivo, transferencia: montoQr });
  };

  return (
    <Modal abierto={abierto} titulo="Pago combinado" onCerrar={cerrar} ancho="sm">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between rounded-tarjeta bg-suave px-4 py-2.5">
          <span className="text-sm font-semibold text-texto-3">Total a pagar</span>
          <span className="num text-2xl font-bold">{formatearPesos(total)}</span>
        </div>

        <Campo
          etiqueta="Efectivo"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          autoFocus
          value={textoEfectivo}
          onChange={(e) => setTextoEfectivo(conMiles(e.target.value))}
          className="num text-right text-xl font-bold"
        />

        <Campo
          etiqueta="QR"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={textoQr}
          onChange={(e) => setTextoQr(conMiles(e.target.value))}
          className="num text-right text-xl font-bold"
        />

        <div
          role="status"
          className={`rounded-tarjeta border px-4 py-2.5 text-center text-sm font-bold ${
            completo
              ? "border-primario bg-exito-suave text-primario-activo"
              : diferencia < 0
                ? "border-peligro/40 bg-peligro-suave text-peligro"
                : "border-advertencia/40 bg-advertencia-suave text-advertencia"
          }`}
        >
          {completo
            ? "Completo · Listo para cobrar"
            : diferencia > 0
              ? `Faltan ${formatearPesos(diferencia)}`
              : diferencia < 0
                ? `Sobran ${formatearPesos(Math.abs(diferencia))}`
                : "Ambos montos deben ser mayores a $ 0"}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Boton type="button" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" disabled={!completo || enviando}>
            {enviando ? "Registrando…" : "Cobrar"}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
