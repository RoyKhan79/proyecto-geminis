import type { ImportRowStatus } from "@/generated/prisma/enums";
import type { TenantClient } from "@/lib/db/tenant";

/**
 * CATEDRIA IMPORT · banco de preguntas
 *
 * La segunda barrera para que una academia cambie de programa —después de tener
 * a sus alumnos en otro sitio— es tener veinte años de preguntas en un Excel.
 * Nadie las va a volver a escribir a mano.
 *
 * Mismo proceso que el resto de importaciones y por los mismos motivos:
 *
 *   subir → mapear columnas → VALIDAR → SIMULAR → importar → (poder revertir)
 *
 * Dos decisiones propias de las preguntas:
 *
 *   · **Entran como borrador.** Un banco heredado suele traer erratas, opciones
 *     que ya no aplican y respuestas mal marcadas. Publicarlas de golpe pondría
 *     esas preguntas en el examen de un alumno mañana.
 *   · **Se avisa de las duplicadas.** Un banco de veinte años tiene la misma
 *     pregunta cuatro veces con distinta redacción. Se comparan enunciados
 *     normalizados, dentro de la academia, y la fila se marca en lugar de
 *     entrar dos veces.
 */

export type QuestionFieldKey =
  | "statement"
  | "optionA"
  | "optionB"
  | "optionC"
  | "optionD"
  | "optionE"
  | "correct"
  | "explanation"
  | "topic"
  | "difficulty"
  | "tags"
  | "officialExamRef";

/** Los campos de una pregunta que se pueden mapear desde un archivo. */
export const QUESTION_FIELDS: {
  key: QuestionFieldKey;
  label: string;
  required: boolean;
  hint?: string;
  aliases: string[];
}[] = [
  {
    key: "statement",
    label: "Enunciado",
    required: true,
    hint: "Sirve además para detectar preguntas repetidas.",
    aliases: ["enunciado", "pregunta", "statement", "question", "texto", "cuestion"],
  },
  {
    key: "optionA",
    label: "Opción A",
    required: true,
    aliases: ["a", "opcion a", "opción a", "respuesta a", "option a", "1"],
  },
  {
    key: "optionB",
    label: "Opción B",
    required: true,
    aliases: ["b", "opcion b", "opción b", "respuesta b", "option b", "2"],
  },
  {
    key: "optionC",
    label: "Opción C",
    required: false,
    aliases: ["c", "opcion c", "opción c", "respuesta c", "option c", "3"],
  },
  {
    key: "optionD",
    label: "Opción D",
    required: false,
    aliases: ["d", "opcion d", "opción d", "respuesta d", "option d", "4"],
  },
  {
    key: "optionE",
    label: "Opción E",
    required: false,
    aliases: ["e", "opcion e", "opción e", "respuesta e", "option e", "5"],
  },
  {
    key: "correct",
    label: "Respuesta correcta",
    required: true,
    hint: "Vale la letra (A, B, C…), el número (1, 2, 3…) o el texto de la opción.",
    aliases: [
      "correcta",
      "respuesta",
      "solucion",
      "solución",
      "answer",
      "correct",
      "clave",
      "resp correcta",
    ],
  },
  {
    key: "explanation",
    label: "Explicación",
    required: false,
    hint: "Se le muestra al alumno después de responder.",
    aliases: ["explicacion", "explicación", "justificacion", "feedback", "comentario"],
  },
  {
    key: "topic",
    label: "Tema",
    required: false,
    hint: "Se busca por nombre en tu árbol de contenido. Si no coincide, la pregunta entra sin tema.",
    aliases: ["tema", "topic", "bloque", "epigrafe", "epígrafe", "unidad", "materia"],
  },
  {
    key: "difficulty",
    label: "Dificultad",
    required: false,
    aliases: ["dificultad", "difficulty", "nivel"],
  },
  {
    key: "tags",
    label: "Etiquetas",
    required: false,
    hint: "Separadas por comas.",
    aliases: ["etiquetas", "tags", "palabras clave", "keywords"],
  },
  {
    key: "officialExamRef",
    label: "Examen oficial",
    required: false,
    hint: "De qué convocatoria salió, si es una pregunta de examen real.",
    aliases: ["examen", "convocatoria", "oficial", "procedencia", "fuente", "año"],
  },
];

