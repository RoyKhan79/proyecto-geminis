import type { ContentNodeKind, SectionKind } from "@/generated/prisma/enums";
import type { TenantClient } from "@/lib/db/tenant";
import { slugify } from "@/lib/utils";

/**
 * Servicio del árbol de contenido.
 *
 * Centraliza el cálculo de `path`, `depth` y `position`, que son los tres
 * campos que hacen que el árbol se pueda consultar y ordenar de forma barata.
 * Ninguna otra parte del código debe escribirlos a mano: si se desincronizan,
 * los permisos por rama dejan de funcionar.
 *
 * Formato de `path`: cadena de ancestros con barras, de la raíz al padre.
 *   nodo raíz            → "/"
 *   hijo de R            → "/R/"
 *   nieto (hijo de C)    → "/R/C/"
 * El prefijo que cubre a un nodo y a toda su descendencia es `path + id + "/"`.
 */

export type CreateNodeInput = {
  editionId: string;
  parentId?: string | null;
  kind: ContentNodeKind;
  sectionKind?: SectionKind | null;
  label: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  status?: "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  isFree?: boolean;
  visibleToStudents?: boolean;
  downloadable?: boolean | null;
  aiEnabled?: boolean | null;
  usableForTests?: boolean | null;
  watermark?: boolean | null;
  trackLegislation?: boolean | null;
  estimatedMinutes?: number | null;
  position?: number;
};

/**
 * Crea un nodo del árbol calculando su ruta, su profundidad y su posición.
 *
 * @param db Cliente acotado a la academia.
 * @param input Qué se crea y de quién cuelga.
 * @returns El nodo creado.
 * @throws {Error} Si el padre no existe o es de otra convocatoria.
 * @remarks **Ninguna otra parte del código debe escribir `path`, `depth` o
 *   `position` a mano.** Los permisos por rama se resuelven con esa ruta, así
 *   que si se desincronizan dejan de funcionar, y en silencio.
 */
export async function createContentNode(db: TenantClient, input: CreateNodeInput) {
  let path = "/";
  let depth = 0;

  if (input.parentId) {
    const parent = await db.contentNode.findUnique({
      where: { id: input.parentId },
      select: { id: true, path: true, depth: true, editionId: true },
    });
    if (!parent) throw new Error("El elemento padre no existe en esta academia.");
    if (parent.editionId !== input.editionId) {
      throw new Error("No se puede colgar un contenido de otra convocatoria.");
    }
    path = `${parent.path}${parent.id}/`;
    depth = parent.depth + 1;
  }

  const position =
    input.position ??
    (await db.contentNode.count({
      where: { editionId: input.editionId, parentId: input.parentId ?? null },
    }));

  const slug = await uniqueSlug(
    db,
    input.editionId,
    input.parentId ?? null,
    input.slug ?? slugify(input.label),
  );

  return db.contentNode.create({
    data: {
      editionId: input.editionId,
      parentId: input.parentId ?? null,
      path,
      depth,
      position,
      kind: input.kind,
      sectionKind: input.sectionKind ?? null,
      label: input.label,
      slug,
      description: input.description ?? null,
      icon: input.icon ?? null,
      status: input.status ?? "DRAFT",
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      isFree: input.isFree ?? false,
      visibleToStudents: input.visibleToStudents ?? true,
      downloadable: input.downloadable ?? null,
      aiEnabled: input.aiEnabled ?? null,
      usableForTests: input.usableForTests ?? null,
      watermark: input.watermark ?? null,
      trackLegislation: input.trackLegislation ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
    },
  });
}

async function uniqueSlug(
  db: TenantClient,
  editionId: string,
  parentId: string | null,
  base: string,
) {
  const raw = base || "elemento";
  let candidate = raw;
  let n = 2;

  // Los hermanos comparten espacio de nombres; con 50 intentos vamos sobrados
  // y evitamos un bucle infinito si algo va mal.
  while (n < 50) {
    const existing = await db.contentNode.findFirst({
      where: { editionId, parentId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${raw}-${n}`;
    n += 1;
  }
  return `${raw}-${Date.now()}`;
}

/** Prefijo que cubre al nodo y a toda su descendencia. */
export function subtreePrefix(node: { id: string; path: string }) {
  return `${node.path}${node.id}/`;
}

/** Recupera una rama completa, ordenada para pintarla como árbol. */
export async function loadSubtree(
  db: TenantClient,
  node: { id: string; path: string },
) {
  return db.contentNode.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: node.id }, { path: { startsWith: subtreePrefix(node) } }],
    },
    orderBy: [{ depth: "asc" }, { position: "asc" }],
  });
}

/** Secciones raíz de una convocatoria, en orden. */
export async function loadSections(db: TenantClient, editionId: string) {
  return db.contentNode.findMany({
    where: { editionId, parentId: null, deletedAt: null },
    orderBy: { position: "asc" },
  });
}
