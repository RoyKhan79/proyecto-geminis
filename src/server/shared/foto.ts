import { recordAudit } from "@/lib/audit";
import { prismaBase } from "@/lib/db/client";
import type { TenantClient } from "@/lib/db/tenant";
import { buildStorageKey, storage } from "@/lib/storage";

/**
 * LA FOTO DE UNA PERSONA
 * ──────────────────────
 * El alumnado y el profesorado son la misma tabla —`Membership`— y su foto se
 * guarda en el mismo sitio, así que el trabajo es idéntico: comprobar el
 * archivo, guardarlo en el almacén de la academia y dejar la dirección en el
 * usuario.
 *
 * Lo único que cambia entre los dos es el PERMISO que hace falta
 * (`students.write` o `teachers.write`) y qué se anota en la auditoría. Eso lo
 * decide quien llama, que es quien tiene que saberlo: aquí no se comprueba
 * ningún permiso a propósito, para que no parezca que esto protege algo. Estas
 * funciones dan por hecho que la puerta ya se pasó.
 *
 * @remarks La foto se guarda como cualquier otro archivo de la academia —en su
 *   carpeta, con su clave— y se sirve por la ruta protegida. **No hay URL
 *   pública de la cara de nadie**: es un dato personal, no un icono.
 */

/** Tope por foto. */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

/**
 * Formatos admitidos.
 *
 * Lista blanca. El navegador ya reduce la foto a JPEG antes de mandarla, así
 * que en la práctica siempre llega ese; los otros dos están para quien tenga el
 * JavaScript desactivado o suba desde una herramienta.
 */
export const FOTOS_ADMITIDAS = ["image/jpeg", "image/png", "image/webp"];

/** Por qué no se acepta este archivo, o `null` si vale. */
export function motivoParaRechazarFoto(foto: unknown): string | null {
  if (!(foto instanceof File) || foto.size === 0) return "Elige una foto.";
  if (foto.size > MAX_FOTO_BYTES) {
    return "La foto no puede pasar de 5 MB. Con una de carné sobra.";
  }
  if (!FOTOS_ADMITIDAS.includes(foto.type)) {
    return "La foto tiene que ser JPEG, PNG o WebP.";
  }
  return null;
}

/**
 * Guarda la foto y la deja puesta en la persona.
 *
 * @param db El cliente de la academia, ya limitado a su tenant.
 * @param academyId La academia, para la clave del archivo y la auditoría.
 * @param membershipId A quién se le pone.
 * @param subidaPor Quién la sube, para poder responder «esto lo puso quién».
 * @param foto El archivo, ya validado con `motivoParaRechazarFoto`.
 * @returns El id de la persona, o `null` si no existe en esta academia.
 */
export async function guardarFotoDePersona(
  db: TenantClient,
  academyId: string,
  membershipId: string,
  subidaPor: string,
  foto: File,
): Promise<string | null> {
  const persona = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true },
  });
  if (!persona) return null;

  const buffer = Buffer.from(await foto.arrayBuffer());
  const key = buildStorageKey(academyId, foto.name || "foto.jpg");
  const guardado = await storage().put(key, buffer, foto.type);

  const archivo = await db.storedFile.create({
    data: {
      storageKey: guardado.key,
      storageDriver: storage().name,
      originalName: foto.name || "foto",
      mimeType: foto.type,
      sizeBytes: guardado.sizeBytes,
      checksumSha256: guardado.checksumSha256,
      uploadedById: subidaPor,
    },
  });

  // `prismaBase` y no `db`: el usuario es una entidad global —la misma persona
  // puede dar clase en dos academias— y no lleva `academyId`.
  await prismaBase.user.update({
    where: { id: persona.userId },
    data: { avatarUrl: `/api/archivos/${archivo.id}` },
  });

  return persona.id;
}

/**
 * Quita la foto.
 *
 * No borra el archivo del almacén: queda registrado quién lo subió y cuándo, y
 * un borrado inmediato impediría explicar de dónde salió una foto que alguien
 * discute. La limpieza de archivos huérfanos es tarea del mantenimiento.
 *
 * @returns El id de la persona, o `null` si no existe en esta academia.
 */
export async function quitarFotoDePersona(
  db: TenantClient,
  membershipId: string,
): Promise<string | null> {
  const persona = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true },
  });
  if (!persona) return null;

  await prismaBase.user.update({
    where: { id: persona.userId },
    data: { avatarUrl: null },
  });

  return persona.id;
}

/** Deja constancia en la auditoría de que se tocó la foto de alguien. */
export async function anotarCambioDeFoto(
  academyId: string,
  actorId: string,
  membershipId: string,
  accion: string,
) {
  await recordAudit({
    academyId,
    actorId,
    action: accion,
    entityType: "Membership",
    entityId: membershipId,
  });
}
