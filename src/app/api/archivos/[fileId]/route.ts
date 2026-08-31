import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getEffectiveFlags,
  isNodeReleased,
  loadStudentGrants,
  studentCanAccessNode,
} from "@/lib/access/content-access";
import { prismaBase } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import {
  abrirParaAcademia,
  claveEsDeLaAcademia,
  storage,
  toWebStream,
} from "@/lib/storage";

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

  // Las fotos de perfil no cuelgan de ningún tema, así que la comprobación de
  // temario no les vale. Se permiten a cualquiera de la academia —una foto de
  // clase la ve la clase— pero solo si de verdad es la foto de alguien de ESTA
  // academia: la consulta lo exige, no se fía de que la URL lo parezca.
  const esFotoDeAlguienDeLaAcademia = await prismaBase.user.findFirst({
    where: {
      avatarUrl: `/api/archivos/${file.id}`,
      memberships: { some: { academyId: ctx.academy.id, deletedAt: null } },
    },
    select: { id: true },
  });

  if (!esPersonal && !esFotoDeAlguienDeLaAcademia) {
    if (!nodo) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    const grants = await loadStudentGrants(ctx.academy.id, ctx.membershipId);
    if (!studentCanAccessNode(grants, nodo, "VIEW_CONTENT")) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    // Ritmo del temario: si el profesor aún no ha abierto este tema a su grupo,
    // el documento tampoco se sirve.
    if (!(await isNodeReleased(ctx.academy.id, nodo.id, grants.groupIds))) {
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

  // SEGUNDA BARRERA PARA LOS ARCHIVOS
  //
  // Independiente de la consulta de arriba: la clave de todo objeto empieza por
  // su academia, así que se comprueba aquí también. Si algún día un fallo en esa
  // consulta trajera un archivo ajeno, no se sirve igualmente. Va ANTES incluso
  // de mirar si el archivo existe, para no confirmar por el código de respuesta
  // la existencia de nada que no sea nuestro.
  if (!claveEsDeLaAcademia(file.storageKey, ctx.academy.id)) {
    console.error(
      `[aislamiento] La clave «${file.storageKey}» no es de la academia ${ctx.academy.id}. Petición rechazada.`,
    );
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
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

  // Segunda barrera, independiente de la consulta de arriba: la clave de todo
  // archivo empieza por su academia, así que se comprueba antes de devolver un
  // solo byte. Si algún día un fallo en la consulta trajera un archivo ajeno,
  // aquí se para igualmente. Los archivos pasan así a tener dos barreras, como
  // la base de datos.
  const stream = await abrirParaAcademia(file.storageKey, ctx.academy.id);
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
