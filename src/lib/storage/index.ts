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

/**
 * Lo que devuelve el almacén al guardar un archivo.
 *
 * El `checksumSha256` no es decorativo: es lo que permite detectar que un
 * archivo se ha corrompido en el almacén y lo que evita subir dos veces el
 * mismo documento.
 */
export type StoredObject = {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
};

/**
 * Lo que tiene que saber hacer un almacén de archivos.
 *
 * Dos implementaciones: disco local en desarrollo y S3 en producción. El resto
 * de la aplicación no sabe cuál está usando, así que cambiar de proveedor no
 * toca ni una pantalla.
 */
export interface StorageDriver {
  /** Nombre corto del almacén; se guarda en cada archivo por si un día conviven. */
  readonly name: string;

  /**
   * Guarda un archivo.
   *
   * @param key La clave, construida siempre con {@link buildStorageKey}.
   * @param data El contenido.
   * @param contentType Su tipo MIME.
   * @returns La clave definitiva, el tamaño y el resumen SHA-256.
   */
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;

  /**
   * Abre un archivo para servirlo.
   *
   * **No comprueba de quién es.** Desde una petición hay que usar
   * {@link abrirParaAcademia}, que sí lo hace; esto queda para migraciones y
   * scripts, donde no hay academia con la que comparar.
   *
   * @param key La clave del objeto.
   * @returns Un flujo de bytes, para servir sin cargarlo entero en memoria.
   */
  getStream(key: string): Promise<NodeJS.ReadableStream>;

  /**
   * Borra un archivo del almacén, de verdad y para siempre.
   *
   * @param key La clave del objeto.
   */
  delete(key: string): Promise<void>;

