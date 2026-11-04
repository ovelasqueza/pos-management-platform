"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Banknote, CreditCard, QrCode, RotateCw, Wallet } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora, formatearHora } from "@/lib/dominio/fechas";
import { nombreMetodo, type MetodoPago } from "@/lib/dominio/cobro";
import { mensajeDeError } from "@/lib/dominio/errores";
import { describirOrigen, origenDeGasto } from "@/lib/dominio/cajaMayor";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";

type CajaTurno = {
  cajero: string;
  sede: string;
  abierto_en: string;
  cerrado_en: string | null;
  base: number;
  ventas_cantidad: number;
  ventas_total: number;
  por_metodo: Record<MetodoPago, number>;
  gastos_total: number;
  /** Spec 06: gastos que salieron de la caja / de la caja mayor */
  gastos_caja?: number;
  gastos_mayor?: number;
  esperado: number;
  /** Script 18 */
  anuladas_cantidad?: number;
  anuladas_total?: number;
  ultimas_ventas: {
    id: string;
    numero: number;
    creado_en: string;
    total: number;
    metodo: MetodoPago;
    anulada?: boolean;
    motivo?: string | null;
  }[];
  gastos: {
    descripcion: string;
    monto: number;
    hora: string;
    monto_caja?: number;
    monto_mayor?: number;
    /** Lo que salió de cada parte de la caja mayor (reportes anteriores traen parte_mayor) */
    mayor?: Partial<Record<MetodoPago, number>>;
    parte_mayor?: MetodoPago | null;
  }[];
};

const REFRESCO_MS = 30_000;

/** Cómo va la caja de un turno abierto: se actualiza sola cada 30 s mientras está abierta. */
export function VerCaja({ turnoId, cerrar }: { turnoId: string; cerrar: () => void }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [caja, setCaja] = useState<CajaTurno | null>(null);
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase.rpc("rep_caja_turno", { p_turno: turnoId });
    setCargando(false);
    if (error) return setError(mensajeDeError(error, "No se pudo cargar la caja"));
    setError(undefined);
    setCaja(data as CajaTurno);
  }, [supabase, turnoId]);

  useEffect(() => {
    // Primera carga y refresco periódico (asíncronos: no bloquean el render)
    const primera = setTimeout(cargar, 0);
    const id = setInterval(cargar, REFRESCO_MS);
    return () => {
      clearTimeout(primera);
      clearInterval(id);
    };
  }, [cargar]);

  return (
    <Modal abierto titulo="Caja del turno" onCerrar={cerrar} ancho="md">
      <div className="flex flex-col gap-4">
        {error && <Aviso>{error}</Aviso>}
        {!caja && !error && <p className="py-6 text-center text-texto-3">Cargando…</p>}
        {caja && (
          <>
            <p className="text-sm text-texto-2">
              {caja.cajero} · {caja.sede} · desde {formatearFechaHora(caja.abierto_en)}
              {caja.cerrado_en && <span className="ml-2 font-semibold text-advertencia">Ya se cerró</span>}
            </p>

            <div className="rounded-tarjeta border-2 border-primario bg-exito-suave px-4 py-3 text-primario-activo">
              <p className="text-xs font-semibold">EFECTIVO QUE DEBE HABER EN EL CAJÓN</p>
              <p className="num text-4xl font-bold tracking-tight">{formatearPesos(caja.esperado)}</p>
              <p className="num text-sm">
                Base {formatearPesos(caja.base)} + efectivo {formatearPesos(caja.por_metodo.efectivo)} − gastos de cajón{" "}
                {formatearPesos(caja.gastos_caja ?? caja.gastos_total)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Dato titulo={`Vendido · ${caja.ventas_cantidad} ventas`} valor={caja.ventas_total} icono={<Wallet size={16} aria-hidden />} />
              <Dato titulo="Efectivo" valor={caja.por_metodo.efectivo} icono={<Banknote size={16} aria-hidden />} />
              <Dato titulo="QR" valor={caja.por_metodo.transferencia} icono={<QrCode size={16} aria-hidden />} />
              <Dato titulo="Tarjeta" valor={caja.por_metodo.tarjeta} icono={<CreditCard size={16} aria-hidden />} />
            </dl>

            {(caja.anuladas_cantidad ?? 0) > 0 && (
              <p className="text-sm font-semibold text-peligro">
                {caja.anuladas_cantidad} {caja.anuladas_cantidad === 1 ? "venta anulada" : "ventas anuladas"} ·{" "}
                <span className="num">{formatearPesos(caja.anuladas_total ?? 0)}</span> (no cuentan)
              </p>
            )}

            {caja.ultimas_ventas.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-texto-3">Últimas ventas</h3>
                <ul className="max-h-48 overflow-y-auto rounded-tarjeta border border-borde text-sm">
                  {caja.ultimas_ventas.map((v) => (
                    <li
                      key={v.id}
                      className={`flex items-center gap-3 border-b border-suave px-3 py-2 last:border-0 ${v.anulada ? "text-texto-3" : ""}`}
                    >
                      <span className={`num w-10 font-semibold ${v.anulada ? "line-through" : ""}`}>#{v.numero}</span>
                      <span className="num text-texto-3">{formatearHora(v.creado_en)}</span>
                      <span className="mr-auto min-w-0 text-texto-2">
                        {nombreMetodo(v.metodo)}
                        {v.anulada && <span className="block truncate text-xs text-peligro">Anulada · {v.motivo}</span>}
                      </span>
                      <span className={`num font-semibold ${v.anulada ? "line-through" : ""}`}>{formatearPesos(v.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {caja.gastos.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-texto-3">Gastos</h3>
                <ul className="rounded-tarjeta border border-borde text-sm">
                  {caja.gastos.map((g, i) => (
                    <li key={i} className="flex items-center gap-3 border-b border-suave px-3 py-2 last:border-0">
                      <span className="num text-texto-3">{formatearHora(g.hora)}</span>
                      <span className="mr-auto">
                        {g.descripcion}
                        {origenDeGasto(g) !== "caja" && <span className="block text-xs text-texto-3">{describirOrigen(g)}</span>}
                      </span>
                      <span className="num font-semibold">{formatearPesos(g.monto)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <Boton variante="secundario" onClick={cargar} disabled={cargando} icono={<RotateCw size={18} aria-hidden />}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </Boton>
      </div>
    </Modal>
  );
}

function Dato({ titulo, valor, icono }: { titulo: string; valor: number; icono: ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-borde px-3 py-2">
      <dt className="flex items-center gap-1 text-texto-3">
        {icono}
        {titulo}
      </dt>
      <dd className="num text-lg font-bold">{formatearPesos(valor)}</dd>
    </div>
  );
}


/** Botón que abre la caja en vivo de un turno. */
export function BotonVerCaja({ turnoId }: { turnoId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="secundario" icono={<Wallet size={18} aria-hidden />} onClick={() => setAbierto(true)}>
        Ver caja
      </Boton>
      {abierto && <VerCaja turnoId={turnoId} cerrar={() => setAbierto(false)} />}
    </>
  );
}