const LETRAS: QuestionFieldKey[] = [
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "optionE",
];

/** Un aviso sobre una fila concreta, con su gravedad. */
export type RowMessage = { level: "error" | "warning"; text: string };

/** Una fila ya interpretada: lo que se creará y lo que la impide. */
export type EvaluatedQuestionRow = {
  rowNumber: number;
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  nodeId: string | null;
  nodeLabel: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  officialExamRef: string | null;
  status: ImportRowStatus;
  messages: RowMessage[];
};

/**
 * Normaliza un enunciado para comparar.
 *
 * Se quitan acentos, signos y espacios de más, y se pasa a minúsculas. Dos
 * preguntas que solo se diferencian en la puntuación son la misma pregunta, y
 * en un banco heredado eso pasa constantemente.
 */
export function huellaDeEnunciado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Interpreta la dificultad venga como venga escrita. */
function leerDificultad(valor: string | null): "EASY" | "MEDIUM" | "HARD" {
  const v = (valor ?? "").trim().toLowerCase();
  if (/^(1|f|facil|fácil|baja|easy|basico|básico)/.test(v)) return "EASY";
  if (/^(3|d|dificil|difícil|alta|hard|avanzado)/.test(v)) return "HARD";
  return "MEDIUM";
}

/**
 * Interpreta cuál es la correcta.
 *
 * Cada academia lo escribe a su manera: «B», «b)», «2», «Opción B» o el texto
 * completo de la respuesta. Se aceptan todas porque obligar a normalizar el
 * Excel antes de importarlo es exactamente la fricción que hace que la academia
 * se quede donde estaba.
 */
export function leerCorrecta(valor: string, opciones: string[]): number {
  const v = valor.trim();
  if (!v) return -1;

  // Letra: "B", "b)", "Opción B". Sin distinguir mayúsculas: en un banco real
  // aparecen las tres formas, a veces en el mismo archivo.
  const letra = v.match(/^(?:opci[oó]n\s*)?([a-e])[).\s]*$/i);
  if (letra) return letra[1].toUpperCase().charCodeAt(0) - 65;

  // Número: "2", "2.".
  const numero = v.match(/^([1-9])[).\s]*$/);
  if (numero) return Number(numero[1]) - 1;

  // Texto completo de una opción.
  const huella = huellaDeEnunciado(v);
  const porTexto = opciones.findIndex((o) => huellaDeEnunciado(o) === huella);
  if (porTexto !== -1) return porTexto;

  return -1;
}

/**
 * Valida y prepara las filas SIN escribir nada.
 *
 * Devuelve exactamente lo que pasaría si se importara. Es lo que se enseña en
 * la simulación.
 */
