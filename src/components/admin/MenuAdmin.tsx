"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LayoutGrid,
  Package,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

const SECCIONES: { ruta: string; nombre: string; icono: LucideIcon }[] = [
  { ruta: "", nombre: "Resumen", icono: LayoutGrid },
  { ruta: "/reportes", nombre: "Reportes", icono: BarChart3 },
  { ruta: "/turnos", nombre: "Turnos", icono: Timer },
  { ruta: "/productos", nombre: "Productos", icono: Package },
  { ruta: "/inventario", nombre: "Inventario", icono: Boxes },
  { ruta: "/usuarios", nombre: "Usuarios", icono: Users },
  { ruta: "/sedes", nombre: "Sedes", icono: Building2 },
];

export function MenuAdmin({ sede }: { sede: string }) {
  const actual = usePathname();
  const base = `/admin/${sede}`;

  return (
    <nav
      aria-label="Secciones"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-borde bg-superficie p-2 md:w-52 md:flex-col md:border-r md:border-b-0"
    >
      <Link
        href="/admin"
        className="mb-2 hidden items-center gap-2 px-3 py-2 text-lg font-semibold md:flex"
      >
        <ClipboardList size={22} className="text-primario" aria-hidden />
        POS Admin
      </Link>
      {SECCIONES.map(({ ruta, nombre, icono: Icono }) => {
        const href = base + ruta;
        const activa = ruta === "" ? actual === base : actual.startsWith(href);
        return (
          <Link
            key={nombre}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={`flex min-h-12 shrink-0 items-center gap-3 rounded-control px-3 font-medium ${
              activa ? "bg-exito-suave text-primario-activo" : "text-texto-2 hover:bg-suave"
            }`}
          >
            <Icono size={20} aria-hidden />
            {nombre}
          </Link>
        );
      })}
    </nav>
  );
}
