import type { TenantClient } from "@/lib/db/tenant";

/**
 * Consultas de clases.
 *
 * Vive aquí y no en la página por la regla del proyecto: los componentes no
 * consultan la base de datos ni calculan fechas relativas durante el render.
 */
export async function loadClassBoard(db: TenantClient) {
  const ahora = Date.now();
  const desde = new Date(ahora - 30 * 24 * 60 * 60 * 1000);

  const [clases, cursos, profesores, temas] = await Promise.all([
    db.classSession.findMany({
      where: { deletedAt: null, startsAt: { gte: desde } },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        location: true,
        meetingUrl: true,
        recordingUrl: true,
        group: { select: { name: true } },
        course: { select: { name: true } },
        teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { attendances: true } },
      },
    }),
    db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groups: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    db.membership.findMany({
      where: { deletedAt: null, teacherProfile: { isNot: null } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    }),
    db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 200,
      select: { id: true, label: true },
    }),
  ]);

  return {
    proximas: clases.filter((c) => c.startsAt.getTime() >= ahora),
    pasadas: clases.filter((c) => c.startsAt.getTime() < ahora).reverse(),
    total: clases.length,
    cursos: cursos.map((c) => ({ id: c.id, name: c.name, grupos: c.groups })),
    profesores: profesores.map((p) => ({
      id: p.id,
      nombre: `${p.user.firstName} ${p.user.lastName ?? ""}`.trim(),
    })),
    temas,
  };
}

/** Una clase en el listado, con su profesor, su grupo y su asistencia. */
export type ClaseLista = Awaited<
  ReturnType<typeof loadClassBoard>
>["proximas"][number];
