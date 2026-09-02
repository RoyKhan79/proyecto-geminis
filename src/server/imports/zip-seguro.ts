import { inflateRawSync } from "node:zlib";

/**
 * INSPECCIÓN DE UN XLSX ANTES DE ABRIRLO
 *
 * Un `.xlsx` es un ZIP. Y un ZIP puede ser una bomba: un archivo de dos megas
 * que al descomprimirse ocupa cuarenta gigas. No hace falta ser un experto para
 * fabricar una —hay varias colgadas en internet desde hace años— y el efecto es
 * el mismo que apagar el servidor: Node reserva la memoria, el proceso muere, y
 * con él se caen TODAS las academias, no solo la de quien subió el archivo.
 *
 * El control que había era este:
 *
 *     if (file.size > 10 MB) return { error: "…" }
 *
 * Y no sirve, porque el tamaño que importa no es el del archivo sino el de lo
 * que sale al abrirlo. Una bomba de las clásicas cabe de sobra en diez megas.
 *
 * Lo que se hace aquí, en este orden y antes de que ExcelJS vea un solo byte:
 *
 *   1. que el archivo empiece por la firma de un ZIP,
 *   2. que el directorio central se entienda y no venga en formato ZIP64,
 *   3. que no haya más entradas de las que tiene una hoja de cálculo,
 *   4. que ninguna entrada declare un tamaño desmedido,
 *   5. que el total declarado y la proporción de compresión sean razonables,
 *   6. que ningún nombre de entrada intente salirse de su carpeta,
 *   7. y **que al descomprimir de verdad no se pase del límite**.
 *
 * El paso 7 es el que cierra el asunto. Los tamaños del paso 4 y 5 los declara
 * el propio archivo, así que un atacante puede mentir en ellos; lo que no puede
 * es mentirle a `inflateRaw`. Se descomprime con un tope duro y, en cuanto se
 * pasa, se corta. El coste es descomprimir dos veces —una aquí y otra dentro de
 * ExcelJS—, y a cambio no hay ninguna ruta por la que un archivo hostil llegue
 * a reservar memoria sin control.
 */

/** Tamaño máximo del archivo tal como llega. */
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;

/**
 * Tamaño máximo de todo lo que sale al descomprimir.
 *
 * Ciento veinte megas de XML dan para una hoja con muchísimas más filas de las
 * 20.000 que se llegan a leer. Quien necesite importar más que eso tiene un
 * problema distinto y hay que hablarlo, no ampliarle el límite en silencio.
 */
export const MAX_BYTES_DESCOMPRIMIDO = 120 * 1024 * 1024;

/** Tamaño máximo de UNA entrada. La hoja grande de un XLSX cabe de sobra. */
export const MAX_BYTES_ENTRADA = 80 * 1024 * 1024;

/**
 * Número máximo de entradas.
 *
 * Un XLSX normal tiene entre diez y cincuenta: el libro, cada hoja, los estilos,
 * la tabla de cadenas compartidas, las relaciones. Doscientas es holgado. Sirve
 * contra la otra forma de bomba, la que no infla cada entrada sino que mete un
 * millón de entradas diminutas para que el analizador se ahogue contándolas.
 */
export const MAX_ENTRADAS = 200;

/**
 * Proporción máxima entre lo que ocupa descomprimido y lo que ocupa comprimido.
 *
 * El XML de una hoja de cálculo comprime muchísimo —es repetitivo— así que hay
 * que ser generoso: se han visto proporciones legítimas por encima de 200. Las
 * bombas están varios órdenes de magnitud por encima (la clásica pasa de
 * 1.000.000), así que un tope de 500 las separa sin estorbar a nadie.
 */
export const RATIO_MAXIMO = 500;

/**
 * El archivo no es un XLSX aceptable.
 *
 * Lleva un mensaje que se le puede enseñar tal cual a la academia. Lo que NO
 * lleva es el detalle técnico de por qué se ha rechazado: a quien sube una hoja
 * normal no le sirve de nada, y a quien está probando cómo saltarse esto le
 * serviría para afinar el siguiente intento.
 */
