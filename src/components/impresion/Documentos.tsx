"use client";

import type { ReactNode } from "react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora, formatearHora } from "@/lib/dominio/fechas";
import { clasificarDiferencia, nombreDiferencia, nombreMetodo } from "@/lib/dominio/cobro";
import type { DatosReporte, DatosTicket } from "@/lib/dominio/documentos";
import { CONSUMIDOR_FINAL, esConsumidorFinal } from "@/lib/dominio/cliente";
import { describirOrigen } from "@/lib/dominio/cajaMayor";
import { useAnchoPapel, type AnchoPapel } from "@/lib/impresion/papel";

/* Documentos para impresora térmica: 80 mm (≈72 mm imprimibles) o 58 mm (≈48 mm imprimibles). */

type Medidas = {
  papel: string;
  encabezado: string;
  nombre: string;
  total: string;
  destacado: string;
  titulo: string;
  nota: string;
  anulada: string;
  marca: string;
  firma: string;
};

const MEDIDAS: Record<AnchoPapel, Medidas> = {
  80: {
    papel: "w-[72mm] p-[2mm] text-[12px]",
    encabezado: "text-[11px]",
    nombre: "text-[14px]",
    total: "text-[16px]",
    destacado: "text-[14px]",
    titulo: "text-[13px]",
    nota: "text-[11px]",
    anulada: "text-[20px]",
    marca: "text-[64px]",
    firma: "text-[12px]",
  },
  58: {
    // Centrado en el rollo de 58 mm: el área imprimible típica es de 48 mm.
    papel: "mx-auto w-[48mm] p-[2mm] text-[10px]",
    encabezado: "text-[9px]",
    nombre: "text-[12px]",
    total: "text-[13px]",
    destacado: "text-[12px]",
    titulo: "text-[11px]",
    nota: "text-[9px]",
    anulada: "text-[16px]",
    marca: "text-[46px]",
    firma: "text-[10px]",
  },
};

const BASE = "font-mono leading-normal text-black";

const Fila = ({ izq, der, fuerte }: { izq: ReactNode; der: ReactNode; fuerte?: boolean }) => (
  <div className={`flex justify-between gap-2 py-px ${fuerte ? "font-bold" : ""}`}>
    <span className="min-w-0">{izq}</span>
    <span className="shrink-0 text-right">{der}</span>
  </div>
);

/** Separador entre bloques: línea punteada con aire arriba y abajo. */
const Linea = () => <div className="my-2.5 border-t border-dashed border-black" />;

/** Bloque con título propio (mayúsculas, subrayado) y sus filas. */
function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      {titulo && <p className="mb-1 font-bold tracking-wide uppercase underline underline-offset-2">{titulo}</p>}
      {children}
    </section>
  );
}

/** Fila destacada (totales): más grande y con un borde arriba. */
const Destacado = ({ izq, der, clase }: { izq: ReactNode; der: ReactNode; clase: string }) => (
  <div className={`mt-1 border-t border-black pt-1 ${clase}`}>
    <Fila izq={izq} der={der} fuerte />
  </div>
);

// Sin cambios: así quedó aprobado el título
function Encabezado({
  sede,
  copia,
  regimen,
  medidas,
}: {
  sede: DatosTicket["sede"];
  copia: boolean;
  regimen?: boolean;
  medidas: Medidas;
}) {
  return (
    <div className={`text-center leading-snug ${medidas.encabezado}`}>
      {copia && <p className="mb-1 border border-black font-bold">COPIA</p>}
      <p className={`font-bold ${medidas.nombre}`}>{sede.nombre}</p>
      {sede.nit && <p>NIT {sede.nit}</p>}
      {regimen && <p>Régimen simplificado</p>}
      {sede.direccion && <p>{sede.direccion}</p>}
      {sede.telefono && <p>Tel. {sede.telefono}</p>}
    </div>
  );
}

