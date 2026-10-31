import type { ReactNode } from "react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFechaHora, formatearHora } from "@/lib/dominio/fechas";
import { clasificarDiferencia, nombreDiferencia, nombreMetodo } from "@/lib/dominio/cobro";
import type { DatosReporte, DatosTicket } from "@/lib/dominio/documentos";
import { CONSUMIDOR_FINAL, esConsumidorFinal } from "@/lib/dominio/cliente";

/* Documentos para impresora térmica de 80 mm (≈ 72 mm imprimibles). */

const Fila = ({ izq, der, fuerte }: { izq: ReactNode; der: ReactNode; fuerte?: boolean }) => (
  <div className={`flex justify-between gap-2 ${fuerte ? "font-bold" : ""}`}>
    <span className="min-w-0">{izq}</span>
    <span className="shrink-0 text-right">{der}</span>
  </div>
);

const Linea = () => <div className="my-1 border-t border-dashed border-black" />;

function Encabezado({ sede, copia }: { sede: DatosTicket["sede"]; copia: boolean }) {
  return (
    <div className="text-center">
      {copia && <p className="mb-1 border border-black font-bold">COPIA</p>}
      <p className="text-[14px] font-bold">{sede.nombre}</p>
      {sede.direccion && <p>{sede.direccion}</p>}
      {sede.telefono && <p>Tel. {sede.telefono}</p>}
    </div>
  );
}

const papel = "w-[72mm] p-[2mm] font-mono text-[11px] leading-snug text-black";

export function Ticket({ datos, copia }: { datos: DatosTicket; copia: boolean }) {
  return (
    <div className={papel}>
      <Encabezado sede={datos.sede} copia={copia} />
      <Linea />
      <Fila izq={`Venta #${datos.numero}`} der={formatearFechaHora(datos.fecha)} />
      <p>Cajero: {datos.cajero}</p>
      <p>Cliente: {datos.cliente?.nombre ?? CONSUMIDOR_FINAL.nombre}</p>
      <p>
        {datos.cliente && !esConsumidorFinal(datos.cliente) ? `${datos.cliente.tipo} ` : "NIT/CC "}
        {datos.cliente?.documento ?? CONSUMIDOR_FINAL.documento}
      </p>
      <Linea />
      {datos.lineas.map((l) => (
        <div key={l.nombre} className="mb-0.5">
          <p>{l.nombre}</p>
          <Fila izq={`${l.cantidad} x ${formatearPesos(l.precio)}`} der={formatearPesos(l.subtotal)} />
        </div>
      ))}
      <Linea />
      <div className="text-[14px]">
        <Fila izq="TOTAL" der={formatearPesos(datos.total)} fuerte />
      </div>
      <Fila izq="Pago" der={nombreMetodo(datos.metodo)} />
      {datos.recibido !== null && (
        <>
          <Fila izq="Recibido" der={formatearPesos(datos.recibido)} />
          <Fila izq="Cambio" der={formatearPesos(datos.cambio ?? 0)} />
        </>
      )}
      <Linea />
      <p className="text-center">¡Gracias por su compra!</p>
    </div>
  );
}

export function ReporteTurno({ datos, copia }: { datos: DatosReporte; copia: boolean }) {
  const clase = clasificarDiferencia(datos.diferencia);
  return (
    <div className={papel}>
      <Encabezado sede={datos.sede} copia={copia} />
      <p className="mt-1 text-center font-bold">REPORTE DE TURNO</p>
      <Linea />
      <p>Cajero: {datos.cajero}</p>
      <Fila izq="Apertura" der={formatearFechaHora(datos.abierto_en)} />
      <Fila izq="Cierre" der={formatearFechaHora(datos.cerrado_en)} />
      {datos.cerrado_por_admin && <p>Cerrado por admin: {datos.cerrado_por_admin}</p>}
      <Linea />
      <Fila izq={`Ventas (${datos.ventas_cantidad})`} der={formatearPesos(datos.ventas_total)} fuerte />
      <Fila izq="Efectivo" der={formatearPesos(datos.por_metodo.efectivo)} />
      <Linea />
      <p className="font-bold">Otros medios (no van en caja)</p>
      <Fila izq="QR" der={formatearPesos(datos.por_metodo.transferencia)} />
      <Fila izq="Tarjeta" der={formatearPesos(datos.por_metodo.tarjeta)} />
      <Linea />
      <p className="font-bold">Gastos</p>
      {datos.gastos.length === 0 && <p>Sin gastos</p>}
      {datos.gastos.map((g, i) => (
        <Fila key={i} izq={`${formatearHora(g.hora)} ${g.descripcion}`} der={formatearPesos(g.monto)} />
      ))}
      <Fila izq="Total gastos" der={formatearPesos(datos.gastos_total)} fuerte />
      <Linea />
      <p className="font-bold">Arqueo</p>
      <Fila izq="Base" der={formatearPesos(datos.base)} />
      <Fila izq="+ Ventas efectivo" der={formatearPesos(datos.por_metodo.efectivo)} />
      <Fila izq="− Gastos" der={formatearPesos(datos.gastos_total)} />
      <Fila izq="Esperado" der={formatearPesos(datos.esperado)} fuerte />
      <Fila izq="Contado" der={formatearPesos(datos.contado)} fuerte />
      <div className="text-[13px]">
        <Fila izq={nombreDiferencia[clase]} der={formatearPesos(datos.diferencia)} fuerte />
      </div>
      <Linea />
      <p className="font-bold">Productos vendidos</p>
      {datos.productos.length === 0 && <p>Sin ventas</p>}
      {datos.productos.map((p, i) => (
        <Fila key={i} izq={`${p.unidades} ${p.nombre}`} der={formatearPesos(p.valor)} />
      ))}
      <div className="mt-10 grid grid-cols-2 gap-4 text-center">
        <div className="border-t border-black pt-1">Cajero</div>
        <div className="border-t border-black pt-1">Encargado</div>
      </div>
    </div>
  );
}
