/**
 * Banco de preguntas de demostración para la Academia Catedria Demo.
 *
 *   npm run demo:preguntas
 *
 * Preguntas ficticias pero verosímiles de Administrativo del Estado, repartidas
 * por tema y con explicación, para poder probar tests, corrección, histórico de
 * errores y analítica con datos que se parezcan a los reales.
 */
import { prismaBase } from "../src/lib/db/client";
import { tenantDb } from "../src/lib/db/tenant";

type Pregunta = {
  tema: number;
  dificultad: "EASY" | "MEDIUM" | "HARD";
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
};

const BANCO: Pregunta[] = [
  // Bloque I · Organización pública
  {
    tema: 0,
    dificultad: "EASY",
    enunciado: "¿En qué fecha fue ratificada en referéndum la Constitución Española?",
    opciones: ["6 de diciembre de 1978", "27 de diciembre de 1978", "29 de diciembre de 1978", "31 de octubre de 1978"],
    correcta: 0,
    explicacion: "Se ratificó en referéndum el 6 de diciembre de 1978; se sancionó el 27 y entró en vigor el 29.",
  },
  {
    tema: 0,
    dificultad: "MEDIUM",
    enunciado: "El Título Preliminar de la Constitución comprende los artículos:",
    opciones: ["1 al 9", "1 al 10", "1 al 14", "1 al 5"],
    correcta: 0,
    explicacion: "El Título Preliminar abarca los artículos 1 a 9.",
  },
  {
    tema: 0,
    dificultad: "HARD",
    enunciado: "Según el artículo 1.1, España se constituye en un Estado social y democrático de Derecho que propugna como valores superiores de su ordenamiento jurídico:",
    opciones: [
      "La libertad, la justicia, la igualdad y el pluralismo político",
      "La libertad, la igualdad, la solidaridad y la justicia",
      "La dignidad, la libertad, la igualdad y la justicia",
      "La libertad, la justicia, la seguridad y el pluralismo",
    ],
    correcta: 0,
    explicacion: "Artículo 1.1: libertad, justicia, igualdad y pluralismo político.",
  },
  {
    tema: 1,
    dificultad: "MEDIUM",
    enunciado: "Las Cortes Generales están formadas por:",
    opciones: ["El Congreso de los Diputados y el Senado", "El Congreso y el Gobierno", "El Senado y el Consejo de Estado", "El Congreso, el Senado y el Defensor del Pueblo"],
    correcta: 0,
    explicacion: "Artículo 66.1: las Cortes Generales representan al pueblo español y están formadas por el Congreso de los Diputados y el Senado.",
  },
  {
    tema: 1,
    dificultad: "HARD",
    enunciado: "El Congreso de los Diputados se compone de un mínimo y un máximo de:",
    opciones: ["300 y 400 diputados", "250 y 350 diputados", "350 y 400 diputados", "200 y 300 diputados"],
    correcta: 0,
    explicacion: "Artículo 68.1: mínimo de 300 y máximo de 400 diputados. Actualmente son 350 por ley electoral.",
  },
  {
    tema: 2,
    dificultad: "MEDIUM",
    enunciado: "¿Quién propone al Rey el nombramiento y separación de los miembros del Gobierno?",
    opciones: ["El Presidente del Gobierno", "El Congreso de los Diputados", "El Consejo de Ministros", "El Ministro de la Presidencia"],
    correcta: 0,
    explicacion: "Artículo 100: los demás miembros del Gobierno se nombran y separan por el Rey a propuesta de su Presidente.",
  },
  {
    tema: 3,
    dificultad: "MEDIUM",
    enunciado: "La creación de una Comunidad Autónoma se regula principalmente en:",
    opciones: ["El Título VIII de la Constitución", "El Título VII", "El Título VI", "La Ley 40/2015"],
    correcta: 0,
    explicacion: "El Título VIII regula la organización territorial del Estado.",
  },

  // Bloque II · Actividad administrativa
  {
    tema: 4,
    dificultad: "MEDIUM",
    enunciado: "Son nulos de pleno derecho los actos administrativos que:",
    opciones: [
      "Lesionen los derechos y libertades susceptibles de amparo constitucional",
      "Incurran en cualquier infracción del ordenamiento jurídico",
      "Se dicten fuera de plazo",
      "Carezcan de informe facultativo",
    ],
    correcta: 0,
    explicacion: "Artículo 47.1.a) de la Ley 39/2015. Las infracciones no cualificadas producen anulabilidad, no nulidad.",
  },
  {
    tema: 4,
    dificultad: "HARD",
    enunciado: "La notificación de un acto administrativo deberá cursarse, desde que se dicte, en el plazo de:",
    opciones: ["10 días", "5 días", "15 días", "1 mes"],
    correcta: 0,
    explicacion: "Artículo 40.2 de la Ley 39/2015: toda notificación se cursará en el plazo de diez días a partir de la fecha del acto.",
  },
  {
    tema: 5,
    dificultad: "EASY",
    enunciado: "Conforme a la Ley 39/2015, si la norma no fija otro plazo, el máximo para resolver es de:",
    opciones: ["Tres meses", "Un mes", "Seis meses", "Un año"],
    correcta: 0,
    explicacion: "Artículo 21.3: tres meses cuando las normas reguladoras no establecen un plazo distinto.",
  },
  {
    tema: 5,
    dificultad: "MEDIUM",
    enunciado: "El silencio administrativo en procedimientos iniciados a solicitud del interesado tiene, con carácter general, efecto:",
    opciones: ["Estimatorio", "Desestimatorio", "Sin efecto alguno", "Depende del órgano competente"],
    correcta: 0,
    explicacion: "Artículo 24.1: el silencio es positivo como regla general, salvo las excepciones que el propio precepto establece.",
  },
  {
    tema: 5,
    dificultad: "HARD",
    enunciado: "Los plazos señalados por días se entienden, salvo que se indique lo contrario:",
    opciones: ["Días hábiles, excluyendo sábados, domingos y festivos", "Días naturales", "Días hábiles incluyendo sábados", "Días laborables del interesado"],
    correcta: 0,
    explicacion: "Artículo 30.2 de la Ley 39/2015: días hábiles, excluyéndose sábados, domingos y declarados festivos.",
  },
  {
    tema: 6,
    dificultad: "MEDIUM",
    enunciado: "El recurso de alzada se interpone:",
    opciones: [
      "Ante el órgano que dictó el acto o ante su superior jerárquico",
      "Únicamente ante el órgano que dictó el acto",
      "Ante el orden jurisdiccional contencioso-administrativo",
      "Ante el Defensor del Pueblo",
    ],
    correcta: 0,
    explicacion: "Artículo 121.2: podrá interponerse ante el órgano que dictó el acto o ante el competente para resolverlo.",
  },
  {
    tema: 6,
    dificultad: "MEDIUM",
    enunciado: "El plazo para interponer recurso de alzada contra un acto expreso es de:",
    opciones: ["Un mes", "Quince días", "Dos meses", "Tres meses"],
    correcta: 0,
    explicacion: "Artículo 122.1: un mes si el acto es expreso.",
  },
  {
    tema: 7,
    dificultad: "HARD",
    enunciado: "Transcurrido el plazo para resolver un recurso de reposición sin resolución expresa, se entiende:",
    opciones: ["Desestimado", "Estimado", "Caducado", "Archivado"],
    correcta: 0,
    explicacion: "Artículo 124.2: transcurrido un mes sin resolución expresa, se entiende desestimado.",
  },

  // Bloque III · Gestión de personal
  {
    tema: 8,
    dificultad: "MEDIUM",
    enunciado: "El Estatuto Básico del Empleado Público se aprueba por:",
    opciones: [
      "Real Decreto Legislativo 5/2015",
      "Ley 39/2015",
      "Ley 40/2015",
      "Real Decreto 364/1995",
    ],
    correcta: 0,
    explicacion: "El texto refundido del EBEP es el Real Decreto Legislativo 5/2015, de 30 de octubre.",
  },
  {
    tema: 9,
    dificultad: "MEDIUM",
    enunciado: "¿Cuál de los siguientes NO es un derecho individual del empleado público reconocido en el EBEP?",
    opciones: [
      "La libre elección del puesto de trabajo",
      "La inamovilidad en la condición de funcionario de carrera",
      "La progresión en la carrera profesional",
      "La formación continua",
    ],
    correcta: 0,
    explicacion: "El EBEP no reconoce la libre elección de puesto: la provisión se hace por los procedimientos legalmente establecidos.",
  },
  {
    tema: 10,
    dificultad: "HARD",
    enunciado: "La excedencia por cuidado de familiar tiene una duración máxima de:",
    opciones: ["Tres años", "Dos años", "Un año", "Cinco años"],
    correcta: 0,
    explicacion: "Artículo 89.4 del EBEP: hasta tres años para atender al cuidado de un familiar a cargo.",
  },
];