export async function evaluateQuestionRows(
  db: TenantClient,
  filas: { rowNumber: number; rawData: Record<string, string> }[],
  mapping: Partial<Record<QuestionFieldKey, string>>,
  opciones: {
    editionId: string | null;
    /// Qué hacer con una pregunta que ya existe en el banco.
    onDuplicate: "skip" | "import";
  },
): Promise<EvaluatedQuestionRow[]> {
  // Índice de temas por nombre normalizado, para resolver la columna «tema».
  const temas = await db.contentNode.findMany({
    where: {
      deletedAt: null,
      ...(opciones.editionId ? { editionId: opciones.editionId } : {}),
    },
    select: { id: true, label: true },
  });
  const temaPorNombre = new Map(temas.map((t) => [huellaDeEnunciado(t.label), t]));

  // Enunciados que YA están en el banco de esta academia. Se traen todos y se
  // comparan en memoria: normalizar en SQL exigiría una función y un índice, y
  // un banco de preguntas de una academia no llega al tamaño que lo justifique.
  const existentes = await db.question.findMany({
    where: { deletedAt: null },
    select: { statement: true },
  });
  const yaEnElBanco = new Set(existentes.map((q) => huellaDeEnunciado(q.statement)));

  // Repetidas dentro del propio archivo.
  const vistasEnElArchivo = new Map<string, number>();

  const valor = (fila: Record<string, string>, campo: QuestionFieldKey) => {
    const columna = mapping[campo];
    if (!columna) return null;
    const bruto = fila[columna];
    const limpio = typeof bruto === "string" ? bruto.trim() : "";
    return limpio.length > 0 ? limpio : null;
  };

  const resultado: EvaluatedQuestionRow[] = [];

  for (const fila of filas) {
    const messages: RowMessage[] = [];
    const enunciado = valor(fila.rawData, "statement");

    const opcionesTexto = LETRAS.map((k) => valor(fila.rawData, k)).filter(
      (o): o is string => o !== null,
    );

    const correctaBruta = valor(fila.rawData, "correct");
    const tema = valor(fila.rawData, "topic");

    let status: ImportRowStatus = "VALID";

    if (!enunciado) {
      messages.push({ level: "error", text: "Falta el enunciado." });
      status = "ERROR";
    } else if (enunciado.length < 10) {
      messages.push({
        level: "error",
        text: "El enunciado es demasiado corto para ser una pregunta.",
      });
      status = "ERROR";
    }

    if (opcionesTexto.length < 2) {
      messages.push({
        level: "error",
        text: "Hacen falta al menos dos opciones.",
      });
      status = "ERROR";
    }

    // Opciones repetidas dentro de la misma pregunta: si dos son idénticas, la
    // pregunta es impugnable.
    const huellasOpciones = opcionesTexto.map(huellaDeEnunciado);
    if (new Set(huellasOpciones).size !== huellasOpciones.length) {
      messages.push({
        level: "error",
        text: "Hay dos opciones idénticas. La pregunta sería impugnable.",
      });
      status = "ERROR";
    }

    let correctIndex = -1;
    if (!correctaBruta) {
      messages.push({ level: "error", text: "Falta la respuesta correcta." });
      status = "ERROR";
    } else {
      correctIndex = leerCorrecta(correctaBruta, opcionesTexto);
      if (correctIndex < 0 || correctIndex >= opcionesTexto.length) {
        messages.push({
          level: "error",
          text: `No se entiende «${correctaBruta}» como respuesta correcta. Usa la letra, el número o el texto exacto de la opción.`,
        });
        status = "ERROR";
      }
    }

    // Duplicados: primero contra el banco, después contra el propio archivo.
    if (enunciado && status !== "ERROR") {
      const huella = huellaDeEnunciado(enunciado);

      if (yaEnElBanco.has(huella)) {
        if (opciones.onDuplicate === "skip") {
          messages.push({
            level: "warning",
            text: "Esta pregunta ya está en el banco. Se salta.",
          });
          status = "SKIPPED";
        } else {
          messages.push({
            level: "warning",
            text: "Esta pregunta ya está en el banco. Entrará repetida.",
          });
        }
      }

      const anterior = vistasEnElArchivo.get(huella);
      if (anterior !== undefined) {
        messages.push({
          level: "warning",
          text: `Repetida: ya aparece en la fila ${anterior} del archivo.`,
        });
        if (opciones.onDuplicate === "skip") status = "SKIPPED";
      } else {
        vistasEnElArchivo.set(huella, fila.rowNumber);
      }
    }

    // Tema: se resuelve por nombre. Si no coincide, no es un error —la pregunta
    // sirve igual—, pero sí un aviso, porque sin tema no entra en los tests por
    // tema ni cuenta para el ritmo del temario.
    let nodeId: string | null = null;
    let nodeLabel: string | null = null;

    if (tema) {
      const encontrado = temaPorNombre.get(huellaDeEnunciado(tema));
      if (encontrado) {
        nodeId = encontrado.id;
        nodeLabel = encontrado.label;
      } else {
        messages.push({
          level: "warning",
          text: `No hay ningún tema que se llame «${tema}». La pregunta entrará sin tema asignado.`,
        });
      }
    }

    const etiquetas = (valor(fila.rawData, "tags") ?? "")
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

    resultado.push({
      rowNumber: fila.rowNumber,
      statement: enunciado ?? "",
      options: opcionesTexto,
      correctIndex,
      explanation: valor(fila.rawData, "explanation"),
      nodeId,
      nodeLabel,
      difficulty: leerDificultad(valor(fila.rawData, "difficulty")),
      tags: etiquetas,
      officialExamRef: valor(fila.rawData, "officialExamRef"),
      status,
      messages,
    });
  }

  return resultado;
}

