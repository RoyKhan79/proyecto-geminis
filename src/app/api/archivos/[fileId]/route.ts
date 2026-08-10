import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getEffectiveFlags,
  loadStudentGrants,
  studentCanAccessNode,
} from "@/lib/access/content-access";
import { prismaBase } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { storage, toWebStream } from "@/lib/storage";

/**
 * SERVICIO DE ARCHIVOS
 *
 * Único camino por el que sale un documento de Proyecto Geminis. Antes de
 * devolver un solo byte comprueba, en este orden:
 *
 *   1. que hay sesión,
 *   2. que el archivo es de SU academia,
 *   3. si es personal de la academia → basta con `content.read`,
 *   4. si es alumno → que tiene derecho de acceso sobre ese contenido,
 *   5. si pide descargarlo → que esa rama permite descarga.
 *
 * No existen URLs públicas permanentes: aunque alguien comparta este enlace,
 * quien lo abra tendrá que ser de la academia y tener el contenido contratado.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx?.academy || !ctx.membershipId) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const { fileId } = await params;

  const file = await prismaBase.storedFile.findFirst({
    where: { id: fileId, academyId: ctx.academy.id, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      resources: {
        select: {
          node: {
            select: {
              id: true,
              path: true,
              editionId: true,
              isFree: true,
              visibleToStudents: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!file) {
    // Mismo mensaje tanto si no existe como si es de otra academia: no
    // confirmamos la existencia de archivos ajenos.
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }

  const nodo = file.resources[0]?.node ?? null;
  // Personal de la academia = puede entrar en Manager Y tiene permiso de
  // contenido. Se exigen las dos cosas a propósito: si mañana alguien añade
  // "content.read" a un rol de alumnado por descuido, esto sigue cerrado.
  const esPersonal =
    ctx.permissions.has("manager.access") && ctx.permissions.has("content.read");
  const descarga = new URL(request.url).searchParams.get("descargar") === "1";

  if (!esPersonal) {
    if (!nodo) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    const grants = await loadStudentGrants(ctx.academy.id, ctx.membershipId);
    if (!studentCanAccessNode(grants, nodo, "VIEW_CONTENT")) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    if (descarga) {
      const flags = await getEffectiveFlags(ctx.academy.id, nodo.id);
      const permitidoPorAcademia = flags?.downloadable ?? false;
      const tieneDerecho = studentCanAccessNode(grants, nodo, "DOWNLOAD_CONTENT");

      // Ver y descargar son permisos distintos: la academia puede querer que su
      // temario se lea online y no salga de la plataforma.
      if (!permitidoPorAcademia || !tieneDerecho) {
        return NextResponse.json(
          { error: "Este documento solo se puede consultar en línea." },
          { status: 403 },
        );
      }
    }
  }

  const almacen = storage();
  if (!(await almacen.exists(file.storageKey))) {
    return NextResponse.json(
      { error: "El archivo ya no está disponible." },
      { status: 410 },
    );
  }

  if (descarga) {
    await recordAudit({
      academyId: ctx.academy.id,
      actorId: ctx.user.id,
      impersonatorId: ctx.impersonatedById,
      action: "file.download",
      entityType: "StoredFile",
      entityId: file.id,
      context: { archivo: file.originalName },
    });
  }

  const stream = await almacen.getStream(file.storageKey);
  const nombre = encodeURIComponent(file.originalName);

  return new NextResponse(toWebStream(stream), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${descarga ? "attachment" : "inline"}; filename*=UTF-8''${nombre}`,
      // Privado: ni un proxy ni la caché compartida deben guardar material de
      // pago que depende de quién lo pide.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
