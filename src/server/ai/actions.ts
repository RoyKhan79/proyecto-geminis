"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy, requirePermission } from "@/lib/auth/context";
import { aiDisponible, askAi } from "@/lib/ai/gateway";
import { indexarAcademia } from "@/lib/ai/indexer";
import {
  SYSTEM_ALUMNO,
  SYSTEM_COPILOTO,
  construirContexto,
  recuperarFragmentos,
} from "@/lib/ai/retrieval";

/**
 * GEMINIS IA · acciones
 *
 * Dos usos, el mismo motor de recuperación y las mismas reglas:
 *   · el alumno pregunta sobre lo que tiene contratado,
 *   · el profesor genera borradores a partir del material de su academia.
 *
 * Nada de lo que genera la IA se publica solo (§22, ADR-0009).
 */

export type AiState =
  | {
      error?: string;
      respuesta?: string;
      fuentes?: { numero: number; titulo: string; localizador: string | null }[];
      sinFuentes?: boolean;
    }
  | undefined;

const preguntaSchema = z.object({
  pregunta: z.string().trim().min(4, "Escribe tu pregunta.").max(1000),
  nodeId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
});

export async function askStudentAction(
  _prev: AiState,
  formData: FormData,
): Promise<AiState> {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("ai.student")) {
    return { error: "Tu academia no tiene activado el asistente." };
  }

  const parsed = preguntaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la pregunta." };
  }

  if (!aiDisponible()) {
    return {
      error:
        "Geminis IA todavía no está activada en esta instalación. Configura el proveedor en los ajustes del servidor.",
    };
  }

  // Recuperación CON permisos: solo el material que este alumno tiene abierto.
  const fragmentos = await recuperarFragmentos({
    academyId: ctx.academy.id,
    membershipId: ctx.membershipId,
    esPersonal: false,
    pregunta: parsed.data.pregunta,
    nodeId: parsed.data.nodeId || null,
  });

  if (fragmentos.length === 0) {
    // No se llama al modelo: sin material no hay nada que responder, y
    // preguntarle igualmente sería invitarle a inventar.
    return {
      sinFuentes: true,
      respuesta:
        "No encuentro esa información en el material de tu academia. Puede que ese tema todavía no esté abierto o que no lo tengas incluido en tu plan. Consúltalo con tu preparador.",
      fuentes: [],
    };
  }

  const respuesta = await askAi({
    academyId: ctx.academy.id,
    memberId: ctx.membershipId,
    feature: "student.chat",
    messages: [
      { role: "system", content: SYSTEM_ALUMNO },
      {
        role: "user",
        content: `FRAGMENTOS DEL MATERIAL DE LA ACADEMIA:\n\n${construirContexto(fragmentos)}\n\nPREGUNTA DEL ALUMNO:\n${parsed.data.pregunta}`,
      },
    ],
  });

  if (!respuesta.ok) return { error: respuesta.reason };

  // La conversación se guarda con sus citas, para poder comprobarlas después.
  const conversacion = parsed.data.conversationId
    ? await ctx.db.aIConversation.findUnique({
        where: { id: parsed.data.conversationId },
        select: { id: true, memberId: true },
      })
    : null;

  const hilo =
    conversacion && conversacion.memberId === ctx.membershipId
      ? conversacion
      : await ctx.db.aIConversation.create({
          data: {
            memberId: ctx.membershipId,
            kind: "STUDENT_TUTOR",
            title: parsed.data.pregunta.slice(0, 80),
            contextNodeId: parsed.data.nodeId || null,
          },
        });

  const citas = fragmentos.map((f, i) => ({
    numero: i + 1,
    chunkId: f.chunkId,
    sourceId: f.sourceId,
    titulo: f.nodeLabel ?? f.sourceTitle,
    localizador: f.locator,
  }));

  await ctx.db.aIMessage.createMany({
    data: [
      {
        conversationId: hilo.id,
        role: "user",
        content: parsed.data.pregunta,
      },
      {
        conversationId: hilo.id,
        role: "assistant",
        content: respuesta.content,
        citations: citas,
        provider: respuesta.provider,
        model: respuesta.model,
        promptTokens: respuesta.promptTokens,
        completionTokens: respuesta.completionTokens,
      },
    ],
  });

  revalidatePath("/campus/ia");

  return {
    respuesta: respuesta.content,
    fuentes: citas.map((c) => ({
      numero: c.numero,
      titulo: c.titulo,
      localizador: c.localizador,
    })),
  };
}

