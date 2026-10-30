"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ReporteTurno, Ticket } from "./Documentos";
import type { Documento } from "@/lib/dominio/documentos";

type Imprimir = (doc: Documento) => void;

const Contexto = createContext<Imprimir | null>(null);

/**
 * Renderiza el documento en una zona oculta (solo visible al imprimir)
 * y abre el diálogo de impresión del navegador.
 */
export function ProveedorImpresion({ children }: { children: ReactNode }) {
  const [trabajo, setTrabajo] = useState<{ doc: Documento; n: number } | null>(null);

  const imprimir = useCallback<Imprimir>((doc) => {
    setTrabajo((t) => ({ doc, n: (t?.n ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!trabajo) return;
    // Espera a que el documento esté pintado antes de imprimir
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => cancelAnimationFrame(id);
  }, [trabajo]);

  return (
    <Contexto value={imprimir}>
      {children}
      {trabajo &&
        createPortal(
          <div className="zona-impresion hidden print:block" aria-hidden>
            {trabajo.doc.tipo === "ticket" ? (
              <Ticket datos={trabajo.doc.datos} copia={trabajo.doc.copia} />
            ) : (
              <ReporteTurno datos={trabajo.doc.datos} copia={trabajo.doc.copia} />
            )}
          </div>,
          document.body,
        )}
    </Contexto>
  );
}

export function useImprimir(): Imprimir {
  const imprimir = use(Contexto);
  if (!imprimir) throw new Error("useImprimir debe usarse dentro de ProveedorImpresion");
  return imprimir;
}