export function Ticket({ datos, copia }: { datos: DatosTicket; copia: boolean }) {
  const m = MEDIDAS[useAnchoPapel()];
  const anulada = Boolean(datos.anulada_en);
  return (
    <div className={`${m.papel} ${BASE} relative overflow-hidden`}>
      {/* Venta anulada: marca grande sobrepuesta (letras huecas para que el contenido se siga leyendo) */}
      {anulada && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span
            className={`-rotate-[35deg] font-sans font-black tracking-wider text-transparent [-webkit-text-stroke:2px_black] ${m.marca}`}
          >
            ANULADA
          </span>
        </div>
      )}
      <Encabezado sede={datos.sede} copia={copia} regimen medidas={m} />
      {anulada && (
        <p className={`mt-2 bg-black py-1 text-center font-black tracking-widest text-white ${m.anulada}`}>VENTA ANULADA</p>
      )}
      <Linea />
      <Seccion>
        <Fila izq={<strong>{datos.numero > 0 ? `Venta #${datos.numero}` : "Venta registrada"}</strong>} der={formatearFechaHora(datos.fecha)} />
        <Fila izq="Cajero" der={datos.cajero} />
        <Fila izq="Cliente" der={datos.cliente?.nombre ?? CONSUMIDOR_FINAL.nombre} />
        <Fila
          izq={datos.cliente && !esConsumidorFinal(datos.cliente) ? datos.cliente.tipo : "NIT/CC"}
          der={datos.cliente?.documento ?? CONSUMIDOR_FINAL.documento}
        />
      </Seccion>
      <Linea />
      <Seccion titulo="Productos">
        <div className="flex flex-col gap-2">
          {datos.lineas.map((l) => (
            <div key={l.nombre}>
              <p className="font-bold">{l.nombre}</p>
              <Fila izq={`  ${l.cantidad} x ${formatearPesos(l.precio)}`} der={formatearPesos(l.subtotal)} />
            </div>
          ))}
        </div>
      </Seccion>
      <Linea />
      <div className={m.total}>
        <Fila izq="TOTAL" der={formatearPesos(datos.total)} fuerte />
      </div>
      <div className="mt-2">
        <Seccion>
          <Fila izq="Pago" der={nombreMetodo(datos.metodo)} />
          {datos.recibido !== null && (
            <>
              <Fila izq="Recibido" der={formatearPesos(datos.recibido)} />
              <Fila izq="Cambio" der={formatearPesos(datos.cambio ?? 0)} fuerte />
            </>
          )}
        </Seccion>
      </div>
      <Linea />
      {anulada ? (
        <div className="border-2 border-black px-1.5 py-1">
          <p className="font-bold">ANULADA · {formatearFechaHora(datos.anulada_en!)}</p>
          <p className="mt-0.5 font-bold">Motivo de anulación:</p>
          <p className="break-words">{datos.motivo_anulacion}</p>
        </div>
      ) : (
        <p className="py-1 text-center">¡Gracias por su compra!</p>
      )}
    </div>
  );
}

