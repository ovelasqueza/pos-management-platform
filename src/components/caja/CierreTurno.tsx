"use client";

import { useRef, useState } from "react";
import { Landmark, Lock, RotateCw } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { envioValido, quedaEnCaja } from "@/lib/dominio/cajaMayor";
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

type Paso = "contar" | "confirmar" | "mayor";

/**
 * Arqueo ciego: el cajero escribe lo contado sin ver el esperado.
 * Después indica cuánto de ese efectivo va a la caja mayor (spec 06).
 */
export function CierreTurno({ abierto, onCerrar, onConfirmar }: Props) {
  const [contado, setContado] = useState("");
  const [aMayor, setAMayor] = useState("");
  const [paso, setPaso] = useState<Paso>("contar");
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [error, setError] = useState<{ error: string; reintentable: boolean } | null>(null);

  const valorContado = Number(contado);
  const valorMayor = aMayor === "" ? 0 : Number(aMayor);
  const envioOk = envioValido(valorContado, valorMayor);

  function cerrar() {
    if (enviando || enviandoRef.current) return;
    setPaso("contar");
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    if (!envioOk || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError(null);
    try {
      const r = await onConfirmar(valorContado, valorMayor);
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
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-texto-3">EFECTIVO CONTADO</p>
          <p className="num text-[40px] leading-[48px] font-bold">{formatearPesos(valorContado)}</p>
          <p className="text-sm text-texto-2">¿Es correcto?</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setPaso("contar")}>Corregir</Boton>
            <Boton
              variante="primario"
              onClick={() => {
                if (!envioValido(valorContado, valorMayor)) setAMayor("");
                setPaso("mayor");
              }}
            >
              Sí, continuar
            </Boton>
          </div>
        </div>
      )}

      {paso === "mayor" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-texto-2">
            <Landmark size={18} aria-hidden /> ¿Cuánto efectivo va a caja mayor? QR y tarjeta pasan solos.
          </p>
          <PantallaMonto etiqueta="A caja mayor" texto={aMayor} />
          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setAMayor("")} disabled={enviando}>
              Nada
            </Boton>
            <Boton onClick={() => setAMayor(contado)} disabled={enviando}>
              Todo
            </Boton>
          </div>
          <TecladoNumerico valor={aMayor} onCambiar={setAMayor} onEnter={() => !enviando && confirmar()} />
          <p className="flex justify-between rounded-control bg-suave px-3 py-2">
            <span className="text-texto-2">Queda en cajón</span>
            <span className={`num font-semibold ${envioOk ? "" : "text-peligro"}`}>
              {envioOk ? formatearPesos(quedaEnCaja(valorContado, valorMayor)) : "Más que lo contado"}
            </span>
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
            <Boton onClick={() => setPaso("confirmar")} disabled={enviando}>
              Atrás
            </Boton>
            <Boton variante="primario" disabled={enviando || !envioOk} onClick={confirmar} icono={<Lock size={18} aria-hidden />}>
              {enviando ? "Cerrando…" : "Cerrar turno"}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
