import { NextResponse } from "next/server";
import { enterRoom } from "@/server/tasks/actions";

/**
 * Entrada a una sala online.
 *
 * El enlace real no se muestra nunca en la página: se pide aquí, se comprueba
 * que la sala sea de esta persona y esté abierta, y se redirige. Así un enlace
 * copiado no sirve fuera de la academia y queda registrado quién entra.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const url = await enterRoom(roomId);

  if (!url) {
    return NextResponse.json({ error: "Sala no disponible." }, { status: 404 });
  }

  return NextResponse.redirect(url, { status: 302 });
}
