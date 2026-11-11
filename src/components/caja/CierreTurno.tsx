"use client";

import { useRef, useState } from "react";
import { Landmark, Lock, RotateCw } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { calcularCierreBase } from "@/lib/dominio/cajaMayor";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { PantallaMonto, TecladoNumerico } from "./TecladoNumerico";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  /** Cierra en la BD; devuelve el mensaje de error o null si cerró */
  onConfirmar: (contado: number, aMayor: number) => Promise<{ error: string; reintentable: boolean } | null>;
};

type Paso = "contar" | "confirmar";

/**
 * Arqueo ciego: el cajero cuenta únicamente el efectivo de las ventas.
 * La base fija de $100.000 nunca se cuenta al entrar ni al salir y permanece en el cajón.
 */
export function CierreTurno({ abierto, onCerrar, onConfirmar }: Props) {
  const [contado, setContado] = useState("");
  const [paso, setPaso] = useState<Paso>("contar");
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [error, setError] = useState<{ error: string; reintentable: boolean } | null>(null);

  const valorContado = Number(contado);
  const { baseCaja, aMayor } = calcularCierreBase(valorContado);

  function cerrar() {
    if (enviando || enviandoRef.current) return;
    setPaso("contar");
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError(null);
    try {
      const r = await onConfirmar(valorContado, aMayor);
      if (r) setError(r); // se conserva lo escrito para reintentar
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Cerrar turno" onCerrar={cerrar} ancho="sm">
      {paso === "contar" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto-2">
            Cuenta el dinero de las ventas (los $100.000 de base se quedan en el cajón).
          </p>
          <PantallaMonto etiqueta="Efectivo de ventas" texto={contado} />
          <TecladoNumerico valor={contado} onCambiar={setContado} onEnter={() => contado !== "" && setPaso("confirmar")} />
          <Boton variante="primario" tamano="lg" disabled={contado === ""} onClick={() => setPaso("confirmar")}>
            Continuar
          </Boton>
        </div>
      )}

      {paso === "confirmar" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-semibold text-texto-3">EFECTIVO DE VENTAS</p>
            <p className="num text-[40px] leading-[48px] font-bold text-primario-activo">
              {formatearPesos(valorContado)}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-suave p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-medium text-texto">
                <Landmark size={16} className="text-primario" aria-hidden /> A caja mayor
              </span>
              <span className="num font-bold text-primario-activo">{formatearPesos(aMayor)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-borde pt-2">
              <span className="text-texto-2">Base fija permanente en cajón</span>
              <span className="num font-semibold text-texto">{formatearPesos(baseCaja)}</span>
            </div>
          </div>

          <p className="text-center text-xs text-texto-3">
            El efectivo de ventas va a caja mayor; la base de $100.000 se queda en el cajón.
          </p>

          {error && (
            <Aviso
              accion={
                error.reintentable && (
                  <Boton variante="secundario" icono={<RotateCw size={16} aria-hidden />} onClick={confirmar} disabled={enviando}>
                    Reintentar
                  </Boton>
                )
              }
            >
              {error.error}
            </Aviso>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setPaso("contar")} disabled={enviando}>
              Corregir
            </Boton>
            <Boton
              variante="primario"
              disabled={enviando}
              onClick={confirmar}
              icono={<Lock size={18} aria-hidden />}
            >
              {enviando ? "Cerrando…" : "Cerrar turno"}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
