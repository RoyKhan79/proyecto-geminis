import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ImportParseError, MAX_ROWS, parseImportFile } from "@/server/imports/parse";
import {
  ArchivoPeligrosoError,
  MAX_ENTRADAS,
  comprobarXlsx,
} from "@/server/imports/zip-seguro";

/**
 * IMPORTACIÓN DE EXCEL · lo que NO se puede abrir
 *
 * El control que había antes era `if (file.size > 10 MB)`, y no protegía de
 * nada: el tamaño que importa no es el del archivo sino el de lo que sale al
 * descomprimirlo. Estas pruebas construyen los archivos hostiles a mano —byte a
 * byte, sin depender de ninguna biblioteca que pudiera «arreglarlos» al
 * escribirlos— y comprueban que ninguno llega a ExcelJS.
 *
 * La prueba que más importa es la de la bomba: son unos pocos kilobytes que se
 * convierten en cientos de megas. Si esa falla, cualquiera con permiso para
 * importar tumba el servidor de todas las academias, no solo el de la suya.
 */

// ── Fabricación de ZIPs a mano ───────────────────────────────────────────────

type EntradaZip = {
  nombre: string;
  contenido: Buffer;
  /** Para mentir en la cabecera y comprobar que no nos fiamos de ella. */
  tamanoDeclarado?: number;
  sinComprimir?: boolean;
};

/**
 * Construye un ZIP con las entradas que se le den.
 *
 * Está escrito a mano a propósito. Con una biblioteca de compresión no se puede
 * fabricar un archivo que mienta en sus propias cabeceras, que es justo lo que
 * hay que probar: que la comprobación no se cree lo que el archivo dice de sí
 * mismo.
 */
