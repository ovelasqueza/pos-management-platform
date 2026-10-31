"use client";

import { useState } from "react";
import { Lock, RotateCw } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { PantallaMonto, TecladoNumerico } from "./TecladoNumerico";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  /** Cierra en la BD; devuelve el mensaje de error o null si cerró */
  onConfirmar: (contado: number) => Promise<{ error: string; reintentable: boolean } | null>;
};

/** Arqueo ciego: el cajero escribe lo contado sin ver el esperado. */
export function CierreTurno({ abierto, onCerrar, onConfirmar }: Props) {
  const [contado, setContado] = useState("");
  const [paso, setPaso] = useState<"contar" | "confirmar">("contar");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ error: string; reintentable: boolean } | null>(null);

  function cerrar() {
    if (enviando) return;
    setPaso("contar");
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    setEnviando(true);
    setError(null);
    const r = await onConfirmar(Number(contado));
    setEnviando(false);
    if (r) setError(r); // se conserva lo contado para reintentar
  }

  return (
    <Modal abierto={abierto} titulo="Cerrar turno" onCerrar={cerrar} ancho="sm">
      {paso === "contar" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto-2">Cuenta el efectivo de la caja y escríbelo.</p>
          <PantallaMonto etiqueta="Efectivo contado" texto={contado} />
          <TecladoNumerico valor={contado} onCambiar={setContado} onEnter={() => contado !== "" && setPaso("confirmar")} />
          <Boton variante="primario" tamano="lg" disabled={contado === ""} onClick={() => setPaso("confirmar")}>
            Continuar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-texto-3">EFECTIVO CONTADO</p>
          <p className="num text-[40px] leading-[48px] font-bold">{formatearPesos(Number(contado))}</p>
          <p className="text-sm text-texto-2">¿Es correcto? Al confirmar se cierra el turno.</p>
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
            <Boton variante="primario" disabled={enviando} onClick={confirmar} icono={<Lock size={18} aria-hidden />}>
              {enviando ? "Cerrando…" : "Cerrar turno"}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
