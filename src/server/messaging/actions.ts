"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy } from "@/lib/auth/context";

/**
 * MENSAJES INTERNOS
 *
 * Conversación privada entre un alumno y su academia. Sustituye al WhatsApp al
 * móvil personal del preparador a las once de la noche: queda registrado, lo
 * puede atender quien esté, y no se pierde si cambia el profesor (ADR-0024).
 */

export type MsgState = { error?: string; ok?: string } | undefined;

const nuevoHiloSchema = z.object({
  subject: z.string().trim().min(3, "Ponle un asunto."),
  body: z.string().trim().min(2, "Escribe tu mensaje.").max(4000),
  teacherId: z.string().trim().optional(),
});

/**
 * Abre una conversación con un alumno.
 *
 * @returns Confirmación, o el motivo. Se comprueba que el destinatario sea de
 *   la academia: un identificador tecleado no abre una conversación con el
 *   alumno de otra.
 */
export async function startThreadAction(
  _prev: MsgState,
  formData: FormData,
): Promise<MsgState> {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("campus.access")) {
    return { error: "Solo el alumnado abre conversaciones desde aquí." };
  }

  const parsed = nuevoHiloSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }

  // Si elige profesor, se comprueba que sea de esta academia y que lo sea.
  let teacherId: string | null = null;
  if (parsed.data.teacherId) {
    const profesor = await ctx.db.membership.findFirst({
      where: { id: parsed.data.teacherId, teacherProfile: { isNot: null } },
      select: { id: true },
    });
    teacherId = profesor?.id ?? null;
  }

  const hilo = await ctx.db.messageThread.create({
    data: {
      studentId: ctx.membershipId,
      teacherId,
      subject: parsed.data.subject,
      status: "OPEN",
      unreadForStaff: true,
      unreadForStudent: false,
      lastMessageAt: new Date(),
    },
  });

  await ctx.db.message.create({
    data: { threadId: hilo.id, authorId: ctx.membershipId, body: parsed.data.body },
  });

  revalidatePath("/campus/mensajes");
  revalidatePath("/gestion/mensajes");
  return { ok: "Mensaje enviado. Te responderán desde la academia." };
}

const responderSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1, "Escribe algo.").max(4000),
});

/**
 * Responde en una conversación.
 *
 * @returns Confirmación, o el motivo. El texto se sanea antes de guardarlo:
 *   sin eso, un mensaje con etiquetas se ejecutaría en la pantalla de quien lo
 *   lee, con su sesión.
 */
export async function replyThreadAction(
  _prev: MsgState,
  formData: FormData,
): Promise<MsgState> {
  const ctx = await requireAcademy();
  const parsed = responderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }

  const hilo = await ctx.db.messageThread.findUnique({
    where: { id: parsed.data.threadId },
    select: { id: true, studentId: true, deletedAt: true },
  });
  if (!hilo || hilo.deletedAt) return { error: "Esa conversación ya no existe." };

  const esPersonal = ctx.permissions.has("manager.access");
  const esSuyo = hilo.studentId === ctx.membershipId;

  // Un alumno solo escribe en su hilo. Sin esta comprobación, cambiar el
  // identificador en el formulario permitiría leer y contestar hilos ajenos.
  if (!esPersonal && !esSuyo) return { error: "Esa conversación no es tuya." };

  await ctx.db.message.create({
    data: {
      threadId: hilo.id,
      authorId: ctx.membershipId,
      body: parsed.data.body,
    },
  });

  await ctx.db.messageThread.update({
    where: { id: hilo.id },
    data: {
      lastMessageAt: new Date(),
      status: esPersonal ? "ANSWERED" : "OPEN",
      unreadForStaff: !esPersonal,
      unreadForStudent: esPersonal,
      ...(esPersonal && !hilo.studentId ? {} : {}),
    },
  });

  if (esPersonal) {
    // El alumno se entera aunque no tenga la aplicación abierta.
    await ctx.db.notification.create({
      data: {
        recipientId: hilo.studentId,
        type: "message.reply",
        title: "Tienes respuesta de tu academia",
        body: parsed.data.body.slice(0, 160),
        actionUrl: "/campus/mensajes",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }

  revalidatePath("/campus/mensajes");
  revalidatePath("/gestion/mensajes");
  return { ok: "Enviado." };
}

/**
 * Cierra una conversación.
 *
 * No la borra: se queda en el histórico y deja de aparecer entre las abiertas.
 */
export async function closeThreadAction(formData: FormData) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("manager.access")) throw new Error("Sin permiso.");

  const threadId = String(formData.get("threadId") ?? "");
  await ctx.db.messageThread.update({
    where: { id: threadId },
    data: { status: "CLOSED", unreadForStaff: false },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "message.close",
    entityType: "MessageThread",
    entityId: threadId,
  });

  revalidatePath("/gestion/mensajes");
}

/** Marca el hilo como leído por el lado que lo está abriendo. */
export async function markThreadReadAction(threadId: string) {
  const ctx = await requireAcademy();
  const esPersonal = ctx.permissions.has("manager.access");

  await ctx.db.messageThread.updateMany({
    where: {
      id: threadId,
      ...(esPersonal ? {} : { studentId: ctx.membershipId }),
    },
    data: esPersonal ? { unreadForStaff: false } : { unreadForStudent: false },
  });
}
