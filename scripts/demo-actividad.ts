/**
 * DARLE PASADO A LA DEMO
 * ──────────────────────
 *   npm run demo:actividad
 *
 * La demo se sembraba con alumnos, temario y preguntas, pero sin **historia**:
 * cero intentos de test, cero respuestas, y por tanto una Analítica vacía. Un
 * producto cuya mitad del valor es «te digo quién se está desenganchando» no se
 * puede enseñar sin meses de actividad detrás.
 *
 * Esto simula diez semanas de clase. No reparte al azar: reparte con la forma
 * que tiene una academia de verdad, porque de eso depende que las gráficas
 * digan algo.
 *
 *   · **Cada alumno tiene un carácter.** Constante, irregular, de racha, o de
 *     los que se apagan. El que se apaga deja de aparecer a media curva, y es
 *     el que después sale en «requieren atención» con su motivo.
 *
 *   · **Cada tema tiene una dificultad.** Los procedimentales se atragantan más
 *     que los de organización. Sin eso, el acierto por tema sale plano y la
 *     gráfica no señala nada.
 *
 *   · **Se aprende con el tiempo.** El acierto sube unos puntos por semana. Una
 *     serie sin tendencia es ruido dibujado.
 *
 * Es reproducible: mismo generador, misma semilla, mismos datos. Dos personas
 * mirando la demo tienen que ver lo mismo.
 *
 * SOLO TOCA LA ACADEMIA DE DEMOSTRACIÓN. Busca por `slug`, y si no está, no
 * hace nada.
 */
import { prismaBase } from "@/lib/db/client";

const SLUG = process.env.DEMO_SLUG ?? "catedria-demo";
const SEMANAS = 10;

/**
 * Generador reproducible (mulberry32).
 *
 * `Math.random()` daría una demo distinta en cada máquina, y entonces las
 * capturas del manual no se podrían rehacer sin que cambien los números.
 */
