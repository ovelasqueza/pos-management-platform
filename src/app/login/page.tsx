import { Store } from "lucide-react";
import { FormularioLogin } from "./FormularioLogin";

const avisos: Record<string, { texto: string; tipo: "error" | "exito" }> = {
  inactivo: { texto: "Usuario inactivo", tipo: "error" },
  "sede-inactiva": { texto: "Sede inactiva", tipo: "error" },
  "turno-cerrado": { texto: "Turno cerrado. Ingresa con el siguiente cajero", tipo: "exito" },
  "otro-equipo": {
    texto: "Tu turno está abierto en otro equipo. Ciérralo allí o pide al administrador que lo cierre",
    tipo: "error",
  },
};

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { motivo } = await searchParams;
  const aviso = typeof motivo === "string" ? avisos[motivo] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-tarjeta border border-borde bg-superficie p-8">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex size-14 items-center justify-center rounded-tarjeta bg-primario text-white">
            <Store size={28} aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold">POS</h1>
        </div>
        <FormularioLogin aviso={aviso} />
      </div>
    </main>
  );
}
