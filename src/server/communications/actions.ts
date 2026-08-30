"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { sendEmail } from "@/lib/email";

/**
 * COMUNICACIONES
 *
 * Un envío crea una notificación POR DESTINATARIO, no un mensaje global. Cuesta
 * más filas, pero permite saber quién lo ha leído y quién no, que es justo lo
 * que una academia necesita cuando avisa de un cambio de aula o de un impago.
 *
 * Canales: aviso dentro del Campus siempre, y correo si se marca. Push, SMS y
 * WhatsApp están modelados y llegarán después; no se ofrecen todavía para no
 * prometer lo que no hay.
 */

export type ComState = { error?: string; ok?: string } | undefined;

const envioSchema = z.object({
  destino: z.enum(["TODOS", "CURSO", "GRUPO", "OPOSICION", "ALUMNO"]),
  destinoId: z.string().optional(),
  titulo: z.string().trim().min(3, "Ponle un asunto."),
  cuerpo: z.string().trim().min(5, "Escribe el mensaje."),
  porCorreo: z.string().optional(),
});

/**
 * Envía una comunicación a muchos destinatarios.
 *
 * @returns A cuántos ha salido, o el motivo.
 * @remarks Los destinatarios se resuelven **en el servidor** a partir del
 *   criterio —un grupo, un curso, quien deba dinero—, no de una lista que
 *   mande el navegador. Así no se puede escribir a quien no toca cambiando la
 *   petición.
 */
export async function sendCommunicationAction(
  _prev: ComState,
  formData: FormData,
): Promise<ComState> {
  const ctx = await requirePermission("communications.send");
  const parsed = envioSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const { destino, destinoId, titulo, cuerpo } = parsed.data;
  const porCorreo = parsed.data.porCorreo === "on";

  if (destino !== "TODOS" && !destinoId) {
    return { error: "Elige a quién se lo mandas." };
  }

  // Resolución de destinatarios. Siempre alumnado activo: no tiene sentido
  // avisar de una clase a quien está de baja.
  const filtroMatricula =
    destino === "CURSO"
      ? { courseId: destinoId }
      : destino === "GRUPO"
        ? { groupId: destinoId }
        : destino === "OPOSICION"
          ? { course: { oppositionEdition: { oppositionId: destinoId } } }
          : {};

  const destinatarios =
    destino === "ALUMNO"
      ? await ctx.db.membership.findMany({
          where: { id: destinoId, deletedAt: null },
          select: { id: true, user: { select: { email: true, firstName: true } } },
        })
      : await ctx.db.membership
          .findMany({
            where: {
              deletedAt: null,
              status: "ACTIVE",
              studentProfile: { is: { status: "ACTIVE" } },
              ...(destino === "TODOS"
                ? {}
                : {
                    enrollments: {
                      some: {
                        deletedAt: null,
                        status: { in: ["ACTIVE", "PAST_DUE"] },
                        ...filtroMatricula,
                      },
                    },
                  }),
            },
            select: { id: true, user: { select: { email: true, firstName: true } } },
          })
          .then((lista) => lista);

  if (destinatarios.length === 0) {
    return { error: "No hay nadie que cumpla ese criterio." };
  }

  await ctx.db.notification.createMany({
    data: destinatarios.map((d) => ({
      recipientId: d.id,
      channel: "IN_APP" as const,
      status: "SENT" as const,
      type: "academy.message",
      title: titulo,
      body: cuerpo,
      sentAt: new Date(),
    })),
  });

  let correosEnviados = 0;
  if (porCorreo) {
    for (const destinatario of destinatarios) {
      const enviado = await sendEmail({
        to: destinatario.user.email,
        subject: `${ctx.academy.name} · ${titulo}`,
        text: `Hola ${destinatario.user.firstName}:\n\n${cuerpo}\n\n— ${ctx.academy.name}`,
      });
      if (enviado) correosEnviados += 1;
    }

    await ctx.db.notification.createMany({
      data: destinatarios.map((d) => ({
        recipientId: d.id,
        channel: "EMAIL" as const,
        status: "SENT" as const,
        type: "academy.message",
        title: titulo,
        body: cuerpo,
        sentAt: new Date(),
      })),
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "communication.send",
    changes: {
      destino,
      destinatarios: destinatarios.length,
      correo: porCorreo,
      asunto: titulo,
    },
  });

  revalidatePath("/gestion/comunicaciones");
  return {
    ok: `Enviado a ${destinatarios.length} ${destinatarios.length === 1 ? "persona" : "personas"}${
      porCorreo ? ` · ${correosEnviados} correos` : ""
    }.`,
  };
}

/** Marca como leída una notificación del propio usuario. */
export async function markNotificationReadAction(formData: FormData) {
  const { requireAcademy } = await import("@/lib/auth/context");
  const ctx = await requireAcademy();
  const id = String(formData.get("notificationId") ?? "");

  await ctx.db.notification.updateMany({
    where: { id, recipientId: ctx.membershipId, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });

  revalidatePath("/campus/avisos");
}
