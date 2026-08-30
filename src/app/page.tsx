import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";

/**
 * La raíz. Lleva a cada uno a su sitio según quién sea.
 */
export default async function RootPage() {
  const ctx = await getAuthContext();
  redirect(ctx ? "/inicio" : "/entrar");
}