  /**
   * ¿Sigue estando?
   *
   * @param key La clave del objeto.
   * @returns `false` si ya no está. Se comprueba antes de servir para poder
   *   responder «ya no está disponible» en lugar de cortar la descarga a
   *   mitad, que es lo que ve el alumno si el archivo desapareció del almacén.
   */
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

/**
 * ¿Esta clave pertenece a esta academia?
 *
 * @param clave La clave del objeto, tal como está guardada en `StoredFile`.
 * @param academyId La academia de la sesión.
 * @returns `true` solo si la clave empieza exactamente por
 *   `academies/<academyId>/`. La barra final es lo que importa: sin ella, una
 *   academia cuyo identificador fuera prefijo de otro abriría sus archivos.
 *   Con UUID de longitud fija no puede pasar hoy, pero es el error clásico de
 *   comparar prefijos y queda cerrado por escrito.
 */
export function claveEsDeLaAcademia(clave: string, academyId: string): boolean {
  return clave.startsWith(`academies/${academyId}/`);
}

/**
 * Abre un archivo comprobando antes que es de esa academia.
 *
 * Es la única función que debería usarse para leer un archivo desde una
 * petición. `storage().getStream()` a secas queda para migraciones y scripts,
 * donde no hay academia con la que comparar.
 *
 * @param clave Clave del objeto en el almacén.
 * @param academyId Academia de quien lo pide.
 * @returns El flujo de bytes, listo para servir.
 * @throws {ArchivoDeOtraAcademiaError} Si la clave no es de esa academia. Se
 *   lanza **antes** de tocar el almacén: si llegara a abrirlo y fallara
 *   después, los bytes ya habrían salido del disco.
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
/**
 * Construye la clave con la que se guarda un archivo.
 *
 * @param academyId Va delante de todo, y es lo que hace posible la segunda
 *   barrera de {@link claveEsDeLaAcademia}.
 * @param originalName Nombre que traía el archivo. Se limpia de acentos y de
 *   todo lo que no sea letra, número, punto o guion, y se recorta a 80
 *   caracteres.
 * @returns Algo como `academies/<uuid>/<uuid>/tema-12.pdf`. El UUID del medio
 *   evita que dos archivos con el mismo nombre se pisen, sin tener que
 *   comprobar antes si existe.
 */
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

/**
 * El almacén configurado, creado una sola vez.
 *
 * @returns Disco local en desarrollo, S3 en producción, según
 *   `STORAGE_DRIVER`. Quien lo use no sabe cuál es: cambiar de proveedor no
 *   toca ninguna pantalla.
 */
export function storage(): StorageDriver {
  if (!driver) {
    driver =
      env.STORAGE_DRIVER === "s3"
        ? new S3Driver()
        : new LocalDriver(env.STORAGE_LOCAL_DIR);
  }
  return driver;
}

/**
 * Convierte un flujo de Node en el que espera una `Response`.
 *
 * @param stream El flujo del almacén.
 * @returns El mismo flujo en el formato de la Web. Se sirve en trozos, sin
 *   cargar el archivo entero en memoria: un temario de 200 MB tumbaría el
 *   servidor si se leyera de golpe.
 */
export function toWebStream(stream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(stream as Readable) as ReadableStream;
}

// ── Reglas de subida ─────────────────────────────────────────────────────────

/**
 * Tamaño máximo por archivo: 32 MB.
 *
 * Decía 200 MB y era mentira. Todas las subidas de este proyecto van por Server
 * Actions, y Next corta el cuerpo de una Server Action mucho antes: por defecto
 * en 1 MB. O sea que esta constante autorizaba doscientos megas de un archivo
 * que jamás llegaba a la función, y lo que veía el usuario no era este mensaje
 * sino una pantalla de error del framework.
 *
 * Ahora coincide con `serverActions.bodySizeLimit` de `next.config.ts`, que es
 * quien manda de verdad. **Si se cambia uno hay que cambiar el otro**: no se
 * puede leer desde aquí porque la configuración de Next no se importa en el
 * código de servidor.
 *
 * 32 y no 200 porque el cuerpo se carga entero en memoria antes de llegar aquí:
 * el número son megas de RAM por subida simultánea, no una promesa gratis. Da
 * de sobra para un tema escaneado. Para vídeo hace falta una ruta que reciba en
 * flujo, que no existe todavía.
 */
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

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

/**
 * ¿Se admite este tipo de archivo?
 *
 * @param mime El tipo declarado en la subida.
 * @returns `true` si está en la lista blanca de {@link ALLOWED_MIME}.
 */
export function isAllowedMime(mime: string) {
  return mime in ALLOWED_MIME;
}

// ── Los bytes, no lo que diga el navegador ───────────────────────────────────

/**
 * Firmas conocidas de los formatos que admitimos.
 *
 * `file.type` lo pone el navegador a partir de la extensión, así que lo elige
 * quien sube el archivo: renombrar `algo.exe` a `algo.pdf` basta para que
 * llegue aquí como `application/pdf`. La lista blanca de tipos filtraba una
 * etiqueta, no un contenido.
 *
 * Esto mira los primeros bytes, que sí son el archivo. No es infalible —un
 * formato se puede envolver dentro de otro— pero cierra el caso fácil, que es
 * el que se intenta: subir algo que no es lo que dice ser para que la
 * plataforma lo sirva desde su propio dominio.
 *
 * Solo se listan los formatos con una firma estable y documentada. Los que no
 * la tienen (texto plano, algunos audios) pasan: exigirles una firma sería
 * inventarse una comprobación que no existe.
 */
const FIRMAS: Record<string, { desplazamiento: number; bytes: number[] }[]> = {
  "application/pdf": [{ desplazamiento: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  "image/png": [{ desplazamiento: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  "image/jpeg": [{ desplazamiento: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/gif": [{ desplazamiento: 0, bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  // RIFF….WEBP: la firma va partida en dos, con el tamaño en medio.
  "image/webp": [
    { desplazamiento: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { desplazamiento: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
  // Los de Office modernos son ZIP.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { desplazamiento: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    { desplazamiento: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    { desplazamiento: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  // Los de Office antiguos comparten el contenedor OLE.
  "application/msword": [
    { desplazamiento: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  ],
  "application/vnd.ms-powerpoint": [
    { desplazamiento: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  ],
  "application/vnd.ms-excel": [
    { desplazamiento: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  ],
  // ftyp en el cuarto byte: MP4 y M4A comparten contenedor.
  "video/mp4": [{ desplazamiento: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  "audio/mp4": [{ desplazamiento: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  "video/webm": [{ desplazamiento: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  "audio/wav": [{ desplazamiento: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
};

/**
 * Lo que NUNCA puede subirse, aunque venga con una etiqueta inocente.
 *
 * Se mira aparte de las firmas porque estos hay que rechazarlos aunque el tipo
 * declarado sea uno que no tenga firma conocida: un HTML declarado como
 * `text/plain` pasaría todas las comprobaciones de arriba y se serviría desde
 * el dominio de Catedria.
 */
const PROHIBIDOS: { nombre: string; prueba: (inicio: Buffer) => boolean }[] = [
  {
    nombre: "un documento HTML",
    prueba: (inicio) => {
      const texto = inicio.toString("latin1").trimStart().toLowerCase();
      return (
        texto.startsWith("<!doctype html") ||
        texto.startsWith("<html") ||
        texto.startsWith("<?xml") ||
        texto.startsWith("<svg") ||
        texto.startsWith("<script")
      );
    },
  },
  {
    nombre: "un programa de Windows",
    prueba: (inicio) => inicio[0] === 0x4d && inicio[1] === 0x5a, // MZ
  },
  {
    nombre: "un programa de Linux",
    prueba: (inicio) =>
      inicio[0] === 0x7f && inicio[1] === 0x45 && inicio[2] === 0x4c && inicio[3] === 0x46, // \x7fELF
  },
  {
    nombre: "un guion de consola",
    prueba: (inicio) => inicio[0] === 0x23 && inicio[1] === 0x21, // #!
  },
];

/**
 * ¿El contenido del archivo se corresponde con el tipo que dice tener?
 *
 * @param buffer Los bytes del archivo. Basta con los primeros, pero se acepta
 *   entero para no obligar a quien llama a recortarlo.
 * @param mime El tipo declarado, ya comprobado contra {@link ALLOWED_MIME}.
 * @returns `null` si todo cuadra, o el motivo del rechazo, escrito para poder
 *   enseñárselo a quien sube el archivo.
 *
 * @example
 * ```ts
 * const motivo = motivoParaNoAceptar(buffer, file.type);
 * if (motivo) return { error: motivo };
 * ```
 */
export function motivoParaNoAceptar(buffer: Buffer, mime: string): string | null {
  const inicio = buffer.subarray(0, 64);

  for (const { nombre, prueba } of PROHIBIDOS) {
    if (prueba(inicio)) {
      return `Ese archivo es ${nombre}, no un ${ALLOWED_MIME[mime]?.toLowerCase() ?? "documento"}. No se admite.`;
    }
  }

  const esperadas = FIRMAS[mime];
  if (!esperadas) return null; // Formato sin firma estable: se acepta.

  const cuadra = esperadas.every(({ desplazamiento, bytes }) =>
    bytes.every((b, i) => inicio[desplazamiento + i] === b),
  );

  if (!cuadra) {
    return `El contenido del archivo no se corresponde con un ${
      ALLOWED_MIME[mime]?.toLowerCase() ?? mime
    }. Comprueba que no se ha renombrado la extensión.`;
  }

  return null;
}

/**
 * Traduce un tipo MIME al tipo de recurso del temario.
 *
 * @param mime El tipo del archivo.
 * @returns `PDF`, `IMAGE`, `VIDEO`, `AUDIO` o `FILE` para todo lo demás. Es lo
 *   que decide cómo se pinta en el Campus: un PDF va al visor protegido, un
 *   vídeo al reproductor.
 */
export function resourceTypeForMime(mime: string) {
  if (mime === "application/pdf") return "PDF" as const;
  if (mime.startsWith("image/")) return "IMAGE" as const;
  if (mime.startsWith("video/")) return "VIDEO" as const;
  if (mime.startsWith("audio/")) return "AUDIO" as const;
  return "DOWNLOADABLE" as const;
}
