"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Check, CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { decidir, type EstadoAutoguardado } from "@/lib/dominio/autoguardado";

type Props = {
  etiqueta: string;
  /** Valor confirmado en la BD (null = vacío) */
  valor: number | null;
  /** Convierte el texto a número o null si es inválido */
  leer: (texto: string) => number | null;
  /** Guarda en la BD; devuelve true si se guardó */
  guardar: (valor: number) => Promise<boolean>;
  formatear?: (valor: number) => string;
  placeholder?: string;
};

/**
 * Campo numérico que se guarda solo al salir o con Enter.
 * - Sin cambios → no hace nada.
 * - Inválido → marca en rojo y vuelve al valor anterior.
 * - Falla de red → conserva lo escrito y ofrece Reintentar.
 */
export function CampoAutoguardado({ etiqueta, valor, leer, guardar, formatear = String, placeholder }: Props) {
  const [confirmado, setConfirmado] = useState(valor);
  const [texto, setTexto] = useState(valor === null ? "" : formatear(valor));
  const [estado, setEstado] = useState<EstadoAutoguardado>("inicial");
  const tocado = useRef(false);
  const pendiente = useRef<number | null>(null);

  async function enviar(v: number) {
    pendiente.current = v;
    setEstado("guardando");
    const ok = await guardar(v).catch(() => false);
    if (ok) {
      setConfirmado(v);
      setTexto(formatear(v));
      pendiente.current = null;
      tocado.current = false;
      setEstado("guardado");
    } else {
      setEstado("error-red");
    }
  }

  function alSalir() {
    if (estado === "guardando") return;
    const d = decidir(texto, confirmado, leer, tocado.current);
    if (d.tipo === "nada") {
      tocado.current = false;
      if (estado !== "error-red") setTexto(confirmado === null ? "" : formatear(confirmado));
      return;
    }
    if (d.tipo === "revertir") {
      tocado.current = false;
      setTexto(confirmado === null ? "" : formatear(confirmado));
      setEstado("invalido");
      return;
    }
    void enviar(d.valor);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  const rojo = estado === "invalido" || estado === "error-red";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative w-36">
        <input
          aria-label={etiqueta}
          aria-invalid={rojo || undefined}
          inputMode="numeric"
          value={texto}
          placeholder={placeholder}
          onChange={(e) => {
            tocado.current = true;
            setTexto(e.target.value);
            if (estado === "invalido" || estado === "guardado") setEstado("inicial");
          }}
          onBlur={alSalir}
          onKeyDown={alTeclear}
          className={`num min-h-12 w-full rounded-control border bg-superficie py-2 pr-9 pl-3 text-right focus:outline-none focus:ring-1 ${
            rojo ? "border-peligro focus:ring-peligro" : "border-borde-activo focus:border-primario focus:ring-primario"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center" aria-hidden>
          {estado === "guardando" && <LoaderCircle size={16} className="animate-spin text-texto-3" />}
          {estado === "guardado" && <Check size={16} className="text-primario" />}
          {rojo && <CircleAlert size={16} className="text-peligro" />}
        </span>
      </div>
      {estado === "invalido" && (
        <p role="alert" className="text-xs text-peligro">
          Valor no válido
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
}
