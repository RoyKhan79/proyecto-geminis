import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { BoeNoPublicadoError, coincide, fetchBoeOposiciones } from "./boe";

/**
 * MOTOR DEL RADAR
 *
 * Se ejecuta una vez al día desde `scripts/radar.ts`, lanzado por cron en el
 * servidor. La academia no necesita tener nada abierto.
 *
 * Flujo:
 *   1. se descarga el sumario del boletín una sola vez para TODAS las academias
 *      (no tiene sentido pedir lo mismo cien veces);
 *   2. se compara con las vigilancias configuradas por cada academia;
 *   3. lo que coincide se guarda como convocatoria detectada, con su academia;
 *   4. se avisa por correo a quien la academia haya indicado;
 *   5. nadie crea nada: la academia decide si la acepta (ADR-0023).
 *
 * El aislamiento se mantiene: aunque el boletín sea público y común, cada
 * `OfficialCall` pertenece a una academia y se guarda con `tenantDb`.
 */

export type ResultadoRadar = {
  fecha: string;
  itemsAnalizados: number;
  coincidencias: number;
  avisos: number;
  academias: number;
  saltado?: string;
  error?: string;
};

/**
 * Mira el BOE de hoy y avisa de las convocatorias que interesan.
 *
 * @returns Qué ha encontrado y para quién.
 * @remarks Lo lanza el cron cada mañana. Si el sumario aún no está publicado no
 *   es un fallo: se reintenta, no se avisa a nadie.
 */
export async function ejecutarRadarBoe(fecha: Date): Promise<ResultadoRadar> {
  const dia = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
  const etiqueta = dia.toISOString().slice(0, 10);

  // Si ya se analizó ese día, no se repite: el cron puede dispararse dos veces.
  const previa = await prismaBase.radarRun.findUnique({
    where: { source_bulletinDate: { source: "BOE", bulletinDate: dia } },
  });
  if (previa?.ok) {
    return {
      fecha: etiqueta,
      itemsAnalizados: previa.itemsScanned,
      coincidencias: previa.matches,
      avisos: previa.notified,
      academias: 0,
      saltado: "Ya se había analizado este boletín.",
    };
  }

  const run = await prismaBase.radarRun.upsert({
    where: { source_bulletinDate: { source: "BOE", bulletinDate: dia } },
    create: { source: "BOE", bulletinDate: dia },
    update: { startedAt: new Date(), ok: true, error: null },
  });

  let items;
  try {
    items = await fetchBoeOposiciones(dia);
  } catch (error) {
    const esFestivo = error instanceof BoeNoPublicadoError;
    await prismaBase.radarRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        // Un festivo no es un fallo: el BOE simplemente no publica.
        ok: esFestivo,
        error: esFestivo ? null : (error as Error).message,
      },
    });
    return {
      fecha: etiqueta,
      itemsAnalizados: 0,
      coincidencias: 0,
      avisos: 0,
      academias: 0,
      ...(esFestivo
        ? { saltado: "El BOE no publicó ese día." }
        : { error: (error as Error).message }),
    };
  }

  /*
   * Solo las academias que pagan el radar.
   *
   * «Normativa y radar del BOE» es un módulo de pago, y esta tarea corre en el
   * servidor sin pasar por `requireAcademy`, que es quien comprueba los módulos
   * en el resto de la aplicación. Sin este filtro, una academia que dejara de
   * pagarlo seguiría recibiendo los avisos por correo cada mañana: el módulo
   * desaparecería de su menú y seguiría funcionando por detrás.
   */
  const vigilancias = await prismaBase.oppositionWatch.findMany({
    where: {
      isActive: true,
      academy: {
        deletedAt: null,
        status: { in: ["ACTIVE", "TRIAL"] },
        modules: { some: { module: "NORMATIVA", active: true } },
      },
    },
    select: {
      id: true,
      academyId: true,
      name: true,
      keywords: true,
      excludeKeywords: true,
      requireCallPhrase: true,
      sources: true,
      notifyEmails: true,
      oppositionId: true,
      academy: { select: { id: true, name: true, email: true } },
    },
  });

  let coincidencias = 0;
  let avisos = 0;
  const academiasTocadas = new Set<string>();

  // Se agrupan los hallazgos por academia para mandar UN correo con todo, no
  // uno por convocatoria: nadie quiere doce correos un martes.
  const porAcademia = new Map<
    string,
    {
      academia: { id: string; name: string; email: string | null };
      hallazgos: { vigilancia: string; titulo: string; url: string | null }[];
      correos: Set<string>;
    }
  >();

  for (const vigilancia of vigilancias) {
    if (vigilancia.sources.length > 0 && !vigilancia.sources.includes("BOE")) {
      continue;
    }

    const db = tenantDb(vigilancia.academyId);

    for (const item of items) {
      if (!coincide(item, vigilancia)) continue;

      // Puede coincidir con dos vigilancias de la misma academia: se guarda una
      // sola vez gracias al índice único (academyId, externalId).
      const yaEstaba = await db.officialCall.findFirst({
        where: { externalId: item.externalId },
        select: { id: true },
      });
      if (yaEstaba) continue;

      await db.officialCall.create({
        data: {
          watchId: vigilancia.id,
          source: "BOE",
          externalId: item.externalId,
          title: item.title,
          summary: item.epigraph,
          department: item.department,
          publishedAt: item.publishedAt,
          url: item.url,
          pdfUrl: item.pdfUrl,
          status: "NEW",
          notifiedAt: new Date(),
        },
      });

      coincidencias += 1;
      academiasTocadas.add(vigilancia.academyId);

      const entrada = porAcademia.get(vigilancia.academyId) ?? {
        academia: vigilancia.academy,
        hallazgos: [],
        correos: new Set<string>(),
      };
      entrada.hallazgos.push({
        vigilancia: vigilancia.name,
        titulo: item.title,
        url: item.url,
      });
      for (const correo of vigilancia.notifyEmails) entrada.correos.add(correo);
      if (vigilancia.notifyEmails.length === 0 && vigilancia.academy.email) {
        entrada.correos.add(vigilancia.academy.email);
      }
      porAcademia.set(vigilancia.academyId, entrada);
    }
  }

  for (const entrada of porAcademia.values()) {
    if (entrada.correos.size === 0) continue;

    const cuerpo = [
      `Han salido ${entrada.hallazgos.length} convocatorias que encajan con lo que preparáis:`,
      "",
      ...entrada.hallazgos.map(
        (h) => `· [${h.vigilancia}] ${h.titulo}\n  ${h.url ?? ""}`,
      ),
      "",
      `Revísalas en Proyecto Geminis: ${env.APP_URL}/gestion/convocatorias`,
      "",
      "No se ha creado ninguna oposición: lo decides tú.",
    ].join("\n");

    for (const correo of entrada.correos) {
      const enviado = await sendEmail({
        to: correo,
        subject: `Nuevas convocatorias en el BOE (${entrada.hallazgos.length})`,
        text: cuerpo,
      });
      if (enviado) avisos += 1;
    }
  }

  await prismaBase.radarRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      itemsScanned: items.length,
      matches: coincidencias,
      notified: avisos,
      ok: true,
    },
  });

  return {
    fecha: etiqueta,
    itemsAnalizados: items.length,
    coincidencias,
    avisos,
    academias: academiasTocadas.size,
  };
}
