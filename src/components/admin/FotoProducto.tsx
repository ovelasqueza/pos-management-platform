"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { cambiarImagenProducto } from "@/app/admin/[sede]/productos/acciones";
import { validarImagen } from "@/lib/dominio/producto";
import { reducirFoto } from "@/lib/imagen";
import { MiniaturaProducto } from "@/components/ui/MiniaturaProducto";

/** Miniatura que, al tocarla, permite escoger una foto y la sube de inmediato. */
export function FotoProducto({ id, nombre, url, tamano = 48 }: { id: string; nombre: string; url: string | null; tamano?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState(url);
  const [error, setError] = useState<string>();
  const [subiendo, iniciar] = useTransition();

  function alEscoger(original: File | undefined) {
    if (!original) return;
    setError(undefined);
    const anterior = vista;
    iniciar(async () => {
      let archivo: File;
      try {
        archivo = await reducirFoto(original);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo procesar la foto");
        return;
      }
      const e = validarImagen(archivo);
      if (e) return setError(e);
      setVista(URL.createObjectURL(archivo));
      const datos = new FormData();
      datos.set("id", id);
      datos.set("imagen", archivo);
      const r = await cambiarImagenProducto(datos);
      if (r.error) {
        setError(r.error);
        setVista(anterior);
      }
    });
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={subiendo}
        aria-label={`${url ? "Cambiar" : "Agregar"} foto de ${nombre}`}
        title={url ? "Cambiar foto" : "Agregar foto"}
        className="group relative shrink-0 rounded-tarjeta"
      >
        <MiniaturaProducto url={vista} tamano={tamano} />
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-tarjeta bg-texto/40 text-white ${
            subiendo ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          aria-hidden
        >
          {subiendo ? <LoaderCircle size={18} className="animate-spin" /> : <Camera size={18} />}
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => alEscoger(e.target.files?.[0])} />
      {error && (
        <p role="alert" className="mt-1 max-w-24 text-center text-[10px] leading-tight text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
