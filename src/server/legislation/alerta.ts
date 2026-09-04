import type { LegislationChangeType } from "@/generated/prisma/enums";
import type { TenantClient } from "@/lib/db/tenant";

/**
 * ABRIR UNA ALERTA DE CAMBIO NORMATIVO
 *
 * Lo que pasa cuando cambia una ley: se mira qué contenido de la academia
 * dependía del artículo tocado, se guarda ese recuento dentro de la alerta y se
 * **marcan** las preguntas afectadas.
 *
 * Marcar, no cambiar (ADR-0013). Catedria no reescribe el material de un
 * preparador: lo señala y él decide. Una pregunta marcada pasa a
 * `POSSIBLY_OUTDATED` y deja de salir en los tests hasta que alguien la mire.
 *
 * Esto vive aparte porque ahora hay dos caminos hasta aquí y tienen que hacer
 * exactamente lo mismo: el alta manual, donde un preparador registra el cambio
 * que ha leído, y el radar, que lo detecta solo en el BOE. Si cada uno
 * calculara el impacto por su cuenta acabarían divergiendo, y el día que
 * divergieran nadie se daría cuenta.
 */

/** Lo que la alerta guarda sobre el contenido afectado. */
export type Impacto = {
  temas: { id: string; label: string }[];
  preguntas: { id: string; enunciado: string }[];
  totalTemas: number;
  totalPreguntas: number;
};

export type AlertaAbierta = {
  alertaId: string;
  impacto: Impacto;
  /// Cuántas preguntas pasaron a «posiblemente desactualizada».
  preguntasMarcadas: number;
};

/**
 * Abre la alerta y marca lo que dependía de la norma.
 *
 * @param officialId Identificador del anuncio oficial, si viene del radar. Es
 *   lo que evita abrir la misma alerta dos veces: el sumario de un día no
 *   cambia y reprocesarlo es normal.
 * @returns La alerta y su impacto, o `null` si ya había una para ese anuncio.
 */
export async function abrirAlertaDeCambio(
  db: TenantClient,
  datos: {
    legislationId: string;
    referencia: string;
    articleId?: string | null;
    changeType: LegislationChangeType;
    title: string;
    description?: string | null;
    previousText?: string | null;
    newText?: string | null;
    officialId?: string | null;
    officialUrl?: string | null;
  },
): Promise<AlertaAbierta | null> {
  if (datos.officialId) {
    const yaEstaba = await db.legislationChangeAlert.findFirst({
      where: {
        legislationId: datos.legislationId,
        officialId: datos.officialId,
      },
      select: { id: true },
    });
    if (yaEstaba) return null;
  }

  /*
   * El contenido que dependía de esto.
   *
   * Si el cambio señala un artículo concreto, solo lo enlazado a ese artículo.
   * Si no —que es lo normal cuando lo detecta el radar, porque el título del
   * BOE casi nunca baja al artículo—, todo lo enlazado a la norma. Es más
   * ruidoso y es lo correcto: preferimos que el preparador revise de más a que
   * una pregunta desactualizada siga saliendo en los tests.
   */
  const enlaces = await db.contentLegislationLink.findMany({
    where: datos.articleId
      ? { articleId: datos.articleId }
      : { article: { legislationId: datos.legislationId } },
    select: {
      node: { select: { id: true, label: true } },
      question: { select: { id: true, statement: true } },
    },
  });

  const temas = enlaces.filter((e) => e.node).map((e) => e.node!);
  const preguntas = enlaces.filter((e) => e.question).map((e) => e.question!);

  const impacto: Impacto = {
    temas: temas.map((t) => ({ id: t.id, label: t.label })),
    preguntas: preguntas.map((p) => ({
      id: p.id,
      enunciado: p.statement.slice(0, 120),
    })),
    totalTemas: temas.length,
    totalPreguntas: preguntas.length,
  };

  const alerta = await db.legislationChangeAlert.create({
    data: {
      legislationId: datos.legislationId,
      articleId: datos.articleId || null,
      changeType: datos.changeType,
      status: "OPEN",
      title: datos.title,
      description: datos.description || null,
      previousText: datos.previousText || null,
      newText: datos.newText || null,
      officialId: datos.officialId || null,
      officialUrl: datos.officialUrl || null,
      impact: impacto,
    },
  });

  // Solo las publicadas: una que ya estaba en borrador o marcada no gana nada
  // por volver a marcarse, y así el recuento que se enseña es el de verdad.
  let preguntasMarcadas = 0;
  if (preguntas.length > 0) {
    const r = await db.question.updateMany({
      where: { id: { in: preguntas.map((p) => p.id) }, status: "PUBLISHED" },
      data: {
        status: "POSSIBLY_OUTDATED",
        outdatedReason: `Cambio en ${datos.referencia}: ${datos.title}`,
        outdatedAt: new Date(),
      },
    });
    preguntasMarcadas = r.count;
  }

  return { alertaId: alerta.id, impacto, preguntasMarcadas };
}
