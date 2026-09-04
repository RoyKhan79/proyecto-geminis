import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import type { ItemBoletin } from "@/server/radar/boe";
import { SECCION_DISPOSICIONES } from "@/server/radar/boe";
import { abrirAlertaDeCambio } from "./alerta";
import { articulosCitados, detectarCambio } from "./deteccion";

/**
 * RADAR DE NORMATIVA
 *
 * La otra mitad del radar. El de convocatorias lee «II.B Oposiciones y
 * concursos»; éste lee «I. Disposiciones generales», que es donde cambian las
 * leyes y donde hasta ahora no miraba nadie. Una academia se enteraba de que
 * habían modificado la Ley 39/2015 cuando se lo decía un alumno.
 *
 * Se ejecuta dentro de la misma pasada diaria y sobre el mismo sumario, que se
 * descarga una sola vez.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No toca el material de nadie (ADR-0013). Abre una alerta con el impacto
 * calculado —qué temas y qué preguntas dependían de esa norma— y marca las
 * preguntas como «posiblemente desactualizada», que las saca de los tests hasta
 * que una persona las mire. Quien decide qué se cambia es el preparador.
 *
 * No lee el texto de la norma, solo el título del anuncio. Y eso tiene un
 * límite medido, que conviene conocer antes de fiarse:
 *
 * Probado contra el sumario real del BOE del 30 y 31 de marzo de 2021, detecta
 * cinco de los seis cambios de esos dos días. El que se le escapa es el Real
 * Decreto 203/2021, que modifica la Ley 39/2015 en su articulado pero cuyo
 * título en el sumario dice solo «por el que se aprueba el Reglamento de
 * actuación y funcionamiento del sector público por medios electrónicos». La
 * ley modificada no aparece por ningún lado.
 *
 * Así que **esto no sustituye a leer el BOE**, y la alerta lo dice: coge lo
 * frecuente —el título nombra la norma que cambia, que es como se redactan casi
 * todas las modificaciones— y no coge lo que va enterrado en el articulado.
 * Cogerlo exigiría descargar y comparar los textos consolidados, que es otro
 * problema y otro coste.
 *
 * ── EL AISLAMIENTO ─────────────────────────────────────────────────────────
 *
 * El boletín es público y común, pero cada norma es de una academia (§92): dos
 * academias mantienen su propia ficha de la misma ley sin compartir nada. Por
 * eso se recorre academia por academia y se escribe siempre con `tenantDb`.
 */

export type ResultadoNormativa = {
  /// Anuncios de la sección I que se han mirado.
  disposiciones: number;
  /// Academias con al menos una norma en seguimiento.
  academias: number;
  /// Alertas abiertas en esta pasada. No cuenta las que ya existían.
  alertas: number;
  /// Preguntas que han pasado a «posiblemente desactualizada».
  preguntasMarcadas: number;
};

/**
 * Mira los anuncios de un día y abre alertas donde toque.
 *
 * @param items El sumario ya descargado, tal como lo devuelve el adaptador del
 *   BOE. Se filtran aquí los de la sección I, para que quien llama no tenga que
 *   saber de secciones.
 * @returns Qué ha encontrado y a quién afecta.
 */
