"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Croissant, Flame, MapPin, Network, Search } from "lucide-react";
import { normalizarTexto } from "@/lib/dominio/producto";
import type { TipoSede } from "@/lib/dominio/sede";

type SedeOpcion = { id: string; nombre: string; tipo: TipoSede; direccion: string | null; activa: boolean };

type Props = { actual: string; sedes: SedeOpcion[] };

const TODAS = "todas";

/**
 * Cambia la sede manteniendo la sección actual: /admin/<sede>/<seccion>.
 * Menú propio (el <select> nativo no se puede estilizar) con buscador por nombre o dirección.
 * Teclado: ↑ ↓ para moverse, Enter para escoger, Esc para cerrar.
 */
export function SelectorSede({ actual, sedes }: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [marcada, setMarcada] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const seleccionada = sedes.find((s) => s.id === actual);

  // "Todas" siempre primero; luego las que coinciden con la búsqueda (activas antes que inactivas)
  const opciones = useMemo(() => {
    const q = normalizarTexto(busqueda);
    const filtradas = sedes.filter((s) => !q || normalizarTexto(`${s.nombre} ${s.direccion ?? ""}`).includes(q));
    const todas = !q || normalizarTexto("todas las sedes").includes(q);
    return [...(todas ? [null] : []), ...filtradas];
  }, [busqueda, sedes]);

  function abrir() {
    setBusqueda("");
    const i = actual === TODAS ? 0 : sedes.findIndex((s) => s.id === actual) + 1;
    setMarcada(Math.max(0, i));
    setAbierto(true);
  }

  function escoger(id: string) {
    setAbierto(false);
    if (id === actual) return;
    const partes = ruta.split("/"); // ["", "admin", "<sede>", ...]
    partes[2] = id;
    router.push(partes.join("/"));
  }

  // Cerrar al tocar fuera; enfocar el buscador al abrir
  useEffect(() => {
    if (!abierto) return;
    (campo.current ?? lista.current)?.focus();
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  // Mantener visible la opción marcada al moverse con el teclado
  useEffect(() => {
    if (abierto) document.getElementById(`${idLista}-${marcada}`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, marcada, idLista]);

  function teclear(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcada((i) => Math.min(i + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcada((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = opciones[marcada];
      if (o !== undefined) escoger(o?.id ?? TODAS);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div ref={caja} className="relative mx-auto w-fit max-w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Sede: ${seleccionada?.nombre ?? "Todas las sedes"}`}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        className={`flex min-h-12 max-w-full items-center gap-2 rounded-control border bg-superficie px-3 py-2 text-left hover:border-primario ${
          abierto ? "border-primario ring-2 ring-primario/20" : "border-borde-activo"
        }`}
      >
        {seleccionada ? <IconoTipo tipo={seleccionada.tipo} /> : <Network size={18} className="shrink-0 text-primario" aria-hidden />}
        <span className="font-semibold break-words">
          {seleccionada?.nombre ?? "Todas las sedes"}
          {seleccionada && !seleccionada.activa && <span className="ml-1 font-normal text-texto-3">(inactiva)</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-texto-3 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {abierto && (
        <div className="absolute top-full left-1/2 z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-modal border border-borde-activo bg-superficie shadow-modal">
          <label className="relative block border-b border-borde">
            <span className="sr-only">Buscar sede</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-3" aria-hidden />
            <input
              ref={campo}
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMarcada(0);
              }}
              onKeyDown={teclear}
              placeholder="Buscar sede o barrio…"
              aria-controls={idLista}
              aria-activedescendant={`${idLista}-${marcada}`}
              className="min-h-12 w-full bg-transparent pr-4 pl-10 text-sm placeholder:text-texto-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </label>

          <ul
            id={idLista}
            role="listbox"
            aria-label="Sedes"
            tabIndex={-1}
            onKeyDown={teclear}
            ref={lista}
            className="barra-fina max-h-[min(24rem,60vh)] overflow-y-auto p-1 outline-none"
          >
            {opciones.map((s, i) => {
              const id = s?.id ?? TODAS;
              const elegida = id === actual;
              return (
                <li
                  key={id}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={elegida}
                  onPointerEnter={() => setMarcada(i)}
                  onClick={() => escoger(id)}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-3 py-2 ${
                    i === marcada ? "bg-suave" : ""
                  } ${elegida ? "text-primario-activo" : ""} ${s && !s.activa ? "opacity-60" : ""}`}
                >
                  {s ? <IconoTipo tipo={s.tipo} /> : <Network size={18} className="shrink-0 text-primario" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words ${elegida ? "font-semibold" : "font-medium"}`}>
                      {s?.nombre ?? "Todas las sedes"}
                      {s && !s.activa && <span className="ml-1 text-xs font-normal">(inactiva)</span>}
                    </span>
                    {s?.direccion && (
                      <span className="flex items-center gap-1 text-xs text-texto-3">
                        <MapPin size={12} className="shrink-0" aria-hidden />
                        <span className="truncate">{s.direccion}</span>
                      </span>
                    )}
                    {!s && <span className="block text-xs text-texto-3">Vista consolidada</span>}
                  </span>
                  {elegida && <Check size={18} className="shrink-0 text-primario" aria-hidden />}
                </li>
              );
            })}
            {opciones.length === 0 && <li className="px-3 py-6 text-center text-sm text-texto-3">Ninguna sede coincide</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function IconoTipo({ tipo }: { tipo: TipoSede }) {
  return tipo === "panaderia" ? (
    <Croissant size={18} className="shrink-0 text-advertencia" aria-label="Panadería" />
  ) : (
    <Flame size={18} className="shrink-0 text-peligro" aria-label="Asadero" />
  );
}
