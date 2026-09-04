import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { createAcademyWithRoles } from "@/server/academies/provision";
import {
  evaluateQuestionRows,
  type QuestionFieldKey,
} from "@/server/imports/questions";

/**
 * LA SIMULACIÓN AVISA DE LAS PARECIDAS
 *
 * `parecido.test.ts` prueba la comparación por su cuenta. Esto prueba el cable:
 * que la importación de verdad carga el banco de la academia, lo compara y
 * pone el aviso en la fila.
 *
 * Es la parte que se rompe en silencio. La comparación puede seguir siendo
 * perfecta y no llegar nunca a ejecutarse porque alguien reordene el código, y
 * el resultado sería el de antes: importar el banco duplicado sin decir nada.
 */

const SUF = `imp${Date.now().toString(36)}`;

let academia: { id: string };

/** El mapeo de columnas, que en la aplicación elige la persona que importa. */
const MAPEO: Partial<Record<QuestionFieldKey, string>> = {
  statement: "enunciado",
  optionA: "a",
  optionB: "b",
  optionC: "c",
  correct: "correcta",
};

function fila(rowNumber: number, datos: Record<string, string>) {
  return { rowNumber, rawData: datos };
}

beforeAll(async () => {
  academia = await createAcademyWithRoles({
    slug: `imp-${SUF}`,
    name: "Importacion",
  });

  // Una pregunta que YA está en el banco de la academia.
  const db = tenantDb(academia.id);
  const pregunta = await db.question.create({
    data: {
      statement:
        "¿Cuál es el plazo máximo para resolver el procedimiento administrativo común?",
      status: "PUBLISHED",
    },
  });
  // Las opciones se crean aparte, como en el producto: `QuestionOption` no
  // lleva `academyId` propio y un `create` anidado no pasa la guardia.
  await db.questionOption.createMany({
    data: [
      { questionId: pregunta.id, text: "Tres meses", position: 0, isCorrect: true },
      { questionId: pregunta.id, text: "Seis meses", position: 1 },
      { questionId: pregunta.id, text: "Un mes", position: 2 },
    ],
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({ where: { id: academia.id } });
});

function evaluar(filas: { rowNumber: number; rawData: Record<string, string> }[]) {
  return evaluateQuestionRows(tenantDb(academia.id), filas, MAPEO, {
    editionId: null,
    onDuplicate: "import",
  });
}

/** Todos los textos de aviso de una fila, juntos, para poder buscar en ellos. */
function avisos(r: { messages: { level: string; text: string }[] }) {
  return r.messages.map((m) => m.text).join(" | ");
}

describe("una pregunta reescrita", () => {
  it("se avisa aunque no sea idéntica a la del banco", async () => {
    const [r] = await evaluar([
      fila(2, {
        enunciado:
          "Indique el plazo máximo de resolución del procedimiento administrativo común.",
        a: "Tres meses",
        b: "Seis meses",
        c: "Un mes",
        correcta: "A",
      }),
    ]);

    expect(avisos(r)).toContain("Se parece mucho");
    expect(avisos(r)).toContain("el banco");
    // Avisa, pero deja pasar la fila: puede ser una pregunta distinta y quien
    // decide es la persona que importa.
    expect(r.status).not.toBe("SKIPPED");
    expect(r.status).not.toBe("ERROR");
  });

  it("y se avisa también si la repetición está dentro del propio archivo", async () => {
    const filas = await evaluar([
      fila(2, {
        enunciado: "¿Quién nombra a los magistrados del Tribunal Constitucional?",
        a: "El Rey",
        b: "El Congreso",
        c: "El Gobierno",
        correcta: "A",
      }),
      fila(3, {
        enunciado:
          "Indique quién efectúa el nombramiento de los magistrados del Tribunal Constitucional.",
        a: "El Rey",
        b: "El Congreso",
        c: "El Gobierno",
        correcta: "A",
      }),
    ]);

    expect(avisos(filas[0])).not.toContain("Se parece mucho");
    expect(avisos(filas[1])).toContain("la fila 2");
  });
});

describe("una pregunta distinta del mismo tema", () => {
  it("no se marca solo por compartir vocabulario", async () => {
    const [r] = await evaluar([
      fila(2, {
        enunciado:
          "¿Qué efectos tiene el silencio administrativo en el procedimiento común?",
        a: "Estimatorio",
        b: "Desestimatorio",
        c: "Depende del procedimiento",
        correcta: "C",
      }),
    ]);

    expect(avisos(r)).not.toContain("Se parece mucho");
  });
});

describe("las ambigüedades llegan a la simulación", () => {
  it("«todas las anteriores» avisa de que el orden cambia al importar", async () => {
    const [r] = await evaluar([
      fila(2, {
        enunciado: "¿Qué recursos caben contra un acto de trámite cualificado?",
        a: "El de alzada",
        b: "El potestativo de reposicion",
        c: "Todas las anteriores son correctas",
        correcta: "C",
      }),
    ]);

    expect(avisos(r)).toContain("remite a las demás");
    expect(avisos(r)).toContain("la respuesta marcada");
  });

  it("una opción de relleno impide importar la fila", async () => {
    const [r] = await evaluar([
      fila(2, {
        enunciado: "¿Cuántos miembros tiene el Consejo General del Poder Judicial?",
        a: "Veinte y el presidente",
        b: "Doce vocales de origen judicial",
        c: "-",
        correcta: "A",
      }),
    ]);

    expect(avisos(r)).toContain("no es una respuesta");
    expect(r.status).toBe("ERROR");
  });
});
