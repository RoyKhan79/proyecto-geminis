"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAcademy } from "@/lib/auth/context";
import {
  isNodeReleased,
  loadStudentGrants,
  studentCanAccessNode,
} from "@/lib/access/content-access";
import { prismaBase } from "@/lib/db/client";

const progressSchema = z.object({
  nodeId: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
});

/**
 * Marca el progreso de un alumno sobre un tema.
 *
 * Vuelve a comprobar el derecho de acceso: que el enlace estuviera en pantalla
 * no basta, porque una petición se puede fabricar a mano. Es la misma regla que
 * en el resto del sistema: la interfaz propone, el servidor decide.
 */
export async function markProgressAction(formData: FormData) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("campus.access")) throw new Error("Sin acceso al campus.");

  const parsed = progressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Datos no válidos.");

  const { nodeId, status } = parsed.data;

  const node = await ctx.db.contentNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      path: true,
      editionId: true,
      isFree: true,
      visibleToStudents: true,
      status: true,
    },
  });
  if (!node) throw new Error("Ese contenido no existe.");

  const grants = await loadStudentGrants(ctx.academy.id, ctx.membershipId);
  if (!studentCanAccessNode(grants, node, "VIEW_CONTENT")) {
    throw new Error("No tienes acceso a este contenido.");
  }
  if (!(await isNodeReleased(ctx.academy.id, node.id, grants.groupIds))) {
    throw new Error("Este tema todavía no está abierto.");
  }

  const now = new Date();

  await ctx.db.studentContentProgress.upsert({
    where: { studentId_nodeId: { studentId: ctx.membershipId, nodeId } },
    create: {
      studentId: ctx.membershipId,
      nodeId,
      status,
      firstStartedAt: now,
      lastViewedAt: now,
      completedAt: status === "COMPLETED" ? now : null,
    },
    update: {
      status,
      lastViewedAt: now,
      completedAt: status === "COMPLETED" ? now : null,
      ...(status === "IN_PROGRESS" ? { reviewCount: { increment: 1 } } : {}),
    },
  });

  // Señal de actividad: es la base del cálculo de riesgo de abandono (§34).
  await prismaBase.studentProfile.updateMany({
    where: { membershipId: ctx.membershipId },
    data: { lastActivityAt: now },
  });

  revalidatePath(`/campus/estudiar/${nodeId}`);
  revalidatePath("/campus");
}
