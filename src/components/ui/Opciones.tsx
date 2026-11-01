"use client";

/** Grupo de botones donde se escoge una opción (p. ej. Caja / Caja mayor / Ambas). */
export function Opciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  deshabilitada,
}: {
  etiqueta: string;
  opciones: { valor: T; nombre: string }[];
  valor: T;
  onCambiar: (v: T) => void;
  deshabilitada?: (v: T) => boolean;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-texto-2">{etiqueta}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
        {opciones.map((o) => {
          const activa = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              disabled={deshabilitada?.(o.valor)}
              onClick={() => onCambiar(o.valor)}
              className={`min-h-12 rounded-control border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                activa ? "border-primario bg-exito-suave text-primario-activo" : "border-borde-activo bg-superficie text-texto-2 hover:border-texto"
              }`}
            >
              {o.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