export function ReporteTurno({ datos, copia }: { datos: DatosReporte; copia: boolean }) {
  const m = MEDIDAS[useAnchoPapel()];
  const clase = clasificarDiferencia(datos.diferencia);
  // Reportes anteriores a la spec 06 no traen origen: todo salió de la caja
  const conMayor = datos.caja_mayor !== undefined;
  const gastosCaja = datos.gastos_caja ?? datos.gastos_total;
  return (
    <div className={`${m.papel} ${BASE}`}>
      <Encabezado sede={datos.sede} copia={copia} regimen medidas={m} />
      <p className={`mt-2 border-y-2 border-black py-1 text-center font-bold tracking-widest ${m.titulo}`}>
        REPORTE DE TURNO
      </p>

      <div className="mt-2.5">
        <Seccion>
          <Fila izq="Cajero" der={<strong>{datos.cajero}</strong>} />
          <Fila izq="Apertura" der={formatearFechaHora(datos.abierto_en)} />
          <Fila izq="Cierre" der={formatearFechaHora(datos.cerrado_en)} />
          {datos.cerrado_por_admin && <Fila izq="Cerrado por admin" der={datos.cerrado_por_admin} />}
        </Seccion>
      </div>
      <Linea />

      <Seccion titulo={`Ventas (${datos.ventas_cantidad})`}>
        <Fila izq="Efectivo" der={formatearPesos(datos.por_metodo.efectivo)} />
        <Fila izq="QR" der={formatearPesos(datos.por_metodo.transferencia)} />
        <Fila izq="Tarjeta" der={formatearPesos(datos.por_metodo.tarjeta)} />
        <Destacado izq="Total vendido" der={formatearPesos(datos.ventas_total)} clase={m.destacado} />
      </Seccion>
      <Linea />

      {/* Desde el script 18. No suman en Ventas ni en el arqueo */}
      {datos.anuladas && datos.anuladas.length > 0 && (
        <>
          <Seccion titulo={`Ventas anuladas (${datos.anuladas.length})`}>
            <div className="flex flex-col gap-1.5">
              {datos.anuladas.map((a) => (
                <div key={a.numero}>
                  <Fila izq={`#${a.numero}  ${formatearHora(a.hora)}  ${nombreMetodo(a.metodo)}`} der={formatearPesos(a.total)} />
                  <p className={`pl-3 break-words ${m.nota}`}>↳ {a.motivo}</p>
                </div>
              ))}
            </div>
            <Destacado izq="Total anulado" der={formatearPesos(datos.anuladas_total ?? 0)} clase={m.destacado} />
          </Seccion>
          <Linea />
        </>
      )}

      <Seccion titulo="Gastos">
        {datos.gastos.length === 0 && <p>Sin gastos</p>}
        <div className="flex flex-col gap-1.5">
          {datos.gastos.map((g, i) => (
            <div key={i}>
              <Fila izq={`${formatearHora(g.hora)}  ${g.descripcion}`} der={formatearPesos(g.monto)} />
              {conMayor && <p className={`pl-3 ${m.nota}`}>↳ {describirOrigen(g)}</p>}
            </div>
          ))}
        </div>
        {datos.gastos.length > 0 && (
          <div className="mt-1.5">
            {conMayor && (
              <>
                <Fila izq="De cajón" der={formatearPesos(gastosCaja)} />
                <Fila izq="De caja mayor" der={formatearPesos(datos.gastos_mayor ?? 0)} />
              </>
            )}
            <Destacado izq="Total gastos" der={formatearPesos(datos.gastos_total)} clase={m.destacado} />
          </div>
        )}
      </Seccion>
      <Linea />

      <Seccion titulo="Arqueo">
        <Fila izq="Base" der={formatearPesos(datos.base)} />
        <Fila izq="+ Ventas efectivo" der={formatearPesos(datos.por_metodo.efectivo)} />
        <Fila izq={conMayor ? "− Gastos de cajón" : "− Gastos"} der={formatearPesos(gastosCaja)} />
        <Destacado izq="Esperado" der={formatearPesos(datos.esperado)} clase={m.destacado} />
        <Fila izq="Contado" der={formatearPesos(datos.contado)} fuerte />
        <div className={`mt-1.5 border-2 border-black px-1.5 py-1 ${m.destacado}`}>
          <Fila izq={nombreDiferencia[clase]} der={formatearPesos(datos.diferencia)} fuerte />
        </div>
      </Seccion>

      {datos.caja_mayor && (
        <>
          <Linea />
          <Seccion titulo="A caja mayor">
            <Fila izq="Efectivo" der={formatearPesos(datos.caja_mayor.efectivo)} />
            <Fila izq="QR" der={formatearPesos(datos.caja_mayor.transferencia)} />
            <Fila izq="Tarjeta" der={formatearPesos(datos.caja_mayor.tarjeta)} />
            <Destacado izq="Total a caja mayor" der={formatearPesos(datos.caja_mayor.total)} clase={m.destacado} />
            <div className={`mt-1.5 border-2 border-black px-1.5 py-1 ${m.destacado}`}>
              <Fila izq="Queda en cajón" der={formatearPesos(datos.queda_en_caja ?? datos.contado)} fuerte />
            </div>
          </Seccion>
        </>
      )}
      <Linea />

      <Seccion titulo="Productos vendidos">
        {datos.productos.length === 0 && <p>Sin ventas</p>}
        {datos.productos.map((p, i) => (
          <Fila key={i} izq={`${p.unidades}  ${p.nombre}`} der={formatearPesos(p.valor)} />
        ))}
      </Seccion>

      <div className={`mt-14 grid grid-cols-2 gap-4 text-center ${m.firma}`}>
        <div className="border-t border-black pt-1">Cajero</div>
        <div className="border-t border-black pt-1">Encargado</div>
      </div>
    </div>
  );
}

/**
 * Apertura del cajón sin venta. El driver de la impresora abre el cajón al empezar a imprimir;
 * se manda una página casi vacía (sin texto, 1 mm) para gastar el mínimo de papel.
 */
export function AperturaCajon() {
  const ancho = useAnchoPapel();
  return (
    <div
      style={
        ancho === 58
          ? { height: "1mm", width: "48mm", margin: "0 auto" }
          : { height: "1mm", width: "72mm" }
      }
    />
  );
}
