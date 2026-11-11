"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Eye, Lock, Printer, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora, formatearHora } from "@/lib/dominio/fechas";
import { clasificarDiferencia, nombreDiferencia, type ClaseDiferencia } from "@/lib/dominio/cobro";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { envioValido, quedaEnCaja } from "@/lib/dominio/cajaMayor";
import { cerrarTurnoAdmin } from "@/app/admin/[sede]/turnos/acciones";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { ReporteTurno } from "@/components/impresion/Documentos";
import { ProveedorImpresion, useImprimir } from "@/components/impresion/ProveedorImpresion";
import { VerCaja } from "@/components/admin/VerCaja";

export type TurnoFila = {
  id: string;
  cajero: string;
  sede: string;
  abiertoEn: string;
  cerradoEn: string | null;
  cerradoPorAdmin: boolean;
  esperado: number | null;
  contado: number | null;
  diferencia: number | null;
  reporte: DatosReporte | null;
};

const ICONO: Record<ClaseDiferencia, { icono: typeof CircleCheck; clase: string }> = {
  cuadrada: { icono: CircleCheck, clase: "text-primario" },
  sobrante: { icono: TrendingUp, clase: "text-advertencia" },
  faltante: { icono: TrendingDown, clase: "text-peligro" },
};

export function Diferencia({ valor }: { valor: number }) {
  const c = clasificarDiferencia(valor);
  const { icono: Icono, clase } = ICONO[c];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${clase}`} title={nombreDiferencia[c]}>
      <Icono size={16} aria-hidden />
      <span className="num">{formatearPesos(valor)}</span>
      <span className="sr-only">{nombreDiferencia[c]}</span>
    </span>
  );
}

function VerReporte({ reporte, cerrar }: { reporte: DatosReporte; cerrar: () => void }) {
  const imprimir = useImprimir();
  return (
    <Modal abierto titulo="Reporte de turno" onCerrar={cerrar} ancho="sm">
      <div className="flex flex-col gap-4">
        <div className="max-h-[60vh] overflow-y-auto rounded-tarjeta border border-borde bg-white">
          <ReporteTurno datos={reporte} copia={false} />
        </div>
        <Boton variante="primario" icono={<Printer size={20} aria-hidden />} onClick={() => imprimir({ tipo: "reporte", datos: reporte, copia: true })}>
          Imprimir
        </Boton>
      </div>
    </Modal>
  );
}

function CerrarTurno({ turno, cerrar, alCerrar }: { turno: TurnoFila; cerrar: () => void; alCerrar: (r: DatosReporte) => void }) {
  const [texto, setTexto] = useState("");
  const [textoMayor, setTextoMayor] = useState("");
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  const contadoActual = leerPesos(texto, 0);
  const mayorPorDefecto = contadoActual !== null ? Math.max(0, contadoActual - 100_000) : 0;
  const mayorActual = textoMayor.trim() === "" ? mayorPorDefecto : leerPesos(textoMayor, 0);

  function confirmar() {
    const contado = leerPesos(texto, 0);
    if (contado === null) return setError("Escribe el efectivo contado");
    const aMayor = textoMayor.trim() === "" ? Math.max(0, contado - 100_000) : leerPesos(textoMayor, 0);
    if (aMayor === null || !envioValido(contado, aMayor)) return setError("A caja mayor no puede ser más que lo contado");
    setError(undefined);
    iniciar(async () => {
      const r = await cerrarTurnoAdmin(turno.id, contado, aMayor);
      if (r.error || !r.reporte) setError(r.error);
      else alCerrar(r.reporte);
    });
  }

  return (
    <Modal abierto titulo="Cerrar turno" onCerrar={cerrar} ancho="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-2">
          {turno.cajero} · {turno.sede} · desde {formatearFechaHora(turno.abiertoEn)}
        </p>
        <Campo etiqueta="Efectivo contado" inputMode="numeric" value={texto} onChange={(e) => setTexto(e.target.value)} className="num" autoFocus />
        <Campo
          etiqueta="A caja mayor (efectivo)"
          inputMode="numeric"
          placeholder={contadoActual !== null ? String(mayorPorDefecto) : "0"}
          value={textoMayor}
          onChange={(e) => setTextoMayor(e.target.value)}
          className="num"
        />
        <p className="flex justify-between text-sm text-texto-2">
          <span>Base cajón ($100.000) · QR y tarjeta pasan solos a caja mayor</span>
          <span className="num font-semibold text-texto">
            {contadoActual !== null && mayorActual !== null && envioValido(contadoActual, mayorActual)
              ? formatearPesos(quedaEnCaja(contadoActual, mayorActual))
              : "—"}
          </span>
        </p>
        {error && <Aviso>{error}</Aviso>}
        <Boton variante="primario" disabled={pendiente} onClick={confirmar} icono={<Lock size={18} aria-hidden />}>
          {pendiente ? "Cerrando…" : "Cerrar turno"}
        </Boton>
      </div>
    </Modal>
  );
}

function Contenido({ abiertos, cerrados, mostrarSede }: { abiertos: TurnoFila[]; cerrados: TurnoFila[]; mostrarSede: boolean }) {
  const [cerrando, setCerrando] = useState<TurnoFila | null>(null);
  const [viendo, setViendo] = useState<DatosReporte | null>(null);
  const [viendoCaja, setViendoCaja] = useState<string | null>(null);
  const imprimir = useImprimir();

  const th = "px-4 py-3 font-medium";
  const td = "px-4 py-2";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Abiertos ({abiertos.length})</h2>
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-texto-3">
              <tr>
                <th className={th}>Cajero</th>
                {mostrarSede && <th className={th}>Sede</th>}
                <th className={th}>Apertura</th>
                <th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {abiertos.map((t) => (
                <tr key={t.id} className="border-b border-suave last:border-0">
                  <td className={`${td} font-medium`}>{t.cajero}</td>
                  {mostrarSede && <td className={td}>{t.sede}</td>}
                  <td className={`${td} num text-sm`}>{formatearFechaHora(t.abiertoEn)}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex justify-end gap-2">
                      <Boton variante="secundario" icono={<Wallet size={18} aria-hidden />} onClick={() => setViendoCaja(t.id)}>
                        Ver caja
                      </Boton>
                      <Boton variante="secundario" icono={<Lock size={18} aria-hidden />} onClick={() => setCerrando(t)}>
                        Cerrar
                      </Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {abiertos.length === 0 && <p className="p-6 text-center text-texto-3">No hay turnos abiertos</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Cerrados recientes</h2>
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-texto-3">
              <tr>
                <th className={th}>Cajero</th>
                {mostrarSede && <th className={th}>Sede</th>}
                <th className={th}>Apertura → cierre</th>
                <th className={`${th} text-right`}>Esperado</th>
                <th className={`${th} text-right`}>Contado</th>
                <th className={`${th} text-right`}>Diferencia</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {cerrados.map((t) => (
                <tr key={t.id} className="border-b border-suave last:border-0">
                  <td className={`${td} font-medium`}>
                    {t.cajero}
                    {t.cerradoPorAdmin && <span className="ml-2 rounded-control bg-suave px-2 py-0.5 text-xs text-texto-3">Admin</span>}
                  </td>
                  {mostrarSede && <td className={td}>{t.sede}</td>}
                  <td className={`${td} num text-sm`}>
                    {formatearHora(t.abiertoEn)} → {t.cerradoEn && formatearFechaHora(t.cerradoEn)}
                  </td>
                  <td className={`${td} num text-right`}>{formatearPesos(t.esperado ?? 0)}</td>
                  <td className={`${td} num text-right`}>{formatearPesos(t.contado ?? 0)}</td>
                  <td className={`${td} text-right`}>
                    <Diferencia valor={t.diferencia ?? 0} />
                  </td>
                  <td className="px-1 text-right">
                    {t.reporte && (
                      <>
                        <button
                          type="button"
                          aria-label={`Ver reporte de ${t.cajero}`}
                          onClick={() => setViendo(t.reporte)}
                          className="inline-flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Imprimir reporte de ${t.cajero}`}
                          onClick={() => t.reporte && imprimir({ tipo: "reporte", datos: t.reporte, copia: true })}
                          className="inline-flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
                        >
                          <Printer size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cerrados.length === 0 && <p className="p-6 text-center text-texto-3">Sin turnos cerrados</p>}
        </div>
      </div>

      {cerrando && (
        <CerrarTurno
          turno={cerrando}
          cerrar={() => setCerrando(null)}
          alCerrar={(r) => {
            setCerrando(null);
            setViendo(r);
          }}
        />
      )}
      {viendo && <VerReporte reporte={viendo} cerrar={() => setViendo(null)} />}
      {viendoCaja && <VerCaja turnoId={viendoCaja} cerrar={() => setViendoCaja(null)} />}
    </div>
  );
}

export function TablaTurnos(props: { abiertos: TurnoFila[]; cerrados: TurnoFila[]; mostrarSede: boolean }) {
  return (
    <ProveedorImpresion>
      <Contenido {...props} />
    </ProveedorImpresion>
  );
}

/** Botón que abre el reporte de un turno cerrado (requiere ProveedorImpresion arriba). */
export function BotonVerReporte({ reporte, cajero }: { reporte: DatosReporte; cajero: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Ver reporte de ${cajero}`}
        onClick={() => setAbierto(true)}
        className="inline-flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Eye size={18} />
      </button>
      {abierto && <VerReporte reporte={reporte} cerrar={() => setAbierto(false)} />}
    </>
  );
}