/**
 * Resume una simulación de importación de preguntas.
 *
 * @returns Cuántas entran, cuántas se descartan y por qué. Es lo que se enseña
 *   antes de escribir nada.
 */
export function summarizeQuestions(filas: EvaluatedQuestionRow[]) {
  return {
    total: filas.length,
    crear: filas.filter((f) => f.status === "VALID").length,
    saltar: filas.filter((f) => f.status === "SKIPPED").length,
    errores: filas.filter((f) => f.status === "ERROR").length,
    sinTema: filas.filter((f) => f.status === "VALID" && !f.nodeId).length,
  };
}

/**
 * Escribe las preguntas.
 *
 * Cada fila deja anotado qué creó, que es lo que permite deshacer la
 * importación entera después.
 */
export async function applyQuestionImport(
  db: TenantClient,
  jobId: string,
  filas: EvaluatedQuestionRow[],
  opciones: { editionId: string | null; authorId: string },
) {
  let creados = 0;
  let saltados = 0;
  let errores = 0;

  for (const fila of filas) {
    if (fila.status === "ERROR") {
      errores += 1;
      await marcarFila(db, jobId, fila, "ERROR", null);
      continue;
    }
    if (fila.status === "SKIPPED") {
      saltados += 1;
      await marcarFila(db, jobId, fila, "SKIPPED", null);
      continue;
    }

    const pregunta = await db.question.create({
      data: {
        editionId: opciones.editionId,
        nodeId: fila.nodeId,
        type: "SINGLE_CHOICE",
        difficulty: fila.difficulty,
        // Borrador siempre: un banco heredado se revisa antes de examinar con
        // él. Publicarlo entero es poner erratas de hace veinte años en el
        // test de mañana.
        status: "DRAFT",
        source: "IMPORT",
        statement: fila.statement,
        explanation: fila.explanation,
        tags: fila.tags,
        officialExamRef: fila.officialExamRef,
        authorId: opciones.authorId,
      },
      select: { id: true },
    });

    await db.questionOption.createMany({
      data: fila.options.map((text, position) => ({
        questionId: pregunta.id,
        text,
        isCorrect: position === fila.correctIndex,
        position,
      })),
    });

    creados += 1;
    await marcarFila(db, jobId, fila, "CREATED", pregunta.id);
  }

  return { creados, actualizados: 0, saltados, errores };
}

async function marcarFila(
  db: TenantClient,
  jobId: string,
  fila: EvaluatedQuestionRow,
  status: ImportRowStatus,
  entityId: string | null,
) {
  await db.importRow.updateMany({
    where: { jobId, rowNumber: fila.rowNumber },
    data: {
      status,
      messages: fila.messages,
      parsedData: {
        enunciado: fila.statement,
        opciones: fila.options,
        correcta: fila.correctIndex,
        tema: fila.nodeLabel,
      },
      entityType: entityId ? "Question" : null,
      entityId,
      wasCreated: entityId ? true : null,
    },
  });
}

/**
 * Deshacer.
 *
 * Solo se borran preguntas que no haya contestado nadie. Si una pregunta ya
 * tiene respuestas, borrarla se llevaría por delante el histórico de errores de
 * los alumnos y sus estadísticas: se deja archivada y se dice.
 */
export async function rollbackQuestionImport(db: TenantClient, jobId: string) {
  const filas = await db.importRow.findMany({
    where: { jobId, entityType: "Question", entityId: { not: null } },
    select: { id: true, entityId: true },
  });

  let borradas = 0;
  let archivadas = 0;

  for (const fila of filas) {
    const id = fila.entityId as string;

    const usada = await db.testAttemptAnswer.count({ where: { questionId: id } });

    if (usada > 0) {
      await db.question.update({
        where: { id },
        data: { status: "ARCHIVED", deletedAt: new Date() },
      });
      archivadas += 1;
    } else {
      await db.question.delete({ where: { id } });
      borradas += 1;
    }

    await db.importRow.update({
      where: { id: fila.id },
      data: { status: "ROLLED_BACK" },
    });
  }

  return { borradas, archivadas };
}
