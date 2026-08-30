import type { TenantClient } from "@/lib/db/tenant";
import type { StudentGrants } from "@/lib/access/content-access";
import { studentNodeWhere } from "@/lib/access/content-access";

/**
 * GEMINIS IA · lo que propone por su cuenta
 *
 * Un asistente que solo responde cuando le preguntan no sirve de mucho: el
 * alumno que va mal es precisamente el que no pregunta. Esto mira sus datos
 * cada vez que entra y le dice qué le conviene hacer hoy y por qué.
 *
 * Reglas que se ha impuesto:
 *   · Cada propuesta dice su motivo. «Estudia el tema 4» sin más no lo hace
 *     nadie; «llevas 12 fallos de 20 en el tema 4» sí.
 *   · Nada sale de material que no tenga contratado y abierto (ADR-0008).
 *   · Como máximo tres propuestas. Una lista de quince es una lista que se
 *     ignora entera.
 *   · Si no hay nada urgente, se calla en vez de rellenar.
 *
 * No hay ningún modelo de por medio: son sus propios datos leídos con criterio.
 * Es más fiable que pedirle a un modelo que adivine, y no cuesta nada.
 */

export type Propuesta = {
  clave: string;
  titulo: string;
  /// Por qué se propone. Siempre con el dato concreto que lo justifica.
  motivo: string;
  accion: { texto: string; href: string };
  urgencia: "alta" | "media" | "baja";
  tono: "critical" | "caution" | "positive" | "neutral";
};

const PESO: Record<Propuesta["urgencia"], number> = { alta: 0, media: 1, baja: 2 };

/**
 * Qué le conviene estudiar hoy a este alumno, y **por qué**.
 *
 * @returns Las propuestas, cada una con su motivo: repasos que tocan, temas
 *   recién abiertos, lo que lleva fallando. El motivo no es adorno: una
 *   recomendación sin explicación no se sigue, se ignora.
 */
