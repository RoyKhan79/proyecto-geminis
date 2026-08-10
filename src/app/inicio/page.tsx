import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";

/**
 * Punto de entrada tras iniciar sesión.
 *
 * Geminis son dos aplicaciones (§4) y la persona no tiene por qué saber cuál le
 * toca: se decide aquí a partir de sus permisos. Quien es a la vez profesor y
 * alumno entra en Manager y puede cambiar al Campus desde la barra superior.
 */
export default async function InicioPage() {
  const ctx = await requireAuth();

  if (!ctx.academy) {
    redirect(ctx.user.isPlatformAdmin ? "/plataforma" : "/elegir-academia");
  }

  if (ctx.permissions.has("manager.access")) redirect("/gestion");
  if (ctx.permissions.has("campus.access")) redirect("/campus");

  redirect("/sin-acceso");
}