async function main() {
  const academia = await prismaBase.academy.findUnique({
    where: { slug: "catedria-demo" },
    select: { id: true },
  });
  if (!academia) {
    console.error("✗ No existe la academia demo. Ejecuta antes `npm run db:seed`.");
    process.exit(1);
  }

  const db = tenantDb(academia.id);

  const edicion = await db.oppositionEdition.findFirst({
    where: { opposition: { slug: "administrativo-estado" }, deletedAt: null },
    select: { id: true },
  });
  if (!edicion) {
    console.error("✗ No encuentro la convocatoria de Administrativo.");
    process.exit(1);
  }

  const temas = await db.contentNode.findMany({
    where: { kind: "TOPIC", editionId: edicion.id, deletedAt: null },
    select: { id: true, label: true, path: true, position: true },
  });
  temas.sort((a, b) =>
    a.path === b.path ? a.position - b.position : a.path.localeCompare(b.path),
  );

  const profesor = await db.membership.findFirst({
    where: { teacherProfile: { isNot: null } },
    select: { id: true },
  });

  let creadas = 0;

  for (const pregunta of BANCO) {
    const tema = temas[pregunta.tema];
    if (!tema) continue;

    const existe = await db.question.findFirst({
      where: { statement: pregunta.enunciado, deletedAt: null },
      select: { id: true },
    });
    if (existe) continue;

    const creada = await db.question.create({
      data: {
        nodeId: tema.id,
        editionId: edicion.id,
        type: "SINGLE_CHOICE",
        difficulty: pregunta.dificultad,
        status: "PUBLISHED",
        source: "MANUAL",
        statement: pregunta.enunciado,
        explanation: pregunta.explicacion,
        authorId: profesor?.id ?? null,
        reviewerId: profesor?.id ?? null,
        reviewedAt: new Date(),
      },
    });

    // Rotamos el orden de las opciones. Si la correcta fuera siempre la A, el
    // banco de demostración no serviría para probar nada: cualquiera acertaría
    // todo pulsando siempre la primera.
    const rotacion = creadas % pregunta.opciones.length;
    const ordenadas = [
      ...pregunta.opciones.slice(rotacion),
      ...pregunta.opciones.slice(0, rotacion),
    ];
    const nuevaCorrecta = ordenadas.indexOf(pregunta.opciones[pregunta.correcta]);

    await db.questionOption.createMany({
      data: ordenadas.map((text, position) => ({
        questionId: creada.id,
        text,
        position,
        isCorrect: position === nuevaCorrecta,
      })),
    });

    creadas += 1;
  }

  // Una pregunta en borrador a propósito: sirve para enseñar que nada llega al
  // alumnado sin que una persona lo apruebe.
  const yaHayBorrador = await db.question.findFirst({
    where: { status: "DRAFT", deletedAt: null },
    select: { id: true },
  });
  if (!yaHayBorrador && temas[5]) {
    const borrador = await db.question.create({
      data: {
        nodeId: temas[5].id,
        editionId: edicion.id,
        type: "SINGLE_CHOICE",
        difficulty: "MEDIUM",
        status: "DRAFT",
        source: "MANUAL",
        statement:
          "PENDIENTE DE REVISIÓN · ¿Cuál es el plazo de subsanación de una solicitud incompleta?",
        explanation: "Artículo 68.1: diez días, ampliables cinco más.",
        authorId: profesor?.id ?? null,
      },
    });
    await db.questionOption.createMany({
      data: ["Diez días", "Cinco días", "Quince días", "Un mes"].map((text, position) => ({
        questionId: borrador.id,
        text,
        position,
        isCorrect: position === 0,
      })),
    });
    creadas += 1;
  }

  const total = await db.question.count({ where: { deletedAt: null } });
  console.log(`✓ ${creadas} preguntas nuevas · ${total} en el banco de la demo`);
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
