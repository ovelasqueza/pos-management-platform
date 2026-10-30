import { LogOut } from "lucide-react";

/** Cerrar sesión: ícono + palabra para que se encuentre fácil. En pantallas pequeñas, solo el ícono. */
export function BotonSalir({ compacto = false }: { compacto?: boolean }) {
  return (
    <form action="/salir" method="post">
      <button
        type="submit"
        aria-label="Salir"
        className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-control border border-borde bg-superficie px-3 font-medium text-texto-2 hover:border-peligro hover:text-peligro"
      >
        <LogOut size={20} aria-hidden />
        <span className={compacto ? "hidden sm:inline" : ""}>Salir</span>
      </button>
    </form>
  );
}
