"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy, requirePermission } from "@/lib/auth/context";
import { limitarAccion } from "@/lib/rate-limit";
import { loadStudentGrants, tieneCapacidad } from "@/lib/access/content-access";
import { aiDisponible, askAi } from "@/lib/ai/gateway";
import {
  explicarFallo,
  generarPreguntasLocales,
  responderConMaterial,
} from "@/lib/ai/local-engine";
import { indexarAcademia } from "@/lib/ai/indexer";
import { comoLlevaElTema } from "./insights";
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
      /// Quién ha respondido: el modelo contratado o el motor propio.
      motor?: "modelo" | "local";
      /// Confianza declarada por el motor local. Es más honesto decirla.
      confianza?: string;
      /// Comentario personal sobre cómo lleva ese tema quien pregunta.
      apunte?: string;
    }
  | undefined;

const preguntaSchema = z.object({
  pregunta: z.string().trim().min(4, "Escribe tu pregunta.").max(1000),
  nodeId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
});

/**
 * La pregunta de un alumno a Geminis IA.
 *
 * @returns La respuesta con sus citas, o el motivo si no se puede responder.
 * @remarks El orden no se negocia: sesión, academia, permisos, matrículas,
 *   derechos, ritmo del temario, **y después** buscar. El filtro va antes de la
 *   búsqueda, nunca después: filtrar los resultados significaría que el sistema
 *   ya ha leído material que esa persona no puede ver.
 */
export async function askStudentAction(
  _prev: AiState,
  formData: FormData,
): Promise<AiState> {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("ai.student")) {
    return { error: "Tu academia no tiene activado el asistente." };
  }

  /*
   * Y que ESTE alumno lo tenga. La comprobación de arriba es de la academia;
   * esta es de la persona, porque la academia reparte el tutor alumno a alumno
   * desde su ficha. Va aquí y no solo en la pantalla: esconder un formulario no
   * autoriza nada, y esta acción se puede llamar directamente.
   */
  const derechos = await loadStudentGrants(ctx.academy.id, ctx.membershipId);
  if (!tieneCapacidad(derechos, "USE_AI_TUTOR")) {
    return { error: "No tienes el asistente incluido. Consúltalo con tu academia." };
  }

  // Cada pregunta la paga la academia en tokens. El tope va DESPUÉS de
  // comprobar que esta persona puede preguntar —no se cuenta a quien no iba a
  // poder— y ANTES de recuperar nada: la búsqueda también cuesta.
  const espera = await limitarAccion("iaAlumno", ctx.membershipId);
  if (espera) return { error: espera };

  const parsed = preguntaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la pregunta." };
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
    // Sin material no hay nada que responder, y preguntarle igualmente a un
    // modelo sería invitarle a inventar.
    return {
      sinFuentes: true,
      respuesta:
        "No encuentro esa información en el material de tu academia. Puede que ese tema todavía no esté abierto o que no lo tengas incluido en tu plan. Consúltalo con tu preparador.",
      fuentes: [],
      motor: "local",
    };
  }

  // Con proveedor configurado responde el modelo; sin él, el motor local. En
  // los dos casos se usa el mismo material y se citan las mismas fuentes: la
  // academia no se queda sin asistente por no contratar una API.
  let contenido: string;
  let motor: "modelo" | "local" = "local";
  let confianza: string | undefined;

  if (aiDisponible()) {
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

    if (respuesta.ok) {
      contenido = respuesta.content;
      motor = "modelo";
    } else {
      // Si el proveedor falla, no se deja al alumno sin respuesta.
      const local = responderConMaterial(parsed.data.pregunta, fragmentos);
      contenido = local.texto;
      confianza = local.confianza;
    }
  } else {
    const local = responderConMaterial(parsed.data.pregunta, fragmentos);
    contenido = local.texto;
    confianza = local.confianza;
  }

  const respuesta = {
    ok: true,
    content: contenido,
    provider: motor === "modelo" ? "proveedor" : "motor-local",
    model: motor === "modelo" ? "configurado" : "geminis-local",
    promptTokens: 0,
    completionTokens: 0,
  };

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

  // Coletilla personal: si el alumno pregunta por un tema que lleva flojo, se
  // le dice con el dato delante y se le ofrece lo que le conviene. Un asistente
  // que responde igual a quien domina el tema y a quien lleva la mitad fallada
  // es un buscador, no un asistente.
  let apunte: string | undefined;
  if (parsed.data.nodeId) {
    const como = await comoLlevaElTema({
      db: ctx.db,
      studentId: ctx.membershipId,
      nodeId: parsed.data.nodeId,
    });
    if (como && como.ratio >= 0.35) {
      apunte = `En este tema llevas ${como.fallos} fallos de ${como.vistas} respuestas. Merece la pena que hagas un test de repaso en cuanto termines de leer esto.`;
    } else if (como && como.ratio <= 0.1) {
      apunte = `Este tema lo llevas bien: ${como.vistas - como.fallos} aciertos de ${como.vistas}.`;
    }
  }

  return {
    respuesta: respuesta.content,
    apunte,
    motor,
    confianza,
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

  const espera = await limitarAccion("iaCopiloto", ctx.membershipId);
  if (espera) return { error: espera };

  const parsed = copilotoSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
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

  const dificultades = {
    EASY: "fáciles",
    MEDIUM: "de dificultad media",
    HARD: "difíciles",
  };

  type Generada = {
    enunciado: string;
    opciones: string[];
    correcta: number;
    explicacion?: string;
  };

  let generadas: Generada[] = [];
  let motorUsado: "modelo" | "local" = "local";
  let modelo = "geminis-local";
  let proveedor = "motor-local";

  if (aiDisponible()) {
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

    if (respuesta.ok) {
      try {
        const json = respuesta.content.replace(/^```json\s*|\s*```$/g, "").trim();
        const parseado = JSON.parse(json) as { preguntas?: unknown };
        generadas = (parseado.preguntas ?? []) as Generada[];
        motorUsado = "modelo";
        modelo = respuesta.model;
        proveedor = respuesta.provider;
      } catch {
        // Formato inesperado: se cae al motor local en lugar de dejar al
        // profesor con las manos vacías.
        generadas = [];
      }
    }
  }

  if (generadas.length === 0) {
    // Motor propio: construye preguntas de completar a partir de los datos
    // concretos del material (plazos, cifras, artículos), que es exactamente lo
    // que más se pregunta en una oposición.
    generadas = generarPreguntasLocales(fragmentos, parsed.data.cantidad).map((p) => ({
      enunciado: p.enunciado,
      opciones: p.opciones,
      correcta: p.correcta,
      explicacion: p.explicacion,
    }));
  }

  if (generadas.length === 0) {
    return {
      error:
        "No he encontrado datos concretos en este tema con los que construir preguntas. Funciona mejor con material que tenga plazos, cifras o artículos.",
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
          proveedor,
          modelo,
          motor: motorUsado,
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
    changes: { tema: nodo.label, generadas: creadas, modelo },
  });

  revalidatePath("/gestion/tests");
  revalidatePath("/gestion/ia");

  return {
    motor: motorUsado,
    respuesta:
      creadas === 0
        ? "No se ha podido aprovechar ninguna de las preguntas generadas."
        : `${creadas} preguntas creadas EN BORRADOR sobre «${nodo.label}»${
            motorUsado === "local" ? " con el motor propio" : ""
          }. Revísalas en el banco de preguntas antes de publicarlas.`,
  };
}

