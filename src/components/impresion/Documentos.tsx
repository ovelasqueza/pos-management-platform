import type { ReactNode } from "react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora, formatearHora } from "@/lib/dominio/fechas";
import { clasificarDiferencia, nombreDiferencia, nombreMetodo } from "@/lib/dominio/cobro";
import type { DatosReporte, DatosTicket } from "@/lib/dominio/documentos";
import { CONSUMIDOR_FINAL, esConsumidorFinal } from "@/lib/dominio/cliente";
import { describirOrigen } from "@/lib/dominio/cajaMayor";

/* Documentos para impresora térmica de 80 mm (≈ 72 mm imprimibles). */

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
const Destacado = ({ izq, der }: { izq: ReactNode; der: ReactNode }) => (
  <div className="mt-1 border-t border-black pt-1 text-[14px]">
    <Fila izq={izq} der={der} fuerte />
  </div>
);

// Sin cambios: así quedó aprobado el título
function Encabezado({ sede, copia, regimen }: { sede: DatosTicket["sede"]; copia: boolean; regimen?: boolean }) {
  return (
    <div className="text-center text-[11px] leading-snug">
      {copia && <p className="mb-1 border border-black font-bold">COPIA</p>}
      <p className="text-[14px] font-bold">{sede.nombre}</p>
      {sede.nit && <p>NIT {sede.nit}</p>}
      {regimen && <p>Régimen simplificado</p>}
      {sede.direccion && <p>{sede.direccion}</p>}
      {sede.telefono && <p>Tel. {sede.telefono}</p>}
    </div>
  );
}

const papel = "w-[72mm] p-[2mm] font-mono text-[12px] leading-normal text-black";

export function Ticket({ datos, copia }: { datos: DatosTicket; copia: boolean }) {
  const anulada = Boolean(datos.anulada_en);
  return (
    <div className={`${papel} relative overflow-hidden`}>
      {/* Venta anulada: marca grande sobrepuesta (letras huecas para que el contenido se siga leyendo) */}
      {anulada && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-[35deg] font-sans text-[64px] font-black tracking-wider text-transparent [-webkit-text-stroke:2px_black]">
            ANULADA
          </span>
        </div>
      )}
      <Encabezado sede={datos.sede} copia={copia} regimen />
      {anulada && (
        <p className="mt-2 bg-black py-1 text-center text-[20px] font-black tracking-widest text-white">VENTA ANULADA</p>
      )}
      <Linea />
      <Seccion>
        <Fila izq={<strong>Venta #{datos.numero}</strong>} der={formatearFechaHora(datos.fecha)} />
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
      <div className="text-[16px]">
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
  const clase = clasificarDiferencia(datos.diferencia);
  // Reportes anteriores a la spec 06 no traen origen: todo salió de la caja
  const conMayor = datos.caja_mayor !== undefined;
  const gastosCaja = datos.gastos_caja ?? datos.gastos_total;
  return (
    <div className={papel}>
      <Encabezado sede={datos.sede} copia={copia} regimen />
      <p className="mt-2 border-y-2 border-black py-1 text-center text-[13px] font-bold tracking-widest">REPORTE DE TURNO</p>

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
        <Destacado izq="Total vendido" der={formatearPesos(datos.ventas_total)} />
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
                  <p className="pl-3 text-[11px] break-words">↳ {a.motivo}</p>
                </div>
              ))}
            </div>
            <Destacado izq="Total anulado" der={formatearPesos(datos.anuladas_total ?? 0)} />
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
              {conMayor && <p className="pl-3 text-[11px]">↳ {describirOrigen(g)}</p>}
            </div>
          ))}
        </div>
        {datos.gastos.length > 0 && (
          <div className="mt-1.5">
            {conMayor && (
              <>
                <Fila izq="De caja" der={formatearPesos(gastosCaja)} />
                <Fila izq="De caja mayor" der={formatearPesos(datos.gastos_mayor ?? 0)} />
              </>
            )}
            <Destacado izq="Total gastos" der={formatearPesos(datos.gastos_total)} />
          </div>
        )}
      </Seccion>
      <Linea />

      <Seccion titulo="Arqueo">
        <Fila izq="Base" der={formatearPesos(datos.base)} />
        <Fila izq="+ Ventas efectivo" der={formatearPesos(datos.por_metodo.efectivo)} />
        <Fila izq={conMayor ? "− Gastos de caja" : "− Gastos"} der={formatearPesos(gastosCaja)} />
        <Destacado izq="Esperado" der={formatearPesos(datos.esperado)} />
        <Fila izq="Contado" der={formatearPesos(datos.contado)} fuerte />
        <div className="mt-1.5 border-2 border-black px-1.5 py-1 text-[14px]">
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
            <Destacado izq="Total a caja mayor" der={formatearPesos(datos.caja_mayor.total)} />
            <div className="mt-1.5 border-2 border-black px-1.5 py-1 text-[14px]">
              <Fila izq="Queda en caja" der={formatearPesos(datos.queda_en_caja ?? datos.contado)} fuerte />
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

      <div className="mt-14 grid grid-cols-2 gap-4 text-center">
        <div className="border-t border-black pt-1">Cajero</div>
        <div className="border-t border-black pt-1">Encargado</div>
      </div>
    </div>
  );
}


/**
 * Apertura del cajón sin venta. El driver de la impresora abre el cajón al imprimir;
 * este papel es lo mínimo que se puede imprimir y deja constancia de quién lo abrió.
 */
export function AperturaCajon({ sede, cajero, fecha }: { sede: string; cajero: string; fecha: string }) {
  return (
    <div className={`${papel} text-center text-[11px]`}>
      <p className="font-bold">APERTURA DE CAJÓN</p>
      <p>{sede}</p>
      <p>
        {cajero} · {formatearFechaHora(fecha)}
      </p>
    </div>
  );
}
