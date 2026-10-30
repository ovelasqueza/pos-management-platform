/** Se muestra al instante mientras carga una sección del admin. */
export default function Cargando() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 rounded-control bg-borde" />
      <div className="h-12 w-full max-w-md rounded-control bg-suave" />
      <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 rounded-control bg-suave" />
        ))}
      </div>
    </div>
  );
}
