"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Banknote, CreditCard, Delete, QrCode, RotateCw, type LucideIcon } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { calcularEfectivo, type MetodoPago } from "@/lib/dominio/cobro";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";

export type ResultadoCobro = { ok: true; cambio: number | null } | { ok: false; error: string; reintentable: boolean };

type Props = {
  total: number;
  onCancelar: () => void;
  onConfirmar: (metodo: MetodoPago, recibido: number | null) => Promise<ResultadoCobro>;
};

/* Billetes y monedas de Colombia: imágenes en public/billetes (Banco de la República). */
const BILLETES = [2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
const MONEDAS = [50, 100, 200, 500, 1_000];
const TECLAS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "000", "0", "borrar"] as const;
type Tecla = (typeof TECLAS)[number] | "limpiar";

const METODOS: { valor: MetodoPago; nombre: string; icono: LucideIcon }[] = [
  { valor: "efectivo", nombre: "Efectivo", icono: Banknote },
  { valor: "transferencia", nombre: "QR", icono: QrCode },
  { valor: "tarjeta", nombre: "Tarjeta", icono: CreditCard },
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
  const [error, setError] = useState<{ texto: string; reintentable: boolean; recibido: number | null } | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<{ metodo: MetodoPago; monto: number | null } | null>(null);

  const efectivo = calcularEfectivo(total, recibido);

  /** Todos los botones de cobro piden confirmación primero. */
  function confirmar(m: MetodoPago, monto: number | null) {
    if (enviando) return;
    setPorConfirmar({ metodo: m, monto });
  }

  async function ejecutar(m: MetodoPago, monto: number | null) {
    if (enviando) return;
    setPorConfirmar(null);
    setEnviando(true);
    setError(null);
    const r = await onConfirmar(m, monto);
    setEnviando(false);
    if (!r.ok) setError({ texto: r.error, reintentable: r.reintentable, recibido: monto });
  }

  // Enter = confirmar el cobro pendiente; Escape = cancelar la confirmación o volver a la venta
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (enviando) return;
      if (porConfirmar && e.key === "Enter") {
        e.preventDefault();
        void ejecutar(porConfirmar.metodo, porConfirmar.monto);
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

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {porConfirmar && (
        <Confirmacion
          total={total}
          metodo={porConfirmar.metodo}
          recibido={porConfirmar.monto}
          onSi={() => ejecutar(porConfirmar.metodo, porConfirmar.monto)}
          onNo={() => setPorConfirmar(null)}
        />
      )}

      {/* Fila 1: Volver + métodos de pago */}
      <div className="flex shrink-0 gap-2">
        <Boton variante="secundario" tamano="lg" onClick={onCancelar} disabled={enviando} aria-label="Volver a la venta" icono={<ArrowLeft size={22} aria-hidden />}>
          <span className="hidden lg:inline">Volver</span>
        </Boton>
        <div className="grid flex-1 grid-cols-3 gap-2" role="radiogroup" aria-label="Método de pago">
          {METODOS.map(({ valor, nombre, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={metodo === valor}
              onClick={() => {
                setMetodo(valor);
                setError(null);
              }}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-tarjeta border-2 text-lg font-bold ${
                metodo === valor
                  ? "border-primario bg-primario text-white"
                  : "border-borde bg-superficie text-texto-2 hover:border-borde-activo"
              }`}
            >
              <Icono size={24} aria-hidden />
              {nombre}
            </button>
          ))}
        </div>
      </div>

      {metodo === "efectivo" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Fila 2: Total · Recibido · Cambio/Falta · Exacto — mismas columnas que billetes y teclado */}
          <div className={`mb-2 grid shrink-0 gap-x-2 ${COLUMNAS}`}>
            <Dato titulo="TOTAL" valor={total} />
            <Dato titulo="RECIBIDO" valor={recibido} />
            {efectivo.completo ? (
              <Dato titulo="CAMBIO" valor={efectivo.cambio} estilo="border-2 border-primario bg-exito-suave text-primario-activo" vivo />
            ) : (
              <Dato titulo="FALTA" valor={efectivo.falta} estilo="border-advertencia/40 bg-advertencia-suave text-advertencia" vivo />
            )}
            <span aria-hidden />
            <button
              type="button"
              disabled={enviando}
              onClick={() => confirmar("efectivo", total)}
              className="flex flex-col items-center justify-center rounded-tarjeta border-2 border-primario bg-exito-suave px-3 py-2 font-bold text-primario-activo active:bg-primario active:text-white"
            >
              <span className="text-xs">EXACTO</span>
              <span className="num text-2xl">{formatearPesos(total)}</span>
            </button>
          </div>

          {/* Fila 3: billetes | separador | teclado — y abajo monedas | Limpiar. Mismas columnas que el resumen. */}
          <div className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 ${COLUMNAS}`}>
            {/* Billetes: 3 columnas alineadas con Total / Recibido / Falta */}
            <div className="col-span-3 grid min-h-0 grid-cols-3 grid-rows-2 gap-2">
              {BILLETES.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => sumar(valor)}
                  aria-label={`Billete de ${miles(valor)}`}
                  className={`flex min-h-0 flex-col items-center gap-1 p-2 ${tarjeta}`}
                >
                  <span className="relative min-h-0 w-full flex-1">
                    <Image src={`/billetes/${valor}.webp`} alt="" fill sizes="20vw" className="object-contain" />
                  </span>
                  <span className="num shrink-0 text-lg font-bold">${miles(valor)}</span>
                </button>
              ))}
            </div>

            {/* Separación (solo espacio, sin línea) */}
            <div className="row-span-2" aria-hidden />

            {/* Teclado: columna alineada con Exacto */}
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
                  <span className="relative size-12">
                    <Image src={`/billetes/moneda-${valor}.webp`} alt="" fill sizes="48px" className="object-contain" />
                  </span>
                  <span className="num text-sm font-bold">${miles(valor)}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => teclear("limpiar")}
              disabled={recibido === 0}
              className="col-start-5 flex items-center justify-center rounded-tarjeta border border-peligro-borde bg-superficie text-xl font-bold text-peligro active:bg-peligro-suave disabled:opacity-40"
            >
              Limpiar
            </button>
          </div>

          {error && <ErrorCobro error={error} enviando={enviando} reintentar={() => ejecutar("efectivo", error.recibido)} />}

          <Boton
            variante="primario"
            tamano="lg"
            className="w-full shrink-0 text-xl"
            disabled={!efectivo.completo || enviando}
            onClick={() => confirmar("efectivo", recibido)}
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
            {metodo === "transferencia" ? <QrCode size={64} aria-hidden /> : <CreditCard size={64} aria-hidden />}
          </span>
          <div>
            <p className="text-sm font-semibold text-texto-3">TOTAL</p>
            <p className="num text-5xl font-bold tracking-tight">{formatearPesos(total)}</p>
          </div>
          <p className="max-w-md text-lg text-texto-2">
            {metodo === "transferencia"
              ? "Muestra el QR al cliente y confirma cuando veas el pago (Nequi, Daviplata o banco)."
              : "Cobra en el datáfono y confirma cuando salga aprobado."}
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

function Dato({ titulo, valor, estilo = "border-borde bg-superficie", vivo }: { titulo: string; valor: number; estilo?: string; vivo?: boolean }) {
  return (
    <div className={`rounded-tarjeta border px-3 py-2 ${estilo}`} aria-live={vivo ? "polite" : undefined}>
      <p className="text-xs font-semibold opacity-80">{titulo}</p>
      <p className="num truncate text-2xl font-bold">{formatearPesos(valor)}</p>
    </div>
  );
}

/** Confirmación corta sobre el panel de cobro: lo esencial y dos botones. Enter = sí, Esc = no. */
function Confirmacion({
  total,
  metodo,
  recibido,
  onSi,
  onNo,
}: {
  total: number;
  metodo: MetodoPago;
  recibido: number | null;
  onSi: () => void;
  onNo: () => void;
}) {
  const nombre = METODOS.find((m) => m.valor === metodo)?.nombre ?? metodo;
  const cambio = recibido !== null ? recibido - total : null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-tarjeta bg-fondo/80 p-4" role="alertdialog" aria-modal="true" aria-label="Confirmar cobro">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-modal border border-borde-activo bg-superficie p-5 text-center shadow-modal">
        <div>
          <p className="text-sm font-semibold text-texto-3">¿Cobrar con {nombre === "QR" ? "QR" : nombre.toLowerCase()}?</p>
          <p className="num text-4xl font-bold tracking-tight">{formatearPesos(total)}</p>
        </div>
        {cambio !== null && (
          <div className="rounded-tarjeta bg-exito-suave py-2 text-primario-activo">
            <p className="text-xs font-semibold">CAMBIO</p>
            <p className="num text-3xl font-bold">{formatearPesos(cambio)}</p>
          </div>
        )}
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