function construirZip(entradas: EntradaZip[]): Buffer {
  const locales: Buffer[] = [];
  const directorio: Buffer[] = [];
  let offset = 0;

  for (const entrada of entradas) {
    const nombre = Buffer.from(entrada.nombre, "utf8");
    const datos = entrada.sinComprimir
      ? entrada.contenido
      : deflateRawSync(entrada.contenido, { level: 9 });
    const metodo = entrada.sinComprimir ? 0 : 8;
    const descomprimido = entrada.tamanoDeclarado ?? entrada.contenido.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0, 6); // banderas
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(0, 14); // CRC: no se comprueba aquí
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(descomprimido, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);

    locales.push(local, nombre, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(descomprimido, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(offset, 42);

    directorio.push(central, nombre);
    offset += 30 + nombre.length + datos.length;
  }

  const cuerpo = Buffer.concat(locales);
  const central = Buffer.concat(directorio);

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(cuerpo.length, 16);

  return Buffer.concat([cuerpo, central, fin]);
}

/**
 * El `ArrayBuffer` exacto de un `Buffer`, que es lo que recibe el importador.
 *
 * Node reparte los `Buffer` pequeños dentro de un bloque compartido, así que
 * `buffer.buffer` a secas trae también lo que haya alrededor. Aquí eso hacía
 * fallar la prueba del archivo legítimo, y en producción sería peor: pasarle a
 * ExcelJS memoria de otro sitio.
 */
function aArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

/** Un XLSX de verdad, con dos columnas y tres alumnos. */
async function xlsxLegitimo(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Alumnos");
  hoja.addRow(["Nombre", "Apellidos", "Correo"]);
  hoja.addRow(["Lucía", "Ferrer", "lucia@ejemplo.test"]);
  hoja.addRow(["Marcos", "Ibáñez", "marcos@ejemplo.test"]);
  hoja.addRow(["Nuria", "Sanz", "nuria@ejemplo.test"]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ── Pruebas ──────────────────────────────────────────────────────────────────

describe("importación · un Excel normal se lee", () => {
  it("lee las filas de un XLSX legítimo", async () => {
    const hoja = await parseImportFile(
      "alumnos.xlsx",
      aArrayBuffer(await xlsxLegitimo()),
    );

    expect(hoja.headers).toContain("Nombre");
    expect(hoja.headers).toContain("Correo");
    expect(hoja.rows).toHaveLength(3);
    expect(hoja.rows[0].Nombre).toBe("Lucía");
    expect(hoja.rows[2].Correo).toBe("nuria@ejemplo.test");
  });

  it("la inspección deja pasar un XLSX legítimo", async () => {
    const resumen = comprobarXlsx(await xlsxLegitimo());
    expect(resumen.entradas).toBeGreaterThan(0);
    expect(resumen.entradas).toBeLessThanOrEqual(MAX_ENTRADAS);
    expect(resumen.bytesDescomprimidos).toBeGreaterThan(0);
  });
});

describe("importación · un archivo con más filas de las que caben", () => {
  /*
   * El lector corta a MAX_ROWS y ANTES NO LO DECÍA. Quien subiera treinta mil
   * alumnos importaba veinte mil y perdía diez mil sin enterarse.
   *
   * Era imposible de provocar mientras Next cortaba el cuerpo de las Server
   * Actions en 1 MB —ningún archivo así llegaba—, y apareció en cuanto se
   * subió ese límite. Estas pruebas fijan que el recuento delate el recorte.
   */
  function csvCon(filas: number): ArrayBuffer {
    const lineas = ["nombre,apellidos,email"];
    for (let i = 0; i < filas; i += 1) {
      lineas.push(`Nombre${i},Apellido${i},alumno${i}@ejemplo.test`);
    }
    return aArrayBuffer(Buffer.from(lineas.join("\n"), "utf8"));
  }

  it("dice cuántas filas traía de verdad, no cuántas se ha quedado", async () => {
    const hoja = await parseImportFile("alumnos.csv", csvCon(MAX_ROWS + 500));

    expect(hoja.rows.length).toBe(MAX_ROWS);
    expect(hoja.totalRows).toBe(MAX_ROWS + 500);
    // Esta es la comparación de la que depende el aviso: si los dos números
    // fueran iguales, el recorte volvería a ser invisible.
    expect(hoja.totalRows).toBeGreaterThan(hoja.rows.length);
  });

  it("con un archivo normal, los dos números coinciden", async () => {
    const hoja = await parseImportFile("alumnos.csv", csvCon(120));
    expect(hoja.rows.length).toBe(120);
    expect(hoja.totalRows).toBe(120);
  });

  it("las filas vacías no cuentan como filas del archivo", async () => {
    const csv = "nombre,apellidos\nAna,Pérez\n,\n \nLuis,Gómez\n";
    const hoja = await parseImportFile("alumnos.csv", aArrayBuffer(Buffer.from(csv, "utf8")));
    expect(hoja.rows.length).toBe(2);
    expect(hoja.totalRows).toBe(2);
  });
});

describe("importación · bombas de descompresión", () => {
  it("rechaza una bomba: pocos kilobytes que se vuelven cientos de megas", () => {
    // 200 MB de ceros comprimen a unos pocos cientos de kilobytes. Es la bomba
    // clásica, y es lo que tumbaba el proceso al llegar a `xlsx.load()`.
    const bomba = construirZip([
      { nombre: "xl/worksheets/sheet1.xml", contenido: Buffer.alloc(200 * 1024 * 1024, 0x41) },
    ]);

    // Que quede escrito lo que se está probando: el archivo es pequeño.
    expect(bomba.length).toBeLessThan(1024 * 1024);

    expect(() => comprobarXlsx(bomba)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza la bomba aunque mienta sobre su tamaño en las cabeceras", () => {
    // Declara 1 KB y trae 200 MB. Todas las comprobaciones basadas en lo que el
    // archivo dice de sí mismo pasan; la única que lo pilla es descomprimir con
    // un tope, que es justo por lo que esa comprobación existe.
    const mentirosa = construirZip([
      {
        nombre: "xl/worksheets/sheet1.xml",
        contenido: Buffer.alloc(200 * 1024 * 1024, 0x41),
        tamanoDeclarado: 1024,
      },
    ]);

    expect(() => comprobarXlsx(mentirosa)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza una proporción de compresión desmedida", () => {
    const desmedida = construirZip([
      { nombre: "xl/worksheets/sheet1.xml", contenido: Buffer.alloc(30 * 1024 * 1024, 0x20) },
    ]);
    expect(() => comprobarXlsx(desmedida)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza un número abusivo de entradas", () => {
    const muchas = construirZip(
      Array.from({ length: MAX_ENTRADAS + 50 }, (_, i) => ({
        nombre: `xl/parte${i}.xml`,
        contenido: Buffer.from("<x/>"),
      })),
    );
    expect(() => comprobarXlsx(muchas)).toThrow(ArchivoPeligrosoError);
  });

  it("acepta un número de entradas normal para un Excel", () => {
    const normales = construirZip(
      Array.from({ length: 20 }, (_, i) => ({
        nombre: `xl/parte${i}.xml`,
        contenido: Buffer.from("<hoja>contenido corriente de una hoja</hoja>"),
      })),
    );
    expect(() => comprobarXlsx(normales)).not.toThrow();
  });
});

describe("importación · archivos que no son lo que dicen ser", () => {
  it("rechaza un archivo que se hace pasar por XLSX", () => {
    // Extensión .xlsx, contenido de otra cosa. La extensión y el tipo MIME los
    // elige quien sube el archivo; los bytes, no.
    const falso = Buffer.from("%PDF-1.7\nesto no es una hoja de cálculo");
    expect(() => comprobarXlsx(falso)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza un HTML disfrazado de Excel", () => {
    const html = Buffer.from("<html><body><script>alert(1)</script></body></html>");
    expect(() => comprobarXlsx(html)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza un archivo corrupto y no revienta", () => {
    const roto = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(400, 0xff),
    ]);
    expect(() => comprobarXlsx(roto)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza un XLSX vacío o truncado", () => {
    expect(() => comprobarXlsx(Buffer.alloc(0))).toThrow(ArchivoPeligrosoError);
    expect(() => comprobarXlsx(Buffer.from([0x50, 0x4b]))).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza un ZIP con una entrada que intenta salirse de su carpeta", () => {
    const fuga = construirZip([
      { nombre: "../../../../etc/passwd", contenido: Buffer.from("root:x:0:0") },
    ]);
    expect(() => comprobarXlsx(fuga)).toThrow(ArchivoPeligrosoError);
  });

  it("rechaza una entrada con ruta absoluta de Windows", () => {
    const fuga = construirZip([
      { nombre: "C:\\Windows\\System32\\drivers\\etc\\hosts", contenido: Buffer.from("x") },
    ]);
    expect(() => comprobarXlsx(fuga)).toThrow(ArchivoPeligrosoError);
  });
});

describe("importación · el mensaje que se le enseña a la academia", () => {
  it("no filtra el detalle técnico del rechazo", () => {
    const bomba = construirZip([
      { nombre: "xl/worksheets/sheet1.xml", contenido: Buffer.alloc(200 * 1024 * 1024, 0x41) },
    ]);

    try {
      comprobarXlsx(bomba);
      throw new Error("debería haber fallado");
    } catch (error) {
      expect(error).toBeInstanceOf(ArchivoPeligrosoError);
      const fallo = error as ArchivoPeligrosoError;
      // El mensaje visible no dice qué límite se ha tocado ni con qué cifra:
      // eso solo le sirve a quien esté afinando el siguiente intento.
      expect(fallo.message).not.toMatch(/\d{4,}/);
      expect(fallo.message).not.toMatch(/proporci[oó]n|entrada|inflate|zlib/i);
      // El detalle sí existe, para el registro del servidor.
      expect(fallo.detalle.length).toBeGreaterThan(0);
    }
  });

  it("el error llega al importador como un fallo de lectura normal", async () => {
    const bomba = construirZip([
      { nombre: "xl/worksheets/sheet1.xml", contenido: Buffer.alloc(200 * 1024 * 1024, 0x41) },
    ]);

    await expect(
      parseImportFile("alumnos.xlsx", aArrayBuffer(bomba)),
    ).rejects.toBeInstanceOf(ImportParseError);
  });
});
