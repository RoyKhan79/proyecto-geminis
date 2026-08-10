import type { TenantClient } from "@/lib/db/tenant";

/**
 * Consultas de tareas.
 *
 * El cálculo de plazos vive aquí y no en la página: la referencia temporal se
 * toma una vez, junto a los datos, y no durante el renderizado.
 */
export async function loadStudentTasks(db: TenantClient, studentId: string) {
  const ahora = Date.now();

  const entregas = await db.submission.findMany({
    where: { studentId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      score: true,
      feedback: true,
      body: true,
      submittedAt: true,
      files: {
        select: { id: true, file: { select: { id: true, originalName: true } } },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          instructions: true,
          dueAt: true,
          maxScore: true,
          status: true,
          allowLate: true,
        },
      },
    },
  });

  return entregas
    .filter((e) => e.assignment.status === "PUBLISHED")
    .map((entrega) => {
      const plazoPasado = Boolean(
        entrega.assignment.dueAt && entrega.assignment.dueAt.getTime() < ahora,
      );
      const cerrado = plazoPasado && !entrega.assignment.allowLate;

      return {
        ...entrega,
        plazoPasado,
        cerrado,
        puedeEntregar: !cerrado && entrega.status !== "GRADED",
      };
    });
}
