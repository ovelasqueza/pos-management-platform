"use client";

import { CircleCheck, Landmark, Printer, TrendingDown, TrendingUp, UserRoundCog } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { METODOS, clasificarDiferencia, nombreDiferencia, type ClaseDiferencia } from "@/lib/dominio/cobro";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { Boton } from "@/components/ui/Boton";
import { useImprimir } from "@/components/impresion/ProveedorImpresion";

const ESTILO: Record<ClaseDiferencia, { clase: string; icono: typeof CircleCheck }> = {
  cuadrada: { clase: "border-primario bg-exito-suave text-primario-activo", icono: CircleCheck },
  sobrante: { clase: "border-advertencia bg-advertencia-suave text-advertencia", icono: TrendingUp },
  faltante: { clase: "border-peligro bg-peligro-suave text-peligro", icono: TrendingDown },
};

/** Pantalla después de cerrar el turno: resultado del arqueo y Finalizar. */
export function ResultadoCierre({ reporte }: { reporte: DatosReporte }) {
  const imprimir = useImprimir();
  const clase = clasificarDiferencia(reporte.diferencia);
  const { clase: estilo, icono: Icono } = ESTILO[clase];

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold">Turno cerrado</h1>
        <p className="-mt-2 text-center text-sm text-texto-3">Tu sesión se cerró. Entrega la caja al siguiente cajero.</p>

        <dl className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-4">
          <div className="flex justify-between">
            <dt className="text-texto-2">Esperado</dt>
            <dd className="num font-semibold">{formatearPesos(reporte.esperado)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-texto-2">Contado</dt>
            <dd className="num font-semibold">{formatearPesos(reporte.contado)}</dd>
          </div>
        </dl>

        <div className={`flex items-center gap-3 rounded-tarjeta border-2 p-4 ${estilo}`} role="status">
          <Icono size={32} aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">{nombreDiferencia[clase]}</p>
          </div>
          <p className="num text-2xl font-bold">{formatearPesos(reporte.diferencia)}</p>
        </div>

        {reporte.caja_mayor && (
          <dl className="flex flex-col gap-1 rounded-tarjeta border border-borde bg-superficie p-4 text-sm">
            <dt className="mb-1 flex items-center gap-1.5 font-semibold text-texto-2">
              <Landmark size={16} aria-hidden /> A caja mayor
            </dt>
            {METODOS.map((m) => (
              <div key={m.valor} className="flex justify-between">
                <dt className="text-texto-2">{m.nombre}</dt>
                <dd className="num">{formatearPesos(reporte.caja_mayor![m.valor])}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-borde pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="num">{formatearPesos(reporte.caja_mayor.total)}</dd>
            </div>
            <div className="mt-2 flex justify-between text-base font-semibold">
              <dt>Queda en cajón</dt>
              <dd className="num">{formatearPesos(reporte.queda_en_caja ?? reporte.contado)}</dd>
            </div>
          </dl>
        )}

        <Boton icono={<Printer size={20} aria-hidden />} onClick={() => imprimir({ tipo: "reporte", datos: reporte, copia: true })}>
          Reimprimir reporte
        </Boton>
        <form action="/salir?motivo=turno-cerrado" method="post">
          <Boton type="submit" variante="primario" tamano="lg" className="w-full" icono={<UserRoundCog size={22} aria-hidden />}>
            Siguiente cajero
          </Boton>
        </form>
      </div>
    </main>
  );
}
