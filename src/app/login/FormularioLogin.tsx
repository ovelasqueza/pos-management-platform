"use client";

import { useActionState } from "react";
import { LockKeyhole, LogIn, User } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { iniciarSesion, type EstadoLogin } from "./acciones";

export function FormularioLogin({ aviso }: { aviso?: { texto: string; tipo: "error" | "exito" } }) {
  const [estado, enviar, enviando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Campo
        etiqueta="Usuario"
        name="usuario"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={estado.usuario}
        icono={<User size={18} />}
        required
        autoFocus
      />
      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        type="password"
        autoComplete="current-password"
        icono={<LockKeyhole size={18} />}
        required
      />
      {estado.error ? <Aviso>{estado.error}</Aviso> : aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <Boton
        type="submit"
        variante="primario"
        tamano="lg"
        disabled={enviando}
        icono={<LogIn size={20} aria-hidden />}
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </Boton>
    </form>
  );
}
