import { redirect } from "next/navigation";

/** Precios se unificó con Productos: se conserva la ruta por si alguien tiene el enlace guardado. */
export default async function Precios({ params }: PageProps<"/admin/[sede]/precios">) {
  const { sede } = await params;
  redirect(`/admin/${sede}/productos`);
}
