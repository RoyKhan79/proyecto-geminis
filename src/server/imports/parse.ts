import ExcelJS from "exceljs";
import Papa from "papaparse";
import { ArchivoPeligrosoError, comprobarXlsx } from "./zip-seguro";

/**
 * Lectura de archivos de importación.
 *
 * Acepta CSV, XLS y XLSX y devuelve siempre lo mismo: cabeceras y filas como
 * texto. La interpretación (qué columna es el correo, qué es un teléfono) se
 * hace después, en el mapeo, porque es una decisión del usuario y no del
 * formato del archivo.
 */

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
  /// Filas descartadas por estar completamente vacías.
  emptyRows: number;
  /**
   * Cuántas filas con datos traía el archivo, ANTES del tope de `MAX_ROWS`.
   *
   * Existe para que se pueda avisar. Antes se recortaba a veinte mil y no se
   * decía en ningún sitio: quien subiera treinta mil alumnos importaba veinte
   * mil y se quedaba sin diez mil sin enterarse. Perder datos en silencio es
   * peor que fallar.
   */
  totalRows: number;
};

/**
 * El archivo no se ha podido leer.
 *
 * Lleva un mensaje que se le puede enseñar tal cual a la academia: «esto no
 * parece un CSV» sirve; «Unexpected token at position 0» no.
 */
export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

/** Tope de filas por archivo. Se exporta para poder decir el número. */
export const MAX_ROWS = 20000;

/**
 * Lee un archivo de importación y devuelve sus filas.
 *
 * @returns Las columnas encontradas y las filas en crudo, sin interpretar
 *   todavía: el mapeo lo decide la academia en el paso siguiente.
 * @throws {ImportParseError} Si el formato no se reconoce o el archivo está
 *   vacío, con un mensaje que se puede enseñar.
 */
export async function parseImportFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<ParsedSheet> {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv" || extension === "txt") return parseCsv(buffer);
  if (extension === "xlsx" || extension === "xls") return parseExcel(buffer);

  throw new ImportParseError(
    "Formato no admitido. Sube un archivo CSV, XLS o XLSX.",
  );
}

function parseCsv(buffer: ArrayBuffer): ParsedSheet {
  // Muchos exportadores españoles generan CSV en Windows-1252 y con punto y
  // coma. Papa detecta el separador solo; para la codificación probamos UTF-8 y
  // caemos a latin1 si aparecen caracteres de sustitución.
  let texto = new TextDecoder("utf-8").decode(buffer);
  if (texto.includes("�")) {
    texto = new TextDecoder("windows-1252").decode(buffer);
  }

  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (resultado.errors.length > 0 && resultado.data.length === 0) {
    throw new ImportParseError(
      `No se ha podido leer el archivo: ${resultado.errors[0].message}`,
    );
  }

  const headers = (resultado.meta.fields ?? []).filter(Boolean);
  const rows = resultado.data
    .map((row) => normalizeRow(row, headers))
    .filter((row) => !isEmptyRow(row));

  return {
    headers,
    rows: rows.slice(0, MAX_ROWS),
    emptyRows: resultado.data.length - rows.length,
    totalRows: rows.length,
  };
}

/**
 * Lee un XLSX, **después** de comprobar que se puede abrir sin riesgo.
 *
 * El orden importa y es la única razón por la que esta función no es dos
 * líneas: `workbook.xlsx.load()` descomprime el archivo entero en memoria sin
 * ningún tope, así que un XLSX de diez megas preparado a mano —una bomba de
 * descompresión— tumbaba el proceso y con él a todas las academias. La
 * comprobación va antes de que ExcelJS vea un byte; ver `zip-seguro.ts`.
 */
async function parseExcel(buffer: ArrayBuffer): Promise<ParsedSheet> {
  try {
    comprobarXlsx(Buffer.from(buffer));
  } catch (error) {
    if (error instanceof ArchivoPeligrosoError) {
      // El motivo técnico va al registro del servidor; a la academia se le
      // enseña el mensaje corto, que no le dice a nadie qué límite ha tocado.
      console.warn(`[importación] archivo rechazado · ${error.detalle}`);
      throw new ImportParseError(error.message);
    }
    throw error;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportParseError("El archivo no contiene ninguna hoja.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellText(cell.value) ?? "").trim();
  });

  const limpias = headers.map((header, index) =>
    header || `Columna ${index + 1}`,
  );

  const rows: Record<string, string>[] = [];
  let vacias = 0;

  // Se cuentan todas las que traen datos, se guarden o no: es lo que permite
  // avisar de que el archivo tenía más de las que caben.
  let conDatos = 0;

  sheet.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const registro: Record<string, string> = {};
    limpias.forEach((header, index) => {
      registro[header] = String(cellText(row.getCell(index + 1).value) ?? "").trim();
    });

    if (isEmptyRow(registro)) {
      vacias += 1;
      return;
    }
    conDatos += 1;
    if (rows.length >= MAX_ROWS) return;
    rows.push(registro);
  });

  return { headers: limpias, rows, emptyRows: vacias, totalRows: conDatos };
}

/** Convierte cualquier valor de celda de Excel en texto legible. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
    return "";
  }
  return String(value);
}

function normalizeRow(row: Record<string, string>, headers: string[]) {
  const salida: Record<string, string> = {};
  for (const header of headers) {
    salida[header] = String(row[header] ?? "").trim();
  }
  return salida;
}

function isEmptyRow(row: Record<string, string>) {
  return Object.values(row).every((valor) => !valor || valor.trim() === "");
}

/**
 * Propone un mapeo automático entre las columnas del archivo y los campos de
 * Geminis. Es solo una propuesta: el usuario la revisa siempre. Acierta en la
 * mayoría de exportaciones porque las academias usan cabeceras parecidas.
 */
export function suggestMapping(
  headers: string[],
  fields: { key: string; aliases: string[] }[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usados = new Set<string>();

  for (const field of fields) {
    const encontrada = headers.find((header) => {
      if (usados.has(header)) return false;
      const normalizada = normalizeKey(header);
      return field.aliases.some((alias) => normalizeKey(alias) === normalizada);
    });
    if (encontrada) {
      mapping[field.key] = encontrada;
      usados.add(encontrada);
    }
  }

  return mapping;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
