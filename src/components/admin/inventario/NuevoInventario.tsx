"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { hoyBogota } from "@/lib/dominio/fechas";
import { crearInventario } from "@/app/admin/[sede]/inventario/acciones";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";

/**
 * "+ Inventario" (fecha y nota) o, si la sede ya tiene uno en curso, "Continuar".
 * Una sede tiene máximo un inventario en curso.
 */
export function NuevoInventario({ sedeId, enCurso }: { sedeId: string; enCurso: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const hoy = hoyBogota();

  if (enCurso) {
    return (
      <Link
        href={`/admin/${sedeId}/inventario/${enCurso}`}
        className="inline-flex min-h-12 items-center gap-2 rounded-control bg-primario px-4 font-semibold text-white hover:bg-primario-hover"
      >
        <ClipboardList size={20} aria-hidden />
        Continuar inventario
      </Link>
    );
  }

  function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(undefined);
    iniciar(async () => {
      const r = await crearInventario(sedeId, String(f.get("fecha") ?? ""), String(f.get("nota") ?? ""));
      if (r.error || !r.id) return setError(r.error ?? "No se pudo crear el inventario");
      router.push(`/admin/${sedeId}/inventario/${r.id}`);
    });
  }

  return (
    <>
      <Boton variante="primario" icono={<Plus size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Inventario
      </Boton>
      <Modal abierto={abierto} titulo="Nuevo inventario" onCerrar={() => setAbierto(false)} ancho="sm">
        {abierto && (
          <form onSubmit={crear} className="flex flex-col gap-4">
            <Campo etiqueta="Fecha del conteo" name="fecha" type="date" defaultValue={hoy} max={hoy} required className="num" />
            <Campo etiqueta="Nota (opcional)" name="nota" maxLength={120} placeholder="Ej.: Cierre de mes" />
            <p className="text-sm text-texto-3">
              Se arma la lista con los productos que vende la sede y sus materias primas activas.
            </p>
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" variante="primario" disabled={pendiente}>
              {pendiente ? "Creando…" : "Empezar a contar"}
            </Boton>
          </form>
        )}
      </Modal>
    </>
  );
}
