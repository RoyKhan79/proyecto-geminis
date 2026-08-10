import type { TenantClient } from "@/lib/db/tenant";

/**
 * Datos del panel de Manager.
 *
 * Vive aquí y no en la página por dos motivos: los componentes no consultan la
 * base de datos (regla del proyecto) y el cálculo de fechas relativas no debe
 * ocurrir durante el renderizado.
 */
export async function loadAcademyOverview(db: TenantClient) {
  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    alumnosActivos,
    altasUltimos30,
    profesores,
    matriculasActivas,
    oposiciones,
    ultimasAltas,
  ] = await Promise.all([
    db.membership.count({
      where: { deletedAt: null, studentProfile: { is: { status: "ACTIVE" } } },
    }),
    db.membership.count({
      where: {
        deletedAt: null,
        studentProfile: { isNot: null },
        createdAt: { gte: desde30 },
      },
    }),
    db.membership.count({
      where: { deletedAt: null, teacherProfile: { isNot: null } },
    }),
    db.enrollment.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.opposition.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.membership.findMany({
      where: { deletedAt: null, studentProfile: { isNot: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  return {
    alumnosActivos,
    altasUltimos30,
    profesores,
    matriculasActivas,
    oposiciones,
    ultimasAltas,
  };
}

/** Días que faltan para una fecha. Devuelve null si no hay fecha o ya pasó. */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const dias = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return dias > 0 ? dias : null;
}
