"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";

/**
 * NORMATIVA Y ALERTAS DE CAMBIO LEGISLATIVO
 *
 * El módulo que puede diferenciar de verdad a Proyecto Geminis. La pregunta que
 * responde es la que quita el sueño a un preparador:
 *
 *   «Ha cambiado el artículo 24 de la Ley 39/2015. ¿Qué temas tengo que
 *    revisar y cuántas preguntas de mi banco han quedado mal?»
 *
 * Sin esto, esa respuesta es una tarde entera buscando a mano.
 *
 * ADR-0013: Geminis NUNCA reescribe el contenido de la academia. Calcula el
 * impacto, marca lo que puede estar afectado y espera la decisión del profesor.
 */

export type LegState = { error?: string; ok?: string } | undefined;

const normaSchema = z.object({
  reference: z.string().trim().min(3, "Indica la referencia, p. ej. «Ley 39/2015»."),
  title: z.string().trim().min(5, "Escribe el título de la norma."),
  scope: z.enum(["EUROPEAN", "STATE", "REGIONAL", "LOCAL", "OTHER"]),
  officialId: z.string().trim().max(60).optional(),
  officialUrl: z.string().trim().url("La dirección no es válida.").optional().or(z.literal("")),
});

export async function createLegislationAction(
  _prev: LegState,
  formData: FormData,
): Promise<LegState> {
  const ctx = await requirePermission("legislation.write");
  const parsed = normaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const yaExiste = await ctx.db.legislation.findFirst({
    where: { reference: data.reference, deletedAt: null },
    select: { id: true },
  });
  if (yaExiste) return { error: "Ya tienes registrada esa norma." };

  const norma = await ctx.db.legislation.create({
    data: {
      reference: data.reference,
      title: data.title,
      scope: data.scope,
      officialId: data.officialId || null,
      officialUrl: data.officialUrl || null,
      status: "IN_FORCE",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "legislation.create",
    entityType: "Legislation",
    entityId: norma.id,
    changes: { referencia: data.reference },
  });

  revalidatePath("/gestion/normativa");
  return { ok: "Norma registrada." };
}

const articuloSchema = z.object({
  legislationId: z.string().min(1),
  number: z.string().trim().min(1, "Indica el artículo."),
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().max(20000).optional(),
});

export async function createArticleAction(
  _prev: LegState,
  formData: FormData,
): Promise<LegState> {
  const ctx = await requirePermission("legislation.write");
  const parsed = articuloSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const norma = await ctx.db.legislation.findUnique({
    where: { id: parsed.data.legislationId },
    select: { id: true },
  });
  if (!norma) return { error: "Esa norma no existe." };

  const existe = await ctx.db.legislationArticle.findFirst({
    where: { legislationId: norma.id, number: parsed.data.number },
    select: { id: true },
  });
  if (existe) return { error: "Ese artículo ya está registrado." };

  await ctx.db.legislationArticle.create({
    data: {
      legislationId: norma.id,
      number: parsed.data.number,
      title: parsed.data.title || null,
      text: parsed.data.text || null,
    },
  });

  revalidatePath("/gestion/normativa");
  return { ok: "Artículo añadido." };
}

/** Enlaza un artículo con un tema o con una pregunta. */
export async function linkArticleAction(formData: FormData) {
  const ctx = await requirePermission("legislation.write");

  const articleId = String(formData.get("articleId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "") || null;
  const questionId = String(formData.get("questionId") ?? "") || null;

  if (!articleId || (!nodeId && !questionId)) return;

  const articulo = await ctx.db.legislationArticle.findUnique({
    where: { id: articleId },
    select: { id: true },
  });
  if (!articulo) throw new Error("Ese artículo no existe.");

  const yaEnlazado = await ctx.db.contentLegislationLink.findFirst({
    where: { articleId, nodeId, questionId },
    select: { id: true },
  });
  if (yaEnlazado) return;

  await ctx.db.contentLegislationLink.create({
    data: { articleId, nodeId, questionId, origin: "MANUAL" },
  });

  revalidatePath("/gestion/normativa");
}

const cambioSchema = z.object({
  legislationId: z.string().min(1),
  articleId: z.string().optional(),
  changeType: z.enum(["CREATED", "AMENDED", "REPEALED", "CORRECTED"]),
  title: z.string().trim().min(5, "Describe el cambio."),
  description: z.string().trim().max(4000).optional(),
  previousText: z.string().trim().max(20000).optional(),
  newText: z.string().trim().max(20000).optional(),
});

/**
 * Registrar un cambio normativo y CALCULAR SU IMPACTO.
 *
 * Aquí está el valor: al guardar el cambio, se busca qué temas y qué preguntas
 * dependen de ese artículo y se marcan las preguntas como «posiblemente
 * desactualizadas». No se toca su contenido: solo se avisa.
 */
export async function registerChangeAction(
  _prev: LegState,
  formData: FormData,
): Promise<LegState> {
  const ctx = await requirePermission("legislation.review");
  const parsed = cambioSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const norma = await ctx.db.legislation.findUnique({
    where: { id: data.legislationId },
    select: { id: true, reference: true },
  });
  if (!norma) return { error: "Esa norma no existe." };

  // Impacto: qué contenido depende del artículo que ha cambiado.
  const enlaces = await ctx.db.contentLegislationLink.findMany({
    where: data.articleId ? { articleId: data.articleId } : { article: { legislationId: norma.id } },
    select: {
      nodeId: true,
      questionId: true,
      node: { select: { id: true, label: true } },
      question: { select: { id: true, statement: true } },
    },
  });

  const temas = enlaces.filter((e) => e.node).map((e) => e.node!);
  const preguntas = enlaces.filter((e) => e.question).map((e) => e.question!);

  const alerta = await ctx.db.legislationChangeAlert.create({
    data: {
      legislationId: norma.id,
      articleId: data.articleId || null,
      changeType: data.changeType,
      status: "OPEN",
      title: data.title,
      description: data.description || null,
      previousText: data.previousText || null,
      newText: data.newText || null,
      impact: {
        temas: temas.map((t) => ({ id: t.id, label: t.label })),
        preguntas: preguntas.map((p) => ({
          id: p.id,
          enunciado: p.statement.slice(0, 120),
        })),
        totalTemas: temas.length,
        totalPreguntas: preguntas.length,
      },
    },
  });

  // Las preguntas se marcan, NO se cambian. Quien decide es el preparador.
  if (preguntas.length > 0) {
    await ctx.db.question.updateMany({
      where: { id: { in: preguntas.map((p) => p.id) }, status: "PUBLISHED" },
      data: {
        status: "POSSIBLY_OUTDATED",
        outdatedReason: `Cambio en ${norma.reference}: ${data.title}`,
        outdatedAt: new Date(),
      },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "legislation.change",
    entityType: "LegislationChangeAlert",
    entityId: alerta.id,
    changes: {
      norma: norma.reference,
      temasAfectados: temas.length,
      preguntasMarcadas: preguntas.length,
    },
  });

  revalidatePath("/gestion/normativa");
  revalidatePath("/gestion/tests");

  return {
    ok:
      preguntas.length + temas.length === 0
        ? "Cambio registrado. No hay contenido enlazado a ese artículo todavía."
        : `Cambio registrado: ${temas.length} temas afectados y ${preguntas.length} preguntas marcadas para revisar.`,
  };
}

/** Resolver una alerta: se ha revisado y se da por atendida. */
export async function resolveAlertAction(formData: FormData) {
  const ctx = await requirePermission("legislation.review");
  const alertId = String(formData.get("alertId") ?? "");
  const accion = String(formData.get("accion") ?? "");

  const alerta = await ctx.db.legislationChangeAlert.findUnique({
    where: { id: alertId },
    select: { id: true, impact: true },
  });
  if (!alerta) throw new Error("Esa alerta no existe.");

  await ctx.db.legislationChangeAlert.update({
    where: { id: alertId },
    data: {
      status: accion === "descartar" ? "DISMISSED" : "APPLIED",
      reviewedById: ctx.membershipId,
      reviewedAt: new Date(),
      resolution: accion === "descartar" ? "No afecta al contenido." : "Revisado.",
    },
  });

  // Al descartar, las preguntas vuelven a estar publicadas: era una falsa alarma.
  if (accion === "descartar") {
    const impacto = alerta.impact as { preguntas?: { id: string }[] } | null;
    const ids = impacto?.preguntas?.map((p) => p.id) ?? [];
    if (ids.length > 0) {
      await ctx.db.question.updateMany({
        where: { id: { in: ids }, status: "POSSIBLY_OUTDATED" },
        data: { status: "PUBLISHED", outdatedReason: null, outdatedAt: null },
      });
    }
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "legislation.alert.resolve",
    entityType: "LegislationChangeAlert",
    entityId: alertId,
    changes: { accion },
  });

  revalidatePath("/gestion/normativa");
  revalidatePath("/gestion/tests");
}

/**
 * Detección automática de referencias legales en el contenido.
 *
 * Busca patrones del tipo «Ley 39/2015», «artículo 24», «RD 5/2015» en los
 * enunciados de las preguntas y propone el enlace. Es una ayuda, no una
 * certeza: los enlaces detectados se marcan como DETECTED y el profesor los
 * confirma.
 */
export async function detectReferencesAction(formData: FormData) {
  const ctx = await requirePermission("legislation.write");
  const legislationId = String(formData.get("legislationId") ?? "");

  const norma = await ctx.db.legislation.findUnique({
    where: { id: legislationId },
    select: {
      id: true,
      reference: true,
      articles: { select: { id: true, number: true } },
    },
  });
  if (!norma) throw new Error("Esa norma no existe.");

  const preguntas = await ctx.db.question.findMany({
    where: { deletedAt: null },
    select: { id: true, statement: true, explanation: true },
  });

  const referenciaNormalizada = normaliza(norma.reference);
  let enlazadas = 0;

  for (const pregunta of preguntas) {
    const texto = normaliza(
      `${pregunta.statement} ${pregunta.explanation ?? ""}`,
    );

    // Dos formas de citar, ambas habituales: nombrar la norma o solo el
    // artículo. Si solo se nombra la norma, se enlaza con el artículo cuyo
    // número aparezca; si no aparece ninguno, no se inventa el enlace.
    const porArticulo = norma.articles.find((a) =>
      new RegExp(`articulo\\s+${escapar(a.number)}(\\D|$)`).test(texto),
    );
    const articulo =
      porArticulo ??
      (texto.includes(referenciaNormalizada) ? norma.articles[0] : undefined);

    if (!articulo) continue;

    const existe = await ctx.db.contentLegislationLink.findFirst({
      where: { articleId: articulo.id, questionId: pregunta.id },
      select: { id: true },
    });
    if (existe) continue;

    await ctx.db.contentLegislationLink.create({
      data: {
        articleId: articulo.id,
        questionId: pregunta.id,
        origin: "DETECTED",
        confidence: 0.7,
        excerpt: pregunta.statement.slice(0, 200),
      },
    });
    enlazadas += 1;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "legislation.detect",
    entityType: "Legislation",
    entityId: norma.id,
    changes: { enlazadas },
  });

  revalidatePath("/gestion/normativa");
}

function normaliza(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