/** Indexa el material de la academia para que la IA pueda consultarlo. */
export async function indexContentAction(): Promise<AiState> {
  const ctx = await requirePermission("ai.settings");

  // Indexar recorre el temario entero de la academia. Es una tarea de fondo que
  // se lanza cuando cambia el material, no algo que tenga sentido repetir.
  const espera = await limitarAccion("iaIndexar", ctx.academy.id);
  if (espera) return { error: espera };

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

/**
 * «¿Por qué he fallado esta?»
 *
 * El momento en que un alumno más aprende es justo después de equivocarse, y es
 * justo cuando no tiene a nadie delante. Esto le da la explicación del
 * preparador si existe y la refuerza con lo que dice su temario, citándolo.
 *
 * Requisitos: la pregunta tiene que ser de un intento suyo, y el material que se
 * consulte pasa por la misma barrera de permisos que todo lo demás.
 */
export async function explainMistakeAction(
  _prev: AiState,
  formData: FormData,
): Promise<AiState> {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("ai.student")) {
    return { error: "Tu academia no tiene activado el asistente." };
  }

  const attemptId = String(formData.get("attemptId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  if (!attemptId || !questionId) return { error: "Falta la pregunta." };

  // Comparte el mismo cubo que las preguntas del tutor: las dos acaban en el
  // mismo proveedor y en la misma factura, así que separarlas daría el doble
  // de llamadas a quien alternara entre ellas.
  const espera = await limitarAccion("iaAlumno", ctx.membershipId);
  if (espera) return { error: espera };

  // El intento tiene que ser de quien lo pide. Sin esto, cualquiera podría
  // pedir la corrección de un examen ajeno.
  const intento = await ctx.db.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, studentId: true },
  });
  if (!intento || intento.studentId !== ctx.membershipId) {
    return { error: "Ese intento no es tuyo." };
  }

  const respuesta = await ctx.db.testAttemptAnswer.findFirst({
    where: { attemptId, questionId },
    select: { selectedOptionId: true },
  });
  if (!respuesta) return { error: "Esa pregunta no estaba en tu intento." };

  const pregunta = await ctx.db.question.findUnique({
    where: { id: questionId },
    select: {
      statement: true,
      explanation: true,
      nodeId: true,
      options: { select: { id: true, text: true, isCorrect: true } },
    },
  });
  if (!pregunta) return { error: "Esa pregunta ya no existe." };

  const correcta = pregunta.options.find((o) => o.isCorrect);
  if (!correcta) return { error: "Esta pregunta no tiene marcada la correcta." };

  const dada = respuesta.selectedOptionId
    ? (pregunta.options.find((o) => o.id === respuesta.selectedOptionId)?.text ?? null)
    : null;

  const fragmentos = await recuperarFragmentos({
    academyId: ctx.academy.id,
    membershipId: ctx.membershipId,
    esPersonal: false,
    pregunta: `${pregunta.statement} ${correcta.text}`,
    nodeId: pregunta.nodeId,
    limite: 4,
  });

  const explicacion = explicarFallo({
    enunciado: pregunta.statement,
    respuestaDada: dada,
    respuestaCorrecta: correcta.text,
    explicacionProfesor: pregunta.explanation,
    fragmentos,
  });

  return {
    respuesta: explicacion.texto,
    motor: "local",
    confianza: explicacion.confianza,
    fuentes: explicacion.citas.map((numero) => {
      const f = fragmentos[numero - 1];
      return {
        numero,
        titulo: f?.nodeLabel ?? f?.sourceTitle ?? "Material de la academia",
        localizador: f?.locator ?? null,
      };
    }),
  };
}
