"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Crossfade del contenido del admin al navegar (sección, sede, pestaña de reportes, fechas).
 * El menú y la barra superior están fuera: no se mueven.
 * La `key` cambia con la URL, así React trata lo viejo y lo nuevo como salida/entrada.
 * `default="none"`: los refrescos (router.refresh, guardado automático) no animan.
 * Sin soporte del navegador o con "reducir movimiento", cambia al instante como antes.
 * La caja no usa este componente: allí todo debe ser inmediato.
 */
export function TransicionAdmin({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const params = useSearchParams();
  return (
    <ViewTransition key={`${ruta}?${params}`} name="admin-contenido" share="auto" enter="auto" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