export class ArchivoPeligrosoError extends Error {
  /** El motivo técnico, para el registro del servidor. Nunca se le enseña. */
  readonly detalle: string;

  constructor(mensaje: string, detalle: string) {
    super(mensaje);
    this.name = "ArchivoPeligrosoError";
    this.detalle = detalle;
  }
}

/** Lo que se ha visto dentro del archivo. Se devuelve para poder registrarlo. */
export type ResumenZip = {
  entradas: number;
  bytesComprimidos: number;
  bytesDescomprimidos: number;
};

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_DIRECTORIO = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
const FIRMA_FIN_ZIP64 = 0x06064b50;

/** Longitud máxima del comentario final del ZIP, más la cabecera de cierre. */
const MAX_BUSQUEDA_FIN = 0xffff + 22;

/**
 * Busca la cabecera de cierre del ZIP, que es por donde se empieza a leerlo.
 *
 * Se recorre desde el final porque ahí es donde está, y porque su posición
 * depende de un comentario de longitud variable que puede llevar cualquier cosa
 * dentro, la propia firma incluida. Empezar por el final es lo que hacen todas
 * las implementaciones y lo que evita que un comentario preparado a mano nos
 * lleve a leer un directorio falso.
 */
function buscarFin(datos: Buffer): number {
  const desde = Math.max(0, datos.length - MAX_BUSQUEDA_FIN);
  for (let i = datos.length - 22; i >= desde; i--) {
    if (datos.readUInt32LE(i) === FIRMA_FIN) return i;
  }
  return -1;
}

/**
 * Comprueba que un XLSX se puede abrir sin riesgo, y devuelve lo que ha visto.
 *
 * @param buffer El archivo tal como ha llegado.
 * @returns Cuántas entradas tiene y cuánto ocupa, ya comprobado de verdad
 *   descomprimiéndolo.
 * @throws {ArchivoPeligrosoError} Ante cualquier cosa que no cuadre. Es
 *   deliberadamente estricto: un archivo raro que sea legítimo se puede volver
 *   a exportar desde Excel, y uno hostil que pase no se puede deshacer.
 *
 * @example
 * ```ts
 * const resumen = comprobarXlsx(Buffer.from(await file.arrayBuffer()));
 * // solo ahora se le entrega a ExcelJS
 * ```
 */