export async function proponerPlanDelDia(params: {
  db: TenantClient;
  academyId: string;
  studentId: string;
  grants: StudentGrants;
  ahora: Date;
}): Promise<Propuesta[]> {
  const { db, studentId, grants, ahora } = params;
  const propuestas: Propuesta[] = [];

  const inicioDeHoy = new Date(ahora);
  inicioDeHoy.setHours(23, 59, 59, 999);

  const [vencidas, flojos, recienAbiertos, ultimoIntento, tareas] =
    await Promise.all([
      // 1 · Repaso programado que ya toca.
      db.studentQuestionStat.count({
        where: { studentId, nextReviewAt: { not: null, lte: inicioDeHoy } },
      }),

      // 2 · Dónde falla más. Se agrupa por pregunta y se resuelve el tema
      //     después: agrupar por tema en SQL obligaría a un join que Prisma no
      //     hace en groupBy.
      db.studentQuestionStat.findMany({
        where: { studentId, timesWrong: { gte: 1 } },
        orderBy: { timesWrong: "desc" },
        take: 120,
        select: {
          timesWrong: true,
          timesSeen: true,
          question: { select: { node: { select: { id: true, label: true } } } },
        },
      }),

      // 3 · Lo que el profesor ha abierto esta semana.
      db.contentRelease.findMany({
        where: {
          isOpen: true,
          releasedAt: {
            gte: new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000),
            lte: ahora,
          },
          ...(grants.groupIds.length > 0
            ? { OR: [{ groupId: null }, { groupId: { in: grants.groupIds } }] }
            : { groupId: null }),
        },
        orderBy: { releasedAt: "desc" },
        take: 5,
        select: { nodeId: true, node: { select: { id: true, label: true } } },
      }),

      // 4 · Cuándo hizo el último test.
      db.testAttempt.findFirst({
        where: { studentId, status: { in: ["SUBMITTED", "EXPIRED"] } },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),

      // 5 · Entregas con fecha encima.
      db.submission.findMany({
        where: {
          studentId,
          status: { in: ["PENDING", "RETURNED"] },
          assignment: {
            dueAt: {
              gte: ahora,
              lte: new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000),
            },
          },
        },
        take: 3,
        select: {
          id: true,
          assignment: { select: { id: true, title: true, dueAt: true } },
        },
      }),
    ]);

  if (vencidas > 0) {
    propuestas.push({
      clave: "repaso",
      titulo: `${vencidas} ${vencidas === 1 ? "pregunta te toca" : "preguntas te tocan"} hoy`,
      motivo:
        "Son preguntas que ya has visto y que hoy estás a punto de olvidar. Repasarlas ahora cuesta un minuto; dentro de un mes hay que volver a estudiarlas.",
      accion: { texto: "Repasar ahora", href: "/campus/tests?modo=repaso" },
      urgencia: "alta",
      tono: "caution",
    });
  }

  // Tema más flojo, exigiendo un mínimo de intentos: con 2 preguntas falladas
  // no se puede decir que alguien lleve mal un tema.
  const porTema = new Map<string, { label: string; fallos: number; vistas: number }>();
  for (const stat of flojos) {
    const nodo = stat.question.node;
    if (!nodo) continue;
    const actual = porTema.get(nodo.id) ?? { label: nodo.label, fallos: 0, vistas: 0 };
    actual.fallos += stat.timesWrong;
    actual.vistas += stat.timesSeen;
    porTema.set(nodo.id, actual);
  }

  const peor = [...porTema.entries()]
    .filter(([, t]) => t.vistas >= 6)
    .map(([id, t]) => ({ id, ...t, ratio: t.fallos / Math.max(1, t.vistas) }))
    .sort((a, b) => b.ratio - a.ratio)[0];

  if (peor && peor.ratio >= 0.35) {
    propuestas.push({
      clave: `flojo:${peor.id}`,
      titulo: `Tu punto flojo ahora mismo es «${peor.label}»`,
      motivo: `Llevas ${peor.fallos} fallos de ${peor.vistas} respuestas en ese tema, un ${Math.round(peor.ratio * 100)}%. Es el que más nota te está costando.`,
      accion: {
        texto: "Preguntar sobre este tema",
        href: `/campus/ia?tema=${peor.id}`,
      },
      urgencia: peor.ratio >= 0.5 ? "alta" : "media",
      tono: peor.ratio >= 0.5 ? "critical" : "caution",
    });
  }

  // De lo recién abierto solo se propone lo que realmente puede ver.
  if (recienAbiertos.length > 0) {
    const visibles = await db.contentNode.findMany({
      where: {
        id: { in: recienAbiertos.map((r) => r.nodeId) },
        // La hora de referencia va como argumento, no en un segundo `spread`
        // que pisaba la clave `AND` del primero (ver H-07).
        ...studentNodeWhere(grants, ahora),
      },
      select: { id: true, label: true },
    });

    if (visibles.length > 0) {
      const primero = visibles[0];
      propuestas.push({
        clave: `nuevo:${primero.id}`,
        titulo:
          visibles.length === 1
            ? `Tu profesor ha abierto «${primero.label}»`
            : `Tu profesor ha abierto ${visibles.length} temas nuevos`,
        motivo:
          "Se han publicado esta semana. Ir al día con lo que abre el profesor es lo que evita el atracón de final de curso.",
        accion: { texto: "Ir al temario", href: `/campus/estudiar/${primero.id}` },
        urgencia: "media",
        tono: "positive",
      });
    }
  }

  if (tareas.length > 0) {
    const tarea = tareas[0];
    const dias = Math.max(
      0,
      Math.ceil(
        ((tarea.assignment.dueAt?.getTime() ?? 0) - ahora.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );
    propuestas.push({
      clave: `tarea:${tarea.assignment.id}`,
      titulo: `«${tarea.assignment.title}» ${dias === 0 ? "vence hoy" : `vence en ${dias} ${dias === 1 ? "día" : "días"}`}`,
      motivo: "Todavía no la has entregado.",
      accion: { texto: "Ver la tarea", href: `/campus/tareas/${tarea.assignment.id}` },
      urgencia: dias <= 1 ? "alta" : "media",
      tono: dias <= 1 ? "critical" : "caution",
    });
  }

  // La inactividad solo se menciona si no hay nada más urgente que decir: a
  // quien está trabajando no se le regaña por la semana pasada.
  if (propuestas.length === 0) {
    const dias = ultimoIntento?.submittedAt
      ? Math.floor(
          (ahora.getTime() - ultimoIntento.submittedAt.getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

    if (dias === null) {
      propuestas.push({
        clave: "primer-test",
        titulo: "Todavía no has hecho ningún test",
        motivo:
          "Hasta que no hagas uno no puedo saber por dónde vas ni proponerte nada con criterio. Con veinte preguntas basta para empezar.",
        accion: { texto: "Hacer mi primer test", href: "/campus/tests" },
        urgencia: "media",
        tono: "neutral",
      });
    } else if (dias >= 5) {
      propuestas.push({
        clave: "inactivo",
        titulo: `Llevas ${dias} días sin hacer un test`,
        motivo:
          "No pasa nada por parar, pero cuanto más se alarga más cuesta retomarlo. Uno corto de diez preguntas y vuelves a estar dentro.",
        accion: { texto: "Test rápido", href: "/campus/tests" },
        urgencia: "media",
        tono: "caution",
      });
    }
  }

  return propuestas
    .sort((a, b) => PESO[a.urgencia] - PESO[b.urgencia])
    .slice(0, 3);
}

/**
 * Cómo lleva el alumno el tema por el que está preguntando.
 *
 * Sirve para que el asistente no responda igual a quien domina el tema que a
 * quien lleva la mitad fallada. Es la diferencia entre un buscador y alguien
 * que te conoce, y es barato: los datos ya están.
 */
export async function comoLlevaElTema(params: {
  db: TenantClient;
  studentId: string;
  nodeId: string;
}): Promise<{ vistas: number; fallos: number; ratio: number } | null> {
  const stats = await params.db.studentQuestionStat.findMany({
    where: { studentId: params.studentId, question: { nodeId: params.nodeId } },
    select: { timesSeen: true, timesWrong: true },
  });

  if (stats.length === 0) return null;

  const vistas = stats.reduce((s, x) => s + x.timesSeen, 0);
  const fallos = stats.reduce((s, x) => s + x.timesWrong, 0);

  // Con menos de seis respuestas no se puede decir nada de nadie.
  if (vistas < 6) return null;

  return { vistas, fallos, ratio: fallos / vistas };
}
