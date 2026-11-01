"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { decidir, type EstadoAutoguardado } from "@/lib/dominio/autoguardado";
import { CANTIDAD_MAX, cantidadConUnidad, cantidadParaCampo, leerCantidad, sumarFraccion, type Unidad } from "@/lib/dominio/inventario";

export type ResultadoGuardado = "ok" | "invalido" | "red";

type Props = {
  etiqueta: string;
  valor: number;
  unidad: Unidad;
  /** Productos de venta: enteros, sin atajos de fracción */
  soloEnteros: boolean;
  guardar: (valor: number) => Promise<ResultadoGuardado>;
};

const FRACCIONES = [
  { valor: 0.25, texto: "+¼" },
  { valor: 0.5, texto: "+½" },
  { valor: 0.75, texto: "+¾" },
];

/** Selector de todos los campos de cantidad, para que Enter pase al siguiente. */
const SELECTOR = "input[data-cantidad]";

function enfocarSiguiente(actual: HTMLInputElement) {
  const campos = Array.from(document.querySelectorAll<HTMLInputElement>(SELECTOR));
  const siguiente = campos[campos.indexOf(actual) + 1];
  if (siguiente) {
    siguiente.focus();
    siguiente.select();
  } else {
    actual.blur();
  }
}

/**
 * Cantidad de una línea del inventario. Devuelve dos piezas que la fila ubica por separado:
 * - `cantidad`: el total contado, con guardado automático (al salir o con Enter, que pasa a la
 *   siguiente línea). Mismas reglas que CampoAutoguardado; vacío = 0.
 * - `adicionar`: "+ adicionar" (lo que se encuentra después se suma al contado, enteros o
 *   fracciones) y, en materias primas, los atajos +¼ +½ +¾.
 */
