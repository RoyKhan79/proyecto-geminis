import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { construirMochila } from "@/server/campus/mochila";

/**
 * MANIFIESTO DE LA MOCHILA
 *
 * Le dice al móvil qué temas puede guardar para estudiar sin conexión. No
 * devuelve ni un byte de contenido: solo la lista. Los documentos se piden
 * después, uno a uno, por la misma ruta protegida de siempre
 * (`/api/archivos/[fileId]?descargar=1`), que vuelve a comprobar todo.
 *
 * Esa separación es deliberada. Si mañana alguien se equivoca aquí y mete en la
 * lista un tema que no toca, la descarga seguirá fallando en la ruta de
 * archivos. Ninguna de las dos se fía de la otra.
 *
 * `no-store` porque la respuesta depende de quién pregunta y de qué tiene
 * contratado hoy: una copia cacheada sería una copia de los permisos de otro
 * momento, y justo la caducidad de permisos es lo que esto tiene que respetar.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.academy || !ctx.membershipId) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const mochila = await construirMochila(ctx.academy.id, ctx.membershipId);

  return NextResponse.json(mochila, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
