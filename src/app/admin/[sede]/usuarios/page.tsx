import { crearClienteServidor } from "@/lib/supabase/server";
import { listarSedes, resolverSede } from "@/lib/admin/sedes";
import { Encabezado } from "@/components/admin/Encabezado";
import { AccionesUsuario, BotonNuevoUsuario, type UsuarioFila } from "@/components/admin/FormulariosUsuario";

type Fila = {
  id: string;
  nombre_completo: string;
  nombre_usuario: string;
  rol: "cajero" | "admin";
  sede_id: string | null;
  activo: boolean;
};

export default async function PaginaUsuarios({ params }: PageProps<"/admin/[sede]/usuarios">) {
  const { sede: segmento } = await params;
  const [sede, sedes] = await Promise.all([resolverSede(segmento), listarSedes()]);

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("perfiles")
    .select("id, nombre_completo, nombre_usuario, rol, sede_id, activo")
    .order("activo", { ascending: false })
    .order("nombre_completo");
  // Con una sede escogida se ven sus cajeros; en "Todas", todos los usuarios.
  if (sede) consulta = consulta.eq("sede_id", sede.id);

  const { data, error } = await consulta.returns<Fila[]>();
  if (error) throw new Error(`No se pudieron cargar los usuarios: ${error.message}`);

  const nombreSede = new Map(sedes.map((s) => [s.id, s.nombre]));
  const opcionesSede = sedes.map(({ id, nombre, activa }) => ({ id, nombre, activa }));
  const usuarios: UsuarioFila[] = data.map((u) => ({
    id: u.id,
    nombreCompleto: u.nombre_completo,
    nombreUsuario: u.nombre_usuario,
    rol: u.rol,
    sedeId: u.sede_id,
    activo: u.activo,
  }));

  return (
    <section className="flex flex-col gap-4">
      <Encabezado
        titulo={sede ? `Cajeros · ${sede.nombre}` : "Usuarios"}
        accion={<BotonNuevoUsuario sedes={opcionesSede} sedeInicial={sede?.activa ? sede.id : null} />}
      />
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              {!sede && <th className="px-4 py-3 font-medium">Rol</th>}
              {!sede && <th className="hidden px-4 py-3 font-medium md:table-cell">Sede</th>}
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={`border-b border-suave last:border-0 ${u.activo ? "" : "text-texto-3"}`}>
                <td className="px-4 py-2 font-medium">{u.nombreCompleto}</td>
                <td className="num px-4 py-2">{u.nombreUsuario}</td>
                {!sede && <td className="px-4 py-2">{u.rol === "admin" ? "Admin" : "Cajero"}</td>}
                {!sede && (
                  <td className="hidden px-4 py-2 md:table-cell">{u.sedeId ? nombreSede.get(u.sedeId) : "—"}</td>
                )}
                <td className="px-4 py-2">
                  <span
                    className={`rounded-control px-2 py-1 text-xs font-semibold ${
                      u.activo ? "bg-exito-suave text-primario-activo" : "bg-suave text-texto-3"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-1">
                  <AccionesUsuario usuario={u} sedes={opcionesSede} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuarios.length === 0 && <p className="p-6 text-center text-texto-3">Sin usuarios</p>}
      </div>
    </section>
  );
}