export async function revisarDisposiciones(
  items: ItemBoletin[],
  opciones: {
    /// Limitar a estas academias. Sin esto, todas las que tengan el módulo.
    /// Sirve para reprocesar una academia concreta sin tocar a las demás.
    academyIds?: string[];
  } = {},
): Promise<ResultadoNormativa> {
  const disposiciones = items.filter((i) => i.section === SECCION_DISPOSICIONES);

  const resultado: ResultadoNormativa = {
    disposiciones: disposiciones.length,
    academias: 0,
    alertas: 0,
    preguntasMarcadas: 0,
  };

  if (disposiciones.length === 0) return resultado;

  /*
   * Las normas en seguimiento de todas las academias, de una vez.
   *
   * Se leen con el cliente sin guardia porque esto es una tarea del sistema que
   * atraviesa academias a propósito, igual que el radar de convocatorias. Lo
   * que nunca se atraviesa es la escritura: cada alerta se crea con `tenantDb`
   * de su academia.
   *
   * Las derogadas quedan fuera: una norma que la academia ya ha dado por
   * derogada no necesita que le avisen otra vez.
   *
   * tenant-ok: cruza academias a propósito. Es una tarea del sistema lanzada
   * por cron, sin sesión y sin academia actual, y el sumario del BOE es uno
   * solo para todas. Lo que nunca cruza es la escritura: cada alerta se crea
   * con `tenantDb` de la academia dueña de la norma.
   */
  const normas = await prismaBase.legislation.findMany({
    where: {
      deletedAt: null,
      status: { not: "REPEALED" },
      /*
       * Solo las academias que pagan el módulo.
       *
       * Es el mismo filtro que el radar de convocatorias y por el mismo motivo:
       * esta tarea corre en el servidor sin pasar por `requireAcademy`, que es
       * quien comprueba los módulos en el resto de la aplicación. Sin esto, una
       * academia que dejara de pagar «Normativa y radar del BOE» vería
       * desaparecer el módulo de su menú y seguiría recibiendo alertas por
       * detrás.
       */
      academy: {
        deletedAt: null,
        status: { in: ["ACTIVE", "TRIAL"] },
        modules: { some: { module: "NORMATIVA", active: true } },
        ...(opciones.academyIds ? { id: { in: opciones.academyIds } } : {}),
      },
    },
    select: { id: true, academyId: true, reference: true },
  });
  if (normas.length === 0) return resultado;

  const porAcademia = new Map<string, typeof normas>();
  for (const norma of normas) {
    const lista = porAcademia.get(norma.academyId);
    if (lista) lista.push(norma);
    else porAcademia.set(norma.academyId, [norma]);
  }
  resultado.academias = porAcademia.size;

  for (const [academyId, suyas] of porAcademia) {
    const db = tenantDb(academyId);

    for (const item of disposiciones) {
      for (const norma of suyas) {
        const cambio = detectarCambio(item.title, norma.reference);
        if (!cambio) continue;

        /*
         * Si el título dice qué artículo cambia, se busca en la ficha de la
         * academia para acotar el impacto a ese artículo. Si no lo dice —lo
         * habitual— la alerta va sobre la norma entera, que es más ruidoso y es
         * lo correcto: mejor revisar de más que dejar una pregunta
         * desactualizada saliendo en los tests.
         */
        const citados = articulosCitados(item.title);
        let articleId: string | null = null;
        if (citados.length > 0) {
          const articulo = await db.legislationArticle.findFirst({
            where: { legislationId: norma.id, number: { in: citados } },
            select: { id: true },
          });
          articleId = articulo?.id ?? null;
        }

        const abierta = await abrirAlertaDeCambio(db, {
          legislationId: norma.id,
          referencia: norma.reference,
          articleId,
          changeType: cambio.tipo,
          // Sin repetir la referencia: la alerta se enseña siempre junto a
          // su norma, y al marcar las preguntas se antepone «Cambio en Ley
          // 39/2015: …», que con la referencia dentro quedaba dos veces.
          title: `${cambio.motivo[0].toUpperCase()}${cambio.motivo.slice(1)} publicada en el BOE`,
          description:
            `Detectado por el radar en «${item.title}».\n\n` +
            `Lo que lo delata en el título: ${cambio.motivo}. ` +
            "Compruébalo antes de dar el cambio por bueno: el radar lee el " +
            "título del anuncio, no el texto de la norma.",
          officialId: item.externalId,
          officialUrl: item.url ?? item.pdfUrl,
        });

        // Nulo significa que ya había alerta para ese anuncio. Es lo normal si
        // se reprocesa un día, y no es un fallo.
        if (!abierta) continue;

        resultado.alertas += 1;
        resultado.preguntasMarcadas += abierta.preguntasMarcadas;
      }
    }
  }

  return resultado;
}
