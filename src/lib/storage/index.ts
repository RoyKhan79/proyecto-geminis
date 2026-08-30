import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * ALMACENAMIENTO DE ARCHIVOS
 *
 * Interfaz única con dos implementaciones: disco local para desarrollo y
 * S3-compatible para producción. El resto de la aplicación no sabe cuál está
 * usando, así que cambiar de proveedor no toca ni una pantalla.
 *
 * Norma que no se negocia: los archivos NUNCA se sirven por una URL pública
 * permanente. Se sirven a través de una ruta del servidor que comprueba antes
 * quién pide qué (ver src/app/api/archivos/[fileId]/route.ts).
 */

export type StoredObject = {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
};

export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  getStream(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * SEGUNDA BARRERA PARA LOS ARCHIVOS
 *
 * La base de datos tiene dos barreras: la guardia de la aplicación y las
 * políticas de PostgreSQL. Los archivos tenían una sola —la comprobación de la
 * ruta que los sirve—, y eso quedaba anotado como riesgo abierto en la
 * auditoría: un fallo ahí no lo tapaba nada por debajo.
 *
 * Esto lo cierra aprovechando algo que ya era cierto: **la clave de todo objeto
 * empieza por su academia**. Antes de devolver un solo byte se comprueba que la
 * clave corresponde a quien lo pide. Es una comprobación independiente de la
 * consulta a la base: si algún día una consulta devolviera el archivo de otra
 * academia, aquí se para igualmente.
 *
 * No sustituye a la comprobación de permisos —eso sigue en la ruta—, sino que
 * la respalda, que es lo que significa tener dos barreras.
 */
export class ArchivoDeOtraAcademiaError extends Error {
  constructor(clave: string, academyId: string) {
    super(
      `El archivo «${clave}» no pertenece a la academia ${academyId}. No se sirve.`,
    );
    this.name = "ArchivoDeOtraAcademiaError";
  }
}

export function claveEsDeLaAcademia(clave: string, academyId: string): boolean {
  return clave.startsWith(`academies/${academyId}/`);
}

/**
 * Abre un archivo comprobando antes que es de esa academia.
 *
 * Es la única función que debería usarse para leer un archivo desde una
 * petición. `getStream` a secas queda para migraciones y scripts, donde no hay
 * academia con la que comparar.
 */
export async function abrirParaAcademia(
  clave: string,
  academyId: string,
): Promise<NodeJS.ReadableStream> {
  if (!claveEsDeLaAcademia(clave, academyId)) {
    throw new ArchivoDeOtraAcademiaError(clave, academyId);
  }
  return storage().getStream(clave);
}

/** Ruta del objeto. Siempre empieza por la academia: aísla también en disco. */
export function buildStorageKey(
  academyId: string,
  originalName: string,
): string {
  const safe = originalName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return `academies/${academyId}/${randomUUID()}/${safe || "archivo"}`;
}

// ── Disco local ──────────────────────────────────────────────────────────────

class LocalDriver implements StorageDriver {
  readonly name = "local";
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(process.cwd(), root);
  }

  private resolve(key: string) {
    const destino = path.resolve(this.root, key);
    // Defensa contra rutas con "..": nunca se sale del directorio raíz.
    if (!destino.startsWith(this.root)) {
      throw new Error("Ruta de archivo no válida.");
    }
    return destino;
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const destino = this.resolve(key);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, data);
    return {
      key,
      sizeBytes: data.byteLength,
      checksumSha256: createHash("sha256").update(data).digest("hex"),
    };
  }

  async getStream(key: string) {
    return createReadStream(this.resolve(key));
  }

  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => {});
  }

  async exists(key: string) {
    return stat(this.resolve(key))
      .then(() => true)
      .catch(() => false);
  }
}

// ── S3 compatible ────────────────────────────────────────────────────────────

/**
 * Implementación S3. Se carga de forma perezosa para que el SDK no entre en el
 * paquete de quien usa disco local. Se activará al configurar STORAGE_DRIVER=s3.
 */
class S3Driver implements StorageDriver {
  readonly name = "s3";

  async put(): Promise<StoredObject> {
    throw new Error(
      "El almacenamiento en S3 se activa en la fase de despliegue. Configura STORAGE_DRIVER=local mientras tanto.",
    );
  }
  async getStream(): Promise<NodeJS.ReadableStream> {
    throw new Error("El almacenamiento en S3 todavía no está conectado.");
  }
  async delete() {}
  async exists() {
    return false;
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (!driver) {
    driver =
      env.STORAGE_DRIVER === "s3"
        ? new S3Driver()
        : new LocalDriver(env.STORAGE_LOCAL_DIR);
  }
  return driver;
}

/** Convierte un stream de Node en el ReadableStream que espera una Response. */
export function toWebStream(stream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(stream as Readable) as ReadableStream;
}

// ── Reglas de subida ─────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Tipos admitidos. Lista blanca a propósito: aceptar cualquier cosa es la vía
 * habitual para acabar sirviendo un HTML con scripts desde tu propio dominio.
 */
export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "Imagen",
  "image/jpeg": "Imagen",
  "image/webp": "Imagen",
  "image/gif": "Imagen",
  "video/mp4": "Vídeo",
  "video/webm": "Vídeo",
  "audio/mpeg": "Audio",
  "audio/mp4": "Audio",
  "audio/wav": "Audio",
  "application/msword": "Documento",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documento",
  "application/vnd.ms-powerpoint": "Presentación",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "Presentación",
  "application/vnd.ms-excel": "Hoja de cálculo",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Hoja de cálculo",
  "text/plain": "Texto",
};

export function isAllowedMime(mime: string) {
  return mime in ALLOWED_MIME;
}

export function resourceTypeForMime(mime: string) {
  if (mime === "application/pdf") return "PDF" as const;
  if (mime.startsWith("image/")) return "IMAGE" as const;
  if (mime.startsWith("video/")) return "VIDEO" as const;
  if (mime.startsWith("audio/")) return "AUDIO" as const;
  return "DOWNLOADABLE" as const;
}