export function useCampoCantidad({ etiqueta, valor, unidad, soloEnteros, guardar }: Props): {
  cantidad: ReactNode;
  adicionar: ReactNode;
} {
  const [confirmado, setConfirmado] = useState(valor);
  const [texto, setTexto] = useState(valor === 0 ? "" : cantidadParaCampo(valor));
  const [estado, setEstado] = useState<EstadoAutoguardado>("inicial");
  const [textoSuma, setTextoSuma] = useState("");
  const [sumaInvalida, setSumaInvalida] = useState(false);
  /** Última adición (p. ej. "+5"), para confirmar al usuario qué se agregó */
  const [sumado, setSumado] = useState<string | null>(null);
  const tocado = useRef(false);
  const pendiente = useRef<number | null>(null);
  const enviando = useRef(false);
  const leer = (t: string) => leerCantidad(t, soloEnteros);

  async function enviar(v: number) {
    pendiente.current = v;
    if (enviando.current) return; // al terminar se envía el más reciente
    enviando.current = true;
    setEstado("guardando");
    let r: ResultadoGuardado = "ok";
    let enviado = v;
    while (pendiente.current !== null) {
      enviado = pendiente.current;
      r = await guardar(enviado).catch((): ResultadoGuardado => "red");
      if (r !== "ok" || pendiente.current === enviado) break;
    }
    enviando.current = false;
    if (r === "ok") {
      pendiente.current = null;
      tocado.current = false;
      setConfirmado(enviado);
      setTexto(enviado === 0 ? "" : cantidadParaCampo(enviado));
      setEstado("guardado");
    } else if (r === "invalido") {
      pendiente.current = null;
      tocado.current = false;
      setTexto(confirmado === 0 ? "" : cantidadParaCampo(confirmado));
      setEstado("invalido");
    } else {
      setEstado("error-red");
    }
  }

  function alSalir() {
    const d = decidir(texto, confirmado, leer, tocado.current);
    if (d.tipo === "nada") {
      tocado.current = false;
      if (estado !== "error-red") setTexto(confirmado === 0 ? "" : cantidadParaCampo(confirmado));
      return;
    }
    if (d.tipo === "revertir") {
      tocado.current = false;
      setTexto(confirmado === 0 ? "" : cantidadParaCampo(confirmado));
      setEstado("invalido");
      return;
    }
    void enviar(d.valor);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      enfocarSiguiente(e.currentTarget); // el blur guarda
    }
  }

  function adicionarValor(v: number) {
    const base = leer(texto) ?? confirmado;
    if (base + v > CANTIDAD_MAX) {
      setSumaInvalida(true);
      return;
    }
    const nuevo = sumarFraccion(base, v);
    tocado.current = true;
    setTexto(cantidadParaCampo(nuevo));
    setTextoSuma("");
    setSumaInvalida(false);
    setSumado(`+${cantidadParaCampo(v)}`);
    void enviar(nuevo);
  }

  function adicionarEscrito() {
    if (textoSuma.trim() === "") return;
    const v = leer(textoSuma);
    if (v === 0) return setTextoSuma(""); // 0 no adiciona nada
    if (v === null) return setSumaInvalida(true);
    adicionarValor(v);
  }

  function alTeclearSuma(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarEscrito(); // queda en el campo, vacío, para seguir adicionando
    }
  }

  const rojo = estado === "invalido" || estado === "error-red";

  const cantidad = (
    <div className="flex flex-col items-end gap-1">
      <div className="relative w-28">
        <input
          data-cantidad
          aria-label={etiqueta}
          aria-invalid={rojo || undefined}
          inputMode={soloEnteros ? "numeric" : "decimal"}
          autoComplete="off"
          value={texto}
          placeholder="0"
          onChange={(e) => {
            tocado.current = true;
            setTexto(e.target.value);
            setSumado(null);
            if (estado === "invalido" || estado === "guardado") setEstado("inicial");
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={alSalir}
          onKeyDown={alTeclear}
          className={`num min-h-12 w-full rounded-control border bg-superficie py-2 pr-8 pl-3 text-right focus:outline-none focus:ring-1 ${
            rojo ? "border-peligro focus:ring-peligro" : "border-borde-activo focus:border-primario focus:ring-primario"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center" aria-hidden>
          {estado === "guardando" && <LoaderCircle size={16} className="animate-spin text-texto-3" />}
          {estado === "guardado" && <Check size={16} className="text-primario" />}
          {rojo && <CircleAlert size={16} className="text-peligro" />}
        </span>
      </div>
      {estado !== "error-red" && estado !== "invalido" && (sumado || !soloEnteros) && (
        <p className="text-xs text-texto-3">
          {sumado && estado === "guardado" && <span className="font-semibold text-primario">{sumado} · </span>}
          {soloEnteros ? (sumado && estado === "guardado" ? `total ${cantidadParaCampo(confirmado)}` : null) : cantidadConUnidad(confirmado, unidad)}
        </p>
      )}
      {estado === "invalido" && (
        <p role="alert" className="text-xs text-peligro">
          {soloEnteros ? "Solo números enteros" : "Número no válido (ej.: 9,5)"}
        </p>
      )}
      {estado === "error-red" && (
        <p role="alert" className="flex items-center gap-1 text-xs text-peligro">
          No se guardó
          <button
            type="button"
            onClick={() => pendiente.current !== null && enviar(pendiente.current)}
            className="inline-flex min-h-8 items-center gap-1 rounded-control px-2 font-semibold underline"
          >
            <RotateCw size={12} aria-hidden />
            Reintentar
          </button>
        </p>
      )}
    </div>
  );

  const adicionar = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <div className="relative w-32">
          <span className="num pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-texto-3" aria-hidden>
            +
          </span>
          <input
            aria-label={`Adicionar a ${etiqueta}`}
            aria-invalid={sumaInvalida || undefined}
            title="Lo que encuentres después: se adiciona al contado (Enter)"
            inputMode={soloEnteros ? "numeric" : "decimal"}
            autoComplete="off"
            value={textoSuma}
            placeholder="adicionar"
            onChange={(e) => {
              setTextoSuma(e.target.value);
              setSumaInvalida(false);
            }}
            onBlur={adicionarEscrito}
            onKeyDown={alTeclearSuma}
            className={`num min-h-12 w-full rounded-control border border-dashed bg-suave py-2 pr-3 pl-7 text-right placeholder:text-sm focus:bg-superficie focus:outline-none focus:ring-1 ${
              sumaInvalida ? "border-peligro focus:ring-peligro" : "border-borde-activo focus:border-primario focus:ring-primario"
            }`}
          />
        </div>
        {!soloEnteros &&
          FRACCIONES.map((f) => (
            <button
              key={f.valor}
              type="button"
              // No quita el foco del campo de cantidad: así no se guarda dos veces
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => adicionarValor(f.valor)}
              aria-label={`Adicionar ${f.texto.slice(1)} ${unidad}`}
              className="num min-h-12 min-w-11 rounded-control border border-borde text-sm text-texto-2 hover:bg-suave"
            >
              {f.texto}
            </button>
          ))}
      </div>
      {sumaInvalida && (
        <p role="alert" className="text-xs text-peligro">
          {soloEnteros ? "Solo números enteros" : "Número no válido (ej.: 1,5)"}
        </p>
      )}
    </div>
  );

  return { cantidad, adicionar };
}