const copilotoSchema = z.object({
  nodeId: z.string().min(1, "Elige un tema."),
  cantidad: z.coerce.number().int().min(1).max(20).default(5),
  dificultad: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

/**
 * Copiloto: genera preguntas a partir del material del tema.
 *
 * Todo entra como BORRADOR con su procedencia guardada. No hay ninguna ruta que
 * publique esto sin que una persona lo apruebe.
 */
export async function generateQuestionsAction(
  _prev: AiState,
  formData: FormData,
): Promise<AiState> {
  const ctx = await requirePermission("ai.copilot");
  const parsed = copilotoSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  if (!aiDisponible()) {
    return { error: "Geminis IA no está activada en esta instalación." };
  }

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: parsed.data.nodeId },
    select: { id: true, label: true, editionId: true, usableForTests: true },
  });
  if (!nodo) return { error: "Ese tema no existe." };
  if (nodo.usableForTests === false) {
    return { error: "Este contenido está marcado como no utilizable para generar preguntas." };
  }

  const fragmentos = await recuperarFragmentos({
    academyId: ctx.academy.id,
    membershipId: ctx.membershipId,
    esPersonal: true,
    pregunta: nodo.label,
    nodeId: nodo.id,
    limite: 10,
  });

  if (fragmentos.length === 0) {
    return {
      error:
        "Ese tema no tiene material indexado. Sube el documento y pulsa «Indexar material» antes de generar preguntas.",
    };
  }

  const dificultades = { EASY: "fáciles", MEDIUM: "de dificultad media", HARD: "difíciles" };

  const respuesta = await askAi({
    academyId: ctx.academy.id,
    memberId: ctx.membershipId,
    feature: "copilot.generate_questions",
    maxTokens: 3000,
    messages: [
      { role: "system", content: SYSTEM_COPILOTO },
      {
        role: "user",
        content: `MATERIAL DEL TEMA «${nodo.label}»:\n\n${construirContexto(fragmentos)}\n\nGenera ${parsed.data.cantidad} preguntas tipo test ${dificultades[parsed.data.dificultad]} basadas EXCLUSIVAMENTE en este material.\n\nDevuelve SOLO un JSON válido con esta forma, sin texto alrededor:\n{"preguntas":[{"enunciado":"...","opciones":["A","B","C","D"],"correcta":0,"explicacion":"... [1]"}]}`,
      },
    ],
  });

  if (!respuesta.ok) return { error: respuesta.reason };

  let generadas: {
    enunciado: string;
    opciones: string[];
    correcta: number;
    explicacion?: string;
  }[];

  try {
    const json = respuesta.content.replace(/^```json\s*|\s*```$/g, "").trim();
    const parseado = JSON.parse(json) as { preguntas?: unknown };
    generadas = (parseado.preguntas ?? []) as typeof generadas;
  } catch {
    return {
      error:
        "La respuesta de la IA no ha llegado en el formato esperado. Vuelve a intentarlo.",
    };
  }

  let creadas = 0;
  for (const generada of generadas) {
    if (
      !generada.enunciado ||
      !Array.isArray(generada.opciones) ||
      generada.opciones.length < 2 ||
      generada.correcta < 0 ||
      generada.correcta >= generada.opciones.length
    ) {
      continue;
    }

    const pregunta = await ctx.db.question.create({
      data: {
        nodeId: nodo.id,
        editionId: nodo.editionId,
        type: "SINGLE_CHOICE",
        difficulty: parsed.data.dificultad,
        // SIEMPRE borrador. Es la regla que no se toca.
        status: "DRAFT",
        source: "AI_GENERATED",
        statement: generada.enunciado,
        explanation: generada.explicacion ?? null,
        authorId: ctx.membershipId,
        aiProvenance: {
          proveedor: respuesta.provider,
          modelo: respuesta.model,
          fecha: new Date().toISOString(),
          solicitadaPor: ctx.membershipId,
          fragmentos: fragmentos.map((f) => ({
            chunkId: f.chunkId,
            fuente: f.sourceTitle,
            localizador: f.locator,
          })),
        },
      },
    });

    await ctx.db.questionOption.createMany({
      data: generada.opciones.map((text, position) => ({
        questionId: pregunta.id,
        text: String(text),
        position,
        isCorrect: position === generada.correcta,
      })),
    });

    creadas += 1;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "ai.generate_questions",
    entityType: "ContentNode",
    entityId: nodo.id,
    changes: { tema: nodo.label, generadas: creadas, modelo: respuesta.model },
  });

  revalidatePath("/gestion/tests");
  revalidatePath("/gestion/ia");

  return {
    respuesta:
      creadas === 0
        ? "No se ha podido aprovechar ninguna de las preguntas generadas."
        : `${creadas} preguntas creadas EN BORRADOR sobre «${nodo.label}». Revísalas en el banco de preguntas antes de publicarlas.`,
  };
}

/** Indexa el material de la academia para que la IA pueda consultarlo. */
export async function indexContentAction(): Promise<AiState> {
  const ctx = await requirePermission("ai.settings");

  const resultados = await indexarAcademia(ctx.academy.id);
  const indexados = resultados.filter((r) => r.estado === "INDEXED");
  const fallidos = resultados.filter((r) => r.estado === "FAILED");
  const fragmentos = indexados.reduce((suma, r) => suma + r.fragmentos, 0);

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "ai.index",
    changes: { documentos: indexados.length, fragmentos, fallidos: fallidos.length },
  });

  revalidatePath("/gestion/ia");

  return {
    respuesta: `${indexados.length} documentos indexados (${fragmentos} fragmentos).${
      fallidos.length > 0
        ? ` ${fallidos.length} no se han podido procesar: ${fallidos[0].motivo ?? ""}`
        : ""
    }`,
  };
}