export function comprobarXlsx(buffer: Buffer): ResumenZip {
  if (buffer.length > MAX_BYTES_ARCHIVO) {
    throw new ArchivoPeligrosoError(
      "El archivo supera los 10 MB.",
      `tamaño ${buffer.length}`,
    );
  }
  if (buffer.length < 22) {
    throw new ArchivoPeligrosoError(
      "El archivo está vacío o incompleto.",
      `tamaño ${buffer.length}`,
    );
  }

  // Los bytes de verdad, no la extensión ni el tipo declarado: los dos los
  // elige quien sube el archivo.
  if (buffer.readUInt32LE(0) !== FIRMA_LOCAL) {
    throw new ArchivoPeligrosoError(
      "Ese archivo no es un Excel. Vuelve a exportarlo como .xlsx.",
      "no empieza por la firma de un ZIP",
    );
  }

  const fin = buscarFin(buffer);
  if (fin === -1) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      "sin cabecera de cierre",
    );
  }

  // ZIP64 se rechaza. Existe para archivos de más de cuatro gigas o con más de
  // 65.535 entradas, y ninguna de las dos cosas tiene sentido en una hoja de
  // menos de diez megas. Aceptarlo sería mantener un segundo camino de lectura
  // —con su segunda tanda de comprobaciones— para un caso que no se da.
  if (buffer.indexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06])) !== -1) {
    throw new ArchivoPeligrosoError(
      "Ese Excel usa un formato que no admitimos. Vuelve a exportarlo como .xlsx.",
      `ZIP64 (firma ${FIRMA_FIN_ZIP64.toString(16)})`,
    );
  }

  const entradas = buffer.readUInt16LE(fin + 10);
  const tamDirectorio = buffer.readUInt32LE(fin + 12);
  const inicioDirectorio = buffer.readUInt32LE(fin + 16);

  if (entradas === 0) {
    throw new ArchivoPeligrosoError(
      "El archivo está vacío.",
      "cero entradas",
    );
  }
  if (entradas > MAX_ENTRADAS) {
    throw new ArchivoPeligrosoError(
      "Ese archivo tiene una estructura anómala y no se abre.",
      `${entradas} entradas`,
    );
  }
  if (inicioDirectorio + tamDirectorio > buffer.length) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      "el directorio central se sale del archivo",
    );
  }

  let cursor = inicioDirectorio;
  let totalDescomprimido = 0;
  let totalComprimido = 0;

  for (let n = 0; n < entradas; n++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== FIRMA_DIRECTORIO) {
      throw new ArchivoPeligrosoError(
        "El archivo está dañado y no se puede abrir.",
        `entrada ${n}: directorio incoherente`,
      );
    }

    const metodo = buffer.readUInt16LE(cursor + 10);
    const comprimido = buffer.readUInt32LE(cursor + 20);
    const descomprimido = buffer.readUInt32LE(cursor + 24);
    const largoNombre = buffer.readUInt16LE(cursor + 28);
    const largoExtra = buffer.readUInt16LE(cursor + 30);
    const largoComentario = buffer.readUInt16LE(cursor + 32);
    const offsetLocal = buffer.readUInt32LE(cursor + 42);
    const nombre = buffer
      .subarray(cursor + 46, cursor + 46 + largoNombre)
      .toString("utf8");

    comprobarNombre(nombre, n);

    // Solo «guardado» y «desinflado». Los demás métodos (bzip2, LZMA, PPMd)
    // los admite el formato ZIP pero no los usa ningún Excel, y cada uno es un
    // descompresor más con sus propios límites que vigilar.
    if (metodo !== 0 && metodo !== 8) {
      throw new ArchivoPeligrosoError(
        "Ese archivo usa una compresión que no admitimos. Vuelve a exportarlo desde Excel.",
        `entrada «${nombre}»: método ${metodo}`,
      );
    }

    if (descomprimido > MAX_BYTES_ENTRADA) {
      throw new ArchivoPeligrosoError(
        "Ese archivo es demasiado grande al abrirlo.",
        `entrada «${nombre}»: declara ${descomprimido} bytes`,
      );
    }

    totalDescomprimido += descomprimido;
    totalComprimido += comprimido;

    if (totalDescomprimido > MAX_BYTES_DESCOMPRIMIDO) {
      throw new ArchivoPeligrosoError(
        "Ese archivo es demasiado grande al abrirlo.",
        `total declarado ${totalDescomprimido} bytes`,
      );
    }

    // La proporción se mira por entrada además de en total: una sola entrada
    // monstruosa entre cincuenta normales podría diluir la media.
    if (comprimido > 0 && descomprimido / comprimido > RATIO_MAXIMO) {
      throw new ArchivoPeligrosoError(
        "Ese archivo tiene una estructura anómala y no se abre.",
        `entrada «${nombre}»: proporción ${Math.round(descomprimido / comprimido)}:1`,
      );
    }

    // Y AHORA LO QUE DE VERDAD CIERRA EL AGUJERO: descomprimirla con un tope.
    // Todo lo de arriba son cifras que declara el propio archivo y en las que
    // se puede mentir. Esto no.
    inflarConTope(buffer, offsetLocal, comprimido, metodo, nombre);

    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }

  if (
    totalComprimido > 0 &&
    totalDescomprimido / totalComprimido > RATIO_MAXIMO
  ) {
    throw new ArchivoPeligrosoError(
      "Ese archivo tiene una estructura anómala y no se abre.",
      `proporción total ${Math.round(totalDescomprimido / totalComprimido)}:1`,
    );
  }

  return {
    entradas,
    bytesComprimidos: totalComprimido,
    bytesDescomprimidos: totalDescomprimido,
  };
}

