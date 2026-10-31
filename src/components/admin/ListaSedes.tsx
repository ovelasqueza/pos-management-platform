"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Croissant, Flame, MapPin, Search } from "lucide-react";
import { normalizarTexto } from "@/lib/dominio/producto";
import { ubicacionSede, type TipoSede } from "@/lib/dominio/sede";

export type SedeInicio = {
  id: string;
  nombre: string;
  tipo: TipoSede;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  activa: boolean;
};

const GRUPOS: { clave: string; titulo: string; incluye: (s: SedeInicio) => boolean }[] = [
  { clave: "panaderia", titulo: "Panaderías", incluye: (s) => s.activa && s.tipo === "panaderia" },
  { clave: "asadero", titulo: "Asaderos", incluye: (s) => s.activa && s.tipo === "asadero" },
  { clave: "inactivas", titulo: "Inactivas", incluye: (s) => !s.activa },
];

/** Sedes agrupadas por tipo, con buscador por nombre, dirección (barrio) o teléfono. */
export function ListaSedes({ sedes }: { sedes: SedeInicio[] }) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return sedes;
    return sedes.filter((s) => normalizarTexto(`${s.nombre} ${s.ciudad ?? ""} ${s.direccion ?? ""} ${s.telefono ?? ""}`).includes(q));
  }, [busqueda, sedes]);

  return (
    <div className="flex flex-col gap-5">
      <label className="relative w-full max-w-md">
        <span className="sr-only">Buscar sede</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, ciudad o barrio"
          className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-4 pl-10 focus:border-primario focus:outline-none"
        />
      </label>

      {GRUPOS.map((g) => {
        const lista = visibles.filter(g.incluye);
        if (lista.length === 0) return null;
        return (
          <section key={g.clave} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-texto-3">
              {g.titulo} <span className="num">({lista.length})</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {lista.map((s) => (
                <li key={s.id}>
                  <TarjetaSede sede={s} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {visibles.length === 0 && <p className="p-6 text-center text-texto-3">Ninguna sede coincide con “{busqueda}”</p>}
    </div>
  );
}

function TarjetaSede({ sede }: { sede: SedeInicio }) {
  const Icono = sede.tipo === "panaderia" ? Croissant : Flame;
  return (
    <Link
      href={`/admin/${sede.id}`}
      className={`flex h-full items-start gap-4 rounded-tarjeta border bg-superficie p-4 hover:border-borde-activo focus-visible:border-primario ${
        sede.activa ? "border-borde" : "border-dashed border-borde opacity-70"
      }`}
    >
      <Icono size={28} className={`mt-0.5 shrink-0 ${sede.tipo === "panaderia" ? "text-advertencia" : "text-peligro"}`} aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold break-words">{sede.nombre}</p>
        {ubicacionSede(sede) && (
          <p className="mt-1 flex items-start gap-1 text-sm text-texto-3">
            <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span className="break-words">{ubicacionSede(sede)}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
