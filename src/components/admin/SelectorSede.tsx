"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";

type Props = {
  actual: string;
  sedes: { id: string; nombre: string; activa: boolean }[];
};

/** Cambia la sede manteniendo la sección actual: /admin/<sede>/<seccion> */
export function SelectorSede({ actual, sedes }: Props) {
  const router = useRouter();
  const ruta = usePathname();

  function cambiar(nueva: string) {
    const partes = ruta.split("/"); // ["", "admin", "<sede>", ...]
    partes[2] = nueva;
    router.push(partes.join("/"));
  }

  const seleccionada = sedes.find((s) => s.id === actual);
  const nombreVisible = seleccionada
    ? `${seleccionada.nombre}${seleccionada.activa ? "" : " (inactiva)"}`
    : "Todas las sedes";

  // El nombre se muestra como texto que se ajusta (nunca se corta); el select nativo,
  // transparente y encima, conserva la lista desplegable y el teclado.
  return (
    <label className="relative mx-auto flex min-h-12 w-fit max-w-full items-center gap-2 rounded-control border border-borde-activo bg-superficie px-3 py-2 focus-within:border-primario focus-within:ring-2 focus-within:ring-primario/30">
      <MapPin size={18} className="shrink-0 text-primario" aria-hidden />
      <span className="text-center font-semibold break-words" aria-hidden>
        {nombreVisible}
      </span>
      <ChevronDown size={18} className="shrink-0 text-texto-3" aria-hidden />
      <select
        aria-label="Sede"
        value={actual}
        onChange={(e) => cambiar(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        <option value="todas">Todas las sedes</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
            {s.activa ? "" : " (inactiva)"}
          </option>
        ))}
      </select>
    </label>
  );
}