/**
 * Descomprime una entrada con un límite duro de salida.
 *
 * `maxOutputLength` hace que `inflateRaw` aborte en cuanto se pasa, en lugar de
 * seguir reservando memoria hasta que el proceso muere. Es la diferencia entre
 * rechazar un archivo y quedarse sin servidor.
 *
 * No se guarda lo descomprimido: aquí solo interesa saber que cabe. Quien lo
 * lee de verdad es ExcelJS, después, y ya sabemos que no va a explotar.
 */
function inflarConTope(
  buffer: Buffer,
  offsetLocal: number,
  comprimido: number,
  metodo: number,
  nombre: string,
): void {
  if (offsetLocal + 30 > buffer.length) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      `entrada «${nombre}»: cabecera local fuera del archivo`,
    );
  }
  if (buffer.readUInt32LE(offsetLocal) !== FIRMA_LOCAL) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      `entrada «${nombre}»: cabecera local incoherente`,
    );
  }

  // Los largos de la cabecera LOCAL, que pueden no coincidir con los del
  // directorio central. Es el desajuste clásico con el que se cuelan cosas por
  // detrás de un analizador que solo mira uno de los dos sitios.
  const largoNombre = buffer.readUInt16LE(offsetLocal + 26);
  const largoExtra = buffer.readUInt16LE(offsetLocal + 28);
  const inicioDatos = offsetLocal + 30 + largoNombre + largoExtra;

  if (inicioDatos + comprimido > buffer.length) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      `entrada «${nombre}»: los datos se salen del archivo`,
    );
  }

  const datos = buffer.subarray(inicioDatos, inicioDatos + comprimido);

  // Guardada sin comprimir: no hay nada que inflar y el tamaño ya está mirado.
  if (metodo === 0) return;

  try {
    inflateRawSync(datos, { maxOutputLength: MAX_BYTES_ENTRADA });
  } catch (error) {
    const mensaje = (error as Error).message ?? "";
    if (/maxOutputLength|buffer|memory/i.test(mensaje)) {
      throw new ArchivoPeligrosoError(
        "Ese archivo es demasiado grande al abrirlo.",
        `entrada «${nombre}»: se pasa del tope al descomprimir`,
      );
    }
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      `entrada «${nombre}»: ${mensaje.slice(0, 120)}`,
    );
  }
}

/**
 * Comprueba el nombre de una entrada.
 *
 * En un XLSX este nombre nunca acaba en el disco —ExcelJS lo lee en memoria—,
 * así que hoy no hay recorrido de rutas que explotar. Se comprueba igual por
 * dos motivos: porque el día que alguien escriba un extractor a disco esto ya
 * estará puesto, y porque un `..` en el nombre de una entrada de un Excel
 * significa que ese archivo no lo ha generado Excel.
 */
function comprobarNombre(nombre: string, indice: number): void {
  if (!nombre) {
    throw new ArchivoPeligrosoError(
      "El archivo está dañado y no se puede abrir.",
      `entrada ${indice}: sin nombre`,
    );
  }
  if (nombre.length > 512) {
    throw new ArchivoPeligrosoError(
      "Ese archivo tiene una estructura anómala y no se abre.",
      `entrada ${indice}: nombre de ${nombre.length} caracteres`,
    );
  }

  const normalizado = nombre.replace(/\\/g, "/");

  if (
    normalizado.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizado) ||
    normalizado.split("/").includes("..")
  ) {
    throw new ArchivoPeligrosoError(
      "Ese archivo tiene una estructura anómala y no se abre.",
      `entrada ${indice}: nombre con ruta «${nombre.slice(0, 80)}»`,
    );
  }

  // Un byte nulo dentro del nombre es el truco de toda la vida para que dos
  // capas distintas lean dos nombres distintos.
  if (nombre.split("").some((c) => c.charCodeAt(0) === 0)) {
    throw new ArchivoPeligrosoError(
      "Ese archivo tiene una estructura anómala y no se abre.",
      `entrada ${indice}: nombre con byte nulo`,
    );
  }
}