function generador(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los cuatro caracteres de alumno, con lo que cada uno hace. */
const CARACTERES = [
  { nombre: "constante", intentosPorSemana: 2.4, base: 0.68, apagaEn: null },
  { nombre: "irregular", intentosPorSemana: 1.1, base: 0.55, apagaEn: null },
  { nombre: "aplicado", intentosPorSemana: 3.2, base: 0.78, apagaEn: null },
  // Los que se van. Son los que dan sentido a la mitad de la Analítica.
  { nombre: "se apaga", intentosPorSemana: 1.8, base: 0.5, apagaEn: 4 },
  { nombre: "se apaga tarde", intentosPorSemana: 2.0, base: 0.6, apagaEn: 7 },
] as const;

async function main() {
  console.log(`\nACTIVIDAD DE DEMOSTRACIÓN\n${"=".repeat(60)}`);

  const academia = await prismaBase.academy.findFirst({
    where: { slug: SLUG },
    select: { id: true, name: true },
  });
  if (!academia) {
    console.log(`  · No existe la academia «${SLUG}». No se hace nada.`);
    return;
  }

  const alumnos = await prismaBase.membership.findMany({
    where: {
      academyId: academia.id,
      deletedAt: null,
      studentProfile: { is: { status: "ACTIVE" } },
    },
    select: { id: true, userId: true },
    orderBy: { createdAt: "asc" },
  });

  const preguntas = await prismaBase.question.findMany({
    where: { academyId: academia.id, deletedAt: null, status: "PUBLISHED" },
    select: {
      id: true,
      nodeId: true,
      options: { select: { id: true, isCorrect: true } },
    },
  });

  if (alumnos.length === 0 || preguntas.length === 0) {
    console.log("  · Faltan alumnos o preguntas. Ejecuta antes `npm run demo:todo`.");
    return;
  }

  // Se borra lo anterior para que ejecutarlo dos veces no acumule diez semanas
  // encima de otras diez.
  const borradas = await prismaBase.testAttempt.deleteMany({
    where: { academyId: academia.id },
  });
  await prismaBase.studentQuestionStat.deleteMany({ where: { academyId: academia.id } });
  if (borradas.count > 0) {
    console.log(`  · Se retira la actividad anterior (${borradas.count} intentos).`);
  }

  const azar = generador(20260902);

  /*
   * La dificultad de cada tema, fija por tema y no por pregunta: lo que
   * interesa enseñar es que HAY temas que se atragantan, y eso solo se ve si el
   * mismo tema falla de forma consistente.
   */
  const temas = [...new Set(preguntas.map((p) => p.nodeId).filter(Boolean))] as string[];
  const dificultad = new Map(temas.map((id) => [id, 0.55 + azar() * 0.42]));

  const ahora = Date.now();
  const DIA = 24 * 60 * 60 * 1000;

  let intentos = 0;
  let respuestas = 0;
  const aciertosPorPregunta = new Map<string, { total: number; buenas: number }>();

  for (const [indice, alumno] of alumnos.entries()) {
    const caracter = CARACTERES[indice % CARACTERES.length];

    for (let semana = 0; semana < SEMANAS; semana += 1) {
      // El que se apaga deja de aparecer, y no de golpe: se va difuminando.
      if (caracter.apagaEn !== null && semana >= caracter.apagaEn) {
        if (azar() > 0.12) continue;
      }

      const cuantos = Math.round(caracter.intentosPorSemana * (0.6 + azar() * 0.8));
      for (let i = 0; i < cuantos; i += 1) {
        // Se cuenta hacia atrás desde hoy: la semana 9 es esta semana.
        const diasAtras = (SEMANAS - 1 - semana) * 7 + Math.floor(azar() * 7);
        const cuando = new Date(ahora - diasAtras * DIA - Math.floor(azar() * 8) * 3600_000);

        const cuantasPreguntas = 8 + Math.floor(azar() * 8);
        const elegidas = [...preguntas]
          .sort(() => azar() - 0.5)
          .slice(0, Math.min(cuantasPreguntas, preguntas.length));

        // Se aprende: unos puntos por semana, con techo.
        const aprendizaje = Math.min(0.16, semana * 0.018);

        let buenas = 0;
        let malas = 0;
        let blancas = 0;
        const filas: {
          questionId: string;
          position: number;
          selectedOptionId: string | null;
          isCorrect: boolean | null;
        }[] = [];

        elegidas.forEach((pregunta, posicion) => {
          const correcta = pregunta.options.find((o) => o.isCorrect);
          if (!correcta) return;

          // Un 6 % en blanco: quien deja preguntas sin contestar existe, y la
          // corrección tiene que enseñarlo.
          if (azar() < 0.06) {
            blancas += 1;
            filas.push({
              questionId: pregunta.id,
              position: posicion,
              selectedOptionId: null,
              isCorrect: null,
            });
            return;
          }

          const facilidad = dificultad.get(pregunta.nodeId ?? "") ?? 0.7;
          const acierta = azar() < caracter.base * facilidad + aprendizaje;

          const elegida = acierta
            ? correcta
            : (pregunta.options.filter((o) => !o.isCorrect)[
                Math.floor(azar() * Math.max(1, pregunta.options.length - 1))
              ] ?? correcta);

          if (acierta) buenas += 1;
          else malas += 1;

          const marca = aciertosPorPregunta.get(pregunta.id) ?? { total: 0, buenas: 0 };
          marca.total += 1;
          if (acierta) marca.buenas += 1;
          aciertosPorPregunta.set(pregunta.id, marca);

          filas.push({
            questionId: pregunta.id,
            position: posicion,
            selectedOptionId: elegida.id,
            isCorrect: acierta,
          });
        });

        if (filas.length === 0) continue;

        const total = buenas + malas + blancas;
        const porcentaje = total > 0 ? (buenas / total) * 100 : 0;

        await prismaBase.testAttempt.create({
          data: {
            academyId: academia.id,
            studentId: alumno.id,
            kind: "CUSTOM",
            status: "SUBMITTED",
            startedAt: new Date(cuando.getTime() - (6 + Math.floor(azar() * 14)) * 60_000),
            submittedAt: cuando,
            totalQuestions: total,
            correctCount: buenas,
            wrongCount: malas,
            blankCount: blancas,
            scorePercent: porcentaje.toFixed(2),
            timeSpentSeconds: 300 + Math.floor(azar() * 900),
            answers: {
              create: filas.map((f) => ({
                academyId: academia.id,
                questionId: f.questionId,
                position: f.position,
                selectedOptionId: f.selectedOptionId,
                isCorrect: f.isCorrect,
                answeredAt: cuando,
                timeSpentSeconds: 15 + Math.floor(azar() * 70),
              })),
            },
          },
        });

        intentos += 1;
        respuestas += filas.length;
      }
    }
  }

  /*
   * EL TEMARIO LEÍDO.
   *
   * Quien hace tests también abre temas, y sin esto el Campus enseñaba «0 de
   * 12» a alumnos con cuarenta tests hechos: un anillo de progreso vacío que
   * contradecía al resto de la pantalla.
   *
   * Se avanza en orden y proporcional a lo constante que sea cada alumno,
   * porque el temario se lee de arriba abajo, no salteado.
   */
  const temasDelTemario = await prismaBase.contentNode.findMany({
    where: { academyId: academia.id, kind: "TOPIC", deletedAt: null },
    select: { id: true },
    orderBy: [{ depth: "asc" }, { position: "asc" }],
  });

  await prismaBase.studentContentProgress.deleteMany({ where: { academyId: academia.id } });

  let leidos = 0;
  for (const [indice, alumno] of alumnos.entries()) {
    const caracter = CARACTERES[indice % CARACTERES.length];
    // Entre el 15 % y el 85 % del temario según el carácter, y menos aún si se
    // apagó por el camino.
    const parte = (caracter.base - 0.35) * 1.6 * (caracter.apagaEn === null ? 1 : 0.45);
    const cuantos = Math.max(1, Math.round(temasDelTemario.length * Math.max(0.12, parte)));

    for (let i = 0; i < cuantos && i < temasDelTemario.length; i += 1) {
      // El último queda a medias: es lo normal, y es lo que hace que el «sigue
      // por donde lo dejaste» tenga algo que decir.
      const aMedias = i === cuantos - 1;
      const cuando = new Date(ahora - Math.floor(azar() * SEMANAS * 7) * DIA);

      await prismaBase.studentContentProgress.create({
        data: {
          academyId: academia.id,
          studentId: alumno.id,
          nodeId: temasDelTemario[i].id,
          status: aMedias ? "IN_PROGRESS" : "COMPLETED",
          secondsSpent: 600 + Math.floor(azar() * 3000),
          reviewCount: 1 + Math.floor(azar() * 3),
          firstStartedAt: cuando,
          lastViewedAt: cuando,
          completedAt: aMedias ? null : cuando,
        },
      });
      leidos += 1;
    }
  }

  /*
   * Los contadores de cada pregunta.
   *
   * Se recalculan aquí en vez de dejar que los suba la aplicación porque estos
   * intentos no han pasado por ella: se han escrito directamente. Si no, el
   * banco de preguntas diría que nadie las ha contestado nunca y el «acierto
   * por tema» saldría vacío pese a haber treinta mil respuestas.
   */
  for (const [questionId, marca] of aciertosPorPregunta) {
    await prismaBase.question.update({
      where: { id: questionId },
      data: { timesAnswered: marca.total, timesCorrect: marca.buenas },
    });
  }

  // La última actividad de cada alumno, que es de donde sale el riesgo de
  // abandono. Sin esto, quien lleva seis semanas sin aparecer figura al día.
  for (const alumno of alumnos) {
    const ultimo = await prismaBase.testAttempt.findFirst({
      where: { academyId: academia.id, studentId: alumno.id },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    });
    if (ultimo?.submittedAt) {
      // Vive en el perfil de alumno, no en la matrícula: es donde lo lee
      // `loadRiesgoAbandono`.
      await prismaBase.studentProfile.updateMany({
        where: { membershipId: alumno.id },
        data: { lastActivityAt: ultimo.submittedAt },
      });
    }
  }

  console.log(`  ✓ ${intentos} intentos · ${respuestas} respuestas · ${SEMANAS} semanas`);
  console.log(`  ✓ ${leidos} temas leídos`);
  console.log(`  ✓ ${alumnos.length} alumnos, ${aciertosPorPregunta.size} preguntas con datos`);
  console.log("\n  La Analítica ya tiene de qué hablar.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
