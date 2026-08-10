import { prismaBase } from "@/lib/db/client";
import type { TenantClient } from "@/lib/db/tenant";

/** Datos del panel del radar. */
export async function loadRadarPanel(db: TenantClient, academyId: string) {
  const [vigilancias, convocatorias, oposiciones, academia, ultimaPasada] =
    await Promise.all([
      db.oppositionWatch.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keywords: true,
          notifyEmails: true,
          isActive: true,
          requireCallPhrase: true,
          _count: { select: { calls: true } },
        },
      }),
      db.officialCall.findMany({
        orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
        take: 60,
        select: {
          id: true,
          title: true,
          department: true,
          source: true,
          status: true,
          publishedAt: true,
          url: true,
          watch: { select: { name: true } },
        },
      }),
      db.opposition.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prismaBase.academy.findUnique({
        where: { id: academyId },
        select: { email: true },
      }),
      // RadarRun es global (el boletín es el mismo para todos), así que se
      // consulta con el cliente base a propósito.
      prismaBase.radarRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          bulletinDate: true,
          itemsScanned: true,
          matches: true,
          ok: true,
          error: true,
        },
      }),
    ]);

  return {
    vigilancias,
    convocatorias,
    nuevas: convocatorias.filter((c) => c.status === "NEW"),
    oposiciones,
    correoAcademia: academia?.email ?? null,
    ultimaPasada,
  };
}
