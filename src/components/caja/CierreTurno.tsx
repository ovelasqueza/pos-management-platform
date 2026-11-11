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
 * Arqueo ciego: el cajero escribe lo contado sin ver el esperado.
 * Deja automáticamente la base fija de $100.000 en el cajón y envía el resto a caja mayor.
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
          <p className="text-sm text-texto-2">Cuenta el efectivo del cajón y escríbelo.</p>
          <PantallaMonto etiqueta="Efectivo contado" texto={contado} />
          <TecladoNumerico valor={contado} onCambiar={setContado} onEnter={() => contado !== "" && setPaso("confirmar")} />
          <Boton variante="primario" tamano="lg" disabled={contado === ""} onClick={() => setPaso("confirmar")}>
            Continuar
          </Boton>
        </div>
      )}

      {paso === "confirmar" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-semibold text-texto-3">EFECTIVO CONTADO</p>
            <p className="num text-[40px] leading-[48px] font-bold text-primario-activo">
              {formatearPesos(valorContado)}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-suave p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-texto-2">Base en caja menor (cajón)</span>
              <span className="num font-semibold text-texto">{formatearPesos(baseCaja)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-borde pt-2">
              <span className="flex items-center gap-1 font-medium text-texto">
                <Landmark size={16} className="text-primario" aria-hidden /> A caja mayor (resto)
              </span>
              <span className="num font-bold text-primario-activo">{formatearPesos(aMayor)}</span>
            </div>
          </div>

          <p className="text-center text-xs text-texto-3">
            QR y tarjeta pasan solos a caja mayor.
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
