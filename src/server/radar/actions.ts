"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { slugify } from "@/lib/utils";
import { createContentNode } from "@/server/content/tree";
import { DESCARTES_HABITUALES } from "./boe";

/**
 * Lo que una acción devuelve a la pantalla.
 *
 * `undefined` es el estado inicial, antes de que nadie haya enviado nada. El
 * error viaja como dato y no como excepción a propósito: una excepción en una
 * acción de servidor llega al navegador como «algo ha fallado», y aquí hace
 * falta poder decir qué exactamente y volver a pintar el formulario con lo que
 * la persona había escrito.
 */
export type RadarState = { error?: string; ok?: string } | undefined;

const vigilanciaSchema = z.object({
  name: z.string().trim().min(3, "Ponle un nombre a la vigilancia."),
  keywords: z.string().trim().min(2, "Escribe al menos una palabra clave."),
  excludeKeywords: z.string().trim().optional(),
  notifyEmails: z.string().trim().optional(),
  oppositionId: z.string().trim().optional(),
  requireCallPhrase: z.string().optional(),
  fuentes: z.string().trim().optional(),
});

function listaDeTexto(valor?: string): string[] {
  if (!valor) return [];
  return valor
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/**
 * Empieza a vigilar una oposición en el BOE.
 *
 * @returns Confirmación, o el motivo si los datos no valen.
 * @remarks No busca nada ahora: la vigilancia la hace `npm run radar` cada
 *   mañana. Aquí solo se apunta qué hay que mirar.
 */
export async function createWatchAction(
  _prev: RadarState,
  formData: FormData,
): Promise<RadarState> {
  const ctx = await requirePermission("settings.write");
  const parsed = vigilanciaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const correos = listaDeTexto(data.notifyEmails).filter((c) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c),
  );

  const vigilancia = await ctx.db.oppositionWatch.create({
    data: {
      name: data.name,
      keywords: listaDeTexto(data.keywords),
      excludeKeywords: data.excludeKeywords
        ? listaDeTexto(data.excludeKeywords)
        : DESCARTES_HABITUALES,
      notifyEmails: correos,
      oppositionId: data.oppositionId || null,
      requireCallPhrase: data.requireCallPhrase !== "off",
      sources: data.fuentes === "TODAS" ? [] : ["BOE"],
      isActive: true,
      createdById: ctx.membershipId,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "radar.watch.create",
    entityType: "OppositionWatch",
    entityId: vigilancia.id,
    changes: { nombre: data.name, claves: vigilancia.keywords.length },
  });

  revalidatePath("/gestion/convocatorias");
  return { ok: "Vigilancia creada. Se aplicará en la próxima pasada del radar." };
}

/**
 * Pausa o reanuda una vigilancia.
 *
 * Pausar en lugar de borrar conserva lo ya encontrado, que es lo que se quiere
 * cuando una convocatoria se resuelve y al año siguiente vuelve.
 */
export async function toggleWatchAction(formData: FormData) {
  const ctx = await requirePermission("settings.write");
  const watchId = String(formData.get("watchId") ?? "");
  const activar = String(formData.get("activar") ?? "") === "1";

  await ctx.db.oppositionWatch.update({
    where: { id: watchId },
    data: { isActive: activar },
  });

  revalidatePath("/gestion/convocatorias");
}

/**
 * Deja de vigilar una oposición, esta vez de verdad.
 *
 * @remarks Se lleva por delante los avisos asociados. Para dejar de recibirlos
 *   sin perder el histórico está {@link toggleWatchAction}.
 */
export async function deleteWatchAction(formData: FormData) {
  const ctx = await requirePermission("settings.write");
  const watchId = String(formData.get("watchId") ?? "");

  await ctx.db.oppositionWatch.delete({ where: { id: watchId } });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "radar.watch.delete",
    entityType: "OppositionWatch",
    entityId: watchId,
  });

  revalidatePath("/gestion/convocatorias");
}

/**
 * Aceptar una convocatoria detectada.
 *
 * Si la vigilancia apuntaba a una oposición existente, se le añade una
 * convocatoria nueva. Si no, se crea la oposición entera con sus apartados,
 * lista para subir temario. Es el atajo que convierte un aviso del BOE en
 * trabajo hecho.
 */
export async function acceptCallAction(formData: FormData) {
  const ctx = await requirePermission("oppositions.write");
  const callId = String(formData.get("callId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  const convocatoria = await ctx.db.officialCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      watch: { select: { oppositionId: true, name: true } },
    },
  });
  if (!convocatoria) throw new Error("Esa convocatoria no existe.");
  if (convocatoria.status === "ACCEPTED") return;

  const nombreOposicion =
    nombre || convocatoria.watch?.name || convocatoria.title.slice(0, 80);

  let oppositionId = convocatoria.watch?.oppositionId ?? null;

  if (!oppositionId) {
    const slug = await slugLibre(ctx.db, slugify(nombreOposicion));
    const oposicion = await ctx.db.opposition.create({
      data: {
        name: nombreOposicion,
        slug,
        status: "ACTIVE",
        description: `Creada desde una convocatoria detectada en el BOE el ${convocatoria.publishedAt.toLocaleDateString("es-ES")}.`,
      },
    });
    oppositionId = oposicion.id;
  }

  const año = convocatoria.publishedAt.getFullYear();
  const edicion = await ctx.db.oppositionEdition.create({
    data: {
      oppositionId,
      name: `Convocatoria ${año}`,
      year: año,
      status: "OPEN",
      isDefault: true,
    },
  });

  // Apartados iniciales, con nombres corrientes que la academia cambiará.
  for (const [position, seccion] of [
    { label: "Temario", sectionKind: "SYLLABUS" as const },
    { label: "Clases", sectionKind: "CLASSES" as const },
    { label: "Tests y simulacros", sectionKind: "TESTS" as const },
    { label: "Normativa", sectionKind: "LEGISLATION" as const },
  ].entries()) {
    await createContentNode(ctx.db, {
      editionId: edicion.id,
      kind: "SECTION",
      sectionKind: seccion.sectionKind,
      label: seccion.label,
      status: "PUBLISHED",
      position,
    });
  }

  await ctx.db.officialCall.update({
    where: { id: callId },
    data: {
      status: "ACCEPTED",
      oppositionId,
      editionId: edicion.id,
      reviewedById: ctx.membershipId,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "radar.call.accept",
    entityType: "OfficialCall",
    entityId: callId,
    changes: { oposicion: nombreOposicion, edicion: edicion.name },
  });

  revalidatePath("/gestion/convocatorias");
  revalidatePath("/gestion/oposiciones");
}

/**
 * Descarta una convocatoria encontrada.
 *
 * El radar acierta mucho pero no siempre: descartar es lo que dice «esta no era
 * la mía» sin que vuelva a aparecer mañana.
 */
export async function dismissCallAction(formData: FormData) {
  const ctx = await requirePermission("oppositions.write");
  const callId = String(formData.get("callId") ?? "");

  await ctx.db.officialCall.update({
    where: { id: callId },
    data: {
      status: "DISMISSED",
      reviewedById: ctx.membershipId,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "radar.call.dismiss",
    entityType: "OfficialCall",
    entityId: callId,
  });

  revalidatePath("/gestion/convocatorias");
}

async function slugLibre(
  db: Awaited<ReturnType<typeof requirePermission>>["db"],
  base: string,
) {
  let candidato = base || "oposicion";
  let n = 2;
  while (n < 50) {
    const existe = await db.opposition.findFirst({
      where: { slug: candidato },
      select: { id: true },
    });
    if (!existe) return candidato;
    candidato = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now()}`;
}
