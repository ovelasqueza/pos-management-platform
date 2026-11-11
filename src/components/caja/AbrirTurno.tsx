"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LockOpen, LogOut, Printer, RefreshCw, UserRoundCog } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { esCodigo, mensajeDeError } from "@/lib/dominio/errores";
import { formatearHora } from "@/lib/dominio/fechas";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";
import { PantallaMonto, TecladoNumerico } from "./TecladoNumerico";

type Props = {
  sede: string;
  cajero: string;
  ultimoReporte: DatosReporte | null;
  /** Turno abierto por otro cajero en esta sede (una caja por sede) */
  ocupada: { cajero: string; abierto_en: string } | null;
  /** Lo que quedó en caja en el último cierre de la sede (el cajero la puede cambiar) */
  baseSugerida: number | null;
};

export function AbrirTurno({ sede, cajero, ultimoReporte, ocupada, baseSugerida }: Props) {
  const router = useRouter();
  const imprimir = useImprimir();
  const [base, setBase] = useState(baseSugerida === null ? "" : String(baseSugerida));
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  function abrir() {
    if (base === "") {
      setError("Escribe la base del cajón (puede ser 0)");
      return;
    }
    setError(undefined);
    iniciar(async () => {
      const { error: e } = await crearClienteNavegador().rpc("abrir_turno", { p_base: Number(base) });
      if (e && esCodigo(e, "CAJA_OCUPADA")) {
        router.refresh(); // muestra la pantalla de caja ocupada
        return;
      }
      if (e && !esCodigo(e, "TURNO_YA_ABIERTO")) {
        setError(mensajeDeError(e, "No se pudo abrir el turno. Revisa la conexión"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-2">
        <div>
          <p className="font-semibold">{sede}</p>
          <p className="text-sm text-texto-3">{cajero}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/salir" method="post">
            <Boton type="submit" variante="fantasma" icono={<LogOut size={20} aria-hidden />}>
              Salir
            </Boton>
          </form>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {ocupada ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-advertencia-suave text-advertencia">
              <LockKeyhole size={32} aria-hidden />
            </span>
            <h1 className="text-2xl font-semibold">Caja ocupada</h1>
            <p className="text-texto-2">
              <strong>{ocupada.cajero}</strong> tiene el turno abierto desde las{" "}
              <span className="num">{formatearHora(ocupada.abierto_en)}</span>.
            </p>
            <p className="text-sm text-texto-3">
              Para abrir tu turno, {ocupada.cajero} debe cerrar el suyo (o el administrador desde Turnos).
            </p>
            <div className="grid w-full grid-cols-2 gap-2">
              <Boton icono={<RefreshCw size={18} aria-hidden />} onClick={() => router.refresh()}>
                Actualizar
              </Boton>
              <form action="/salir" method="post">
                <Boton type="submit" variante="primario" className="w-full" icono={<UserRoundCog size={18} aria-hidden />}>
                  Cambiar usuario
                </Boton>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col gap-4">
            <h1 className="text-center text-2xl font-semibold">Abrir turno</h1>
            <PantallaMonto etiqueta="Base del cajón" texto={base} />
            {baseSugerida !== null && (
              <p className="-mt-2 text-center text-sm text-texto-3">Quedó en el cajón en el último cierre</p>
            )}
            <TecladoNumerico valor={base} onCambiar={setBase} onEnter={() => !pendiente && abrir()} />
            {error && <Aviso>{error}</Aviso>}
            <Boton variante="primario" tamano="lg" disabled={pendiente} onClick={abrir} icono={<LockOpen size={22} aria-hidden />}>
              {pendiente ? "Abriendo…" : "Abrir turno"}
            </Boton>
            {ultimoReporte && (
              <Boton
                variante="fantasma"
                icono={<Printer size={20} aria-hidden />}
                onClick={() => imprimir({ tipo: "reporte", datos: ultimoReporte, copia: true })}
              >
                Reimprimir último reporte
              </Boton>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
