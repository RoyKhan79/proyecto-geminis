import type { OfficialSource } from "@/generated/prisma/enums";

/**
 * ADAPTADOR DEL BOE
 *
 * Lee el sumario de un día desde los datos abiertos del BOE y devuelve los
 * anuncios de la sección de oposiciones y concursos.
 *
 * https://www.boe.es/datosabiertos/
 *
 * La estructura del sumario tiene una peculiaridad que obliga a normalizar: los
 * campos que pueden repetirse llegan como objeto cuando hay uno solo y como
 * array cuando hay varios. Si no se normaliza, un día con un único ministerio
 * rompe el radar.
 */

export type ItemBoletin = {
  source: OfficialSource;
  externalId: string;
  title: string;
  department: string | null;
  epigraph: string | null;
  url: string | null;
  pdfUrl: string | null;
  publishedAt: Date;
};

/** Convierte en array lo que puede venir suelto o repetido. */
function lista<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

type Enlace = { texto?: string } | string | undefined;

function enlace(valor: Enlace): string | null {
  if (!valor) return null;
  if (typeof valor === "string") return valor;
  return valor.texto ?? null;
}

/**
 * La fecha en el formato que pide la dirección del BOE.
 *
 * @returns `AAAAMMDD` en hora **local**. Con `toISOString()`, a partir de las
 *   diez de la noche en España se pediría el sumario del día siguiente, que aún
 *   no existe.
 */
export function formatoFechaBoe(fecha: Date): string {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * El BOE de ese día todavía no está publicado.
 *
 * Es un caso normal, no un fallo: el sumario sale por la mañana, y si el radar
 * corre antes hay que reintentar, no avisar a nadie. Por eso es un error propio
 * y no uno genérico.
 */
export class BoeNoPublicadoError extends Error {
  constructor(fecha: string) {
    super(`El BOE del ${fecha} no está disponible (festivo o aún sin publicar).`);
    this.name = "BoeNoPublicadoError";
  }
}

/**
 * Descarga el sumario del BOE de un día y devuelve los anuncios de la sección
 * «II.B Oposiciones y concursos», que es donde salen las convocatorias.
 */
export async function fetchBoeOposiciones(fecha: Date): Promise<ItemBoletin[]> {
  const dia = formatoFechaBoe(fecha);
  const url = `https://boe.es/datosabiertos/api/boe/sumario/${dia}`;

  const respuesta = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ProyectoGeminis/1.0" },
    // El BOE puede tardar; si no responde en 30 s, se reintenta mañana.
    signal: AbortSignal.timeout(30_000),
  });

  if (respuesta.status === 404) throw new BoeNoPublicadoError(dia);
  if (!respuesta.ok) {
    throw new Error(`El BOE ha respondido ${respuesta.status} para el día ${dia}.`);
  }

  const json = (await respuesta.json()) as {
    data?: { sumario?: { diario?: unknown } };
  };

  const diarios = lista(json.data?.sumario?.diario) as {
    seccion?: unknown;
  }[];

  const items: ItemBoletin[] = [];

  for (const diario of diarios) {
    for (const seccion of lista(diario.seccion) as {
      codigo?: string;
      nombre?: string;
      departamento?: unknown;
    }[]) {
      // 2B = «II. Autoridades y personal - B. Oposiciones y concursos».
      // Es la sección donde aparecen las convocatorias; la 2A son nombramientos.
      if (seccion.codigo !== "2B") continue;

      for (const departamento of lista(seccion.departamento) as {
        nombre?: string;
        epigrafe?: unknown;
        item?: unknown;
      }[]) {
        const epigrafes = lista(departamento.epigrafe) as {
          nombre?: string;
          item?: unknown;
        }[];

        const sueltos = lista(departamento.item) as Record<string, unknown>[];

        const conEpigrafe = epigrafes.flatMap((epigrafe) =>
          (lista(epigrafe.item) as Record<string, unknown>[]).map((item) => ({
            item,
            epigrafe: epigrafe.nombre ?? null,
          })),
        );

        for (const { item, epigrafe } of [
          ...conEpigrafe,
          ...sueltos.map((item) => ({ item, epigrafe: null })),
        ]) {
          const identificador = String(item.identificador ?? "").trim();
          const titulo = String(item.titulo ?? "").trim();
          if (!identificador || !titulo) continue;

          items.push({
            source: "BOE",
            externalId: identificador,
            title: titulo,
            department: departamento.nombre ?? null,
            epigraph: epigrafe,
            url: enlace(item.url_html as Enlace),
            pdfUrl: enlace(item.url_pdf as Enlace),
            publishedAt: new Date(
              Date.UTC(
                fecha.getUTCFullYear(),
                fecha.getUTCMonth(),
                fecha.getUTCDate(),
              ),
            ),
          });
        }
      }
    }
  }

  return items;
}

/**
 * ¿Este anuncio interesa a esta vigilancia?
 *
 * Coincidencia por palabras, sin acentos ni mayúsculas. Se comprueban también
 * las palabras de descarte, que son las que quitan el ruido: el BOE publica
 * muchas más resoluciones de trámite («lista definitiva de admitidos»,
 * «nombramiento de funcionarios») que convocatorias nuevas.
 */
export function coincide(
  item: ItemBoletin,
  vigilancia: {
    keywords: string[];
    excludeKeywords: string[];
    requireCallPhrase?: boolean;
  },
): boolean {
  if (vigilancia.keywords.length === 0) return false;

  const texto = normaliza(
    [item.title, item.department, item.epigraph].filter(Boolean).join(" "),
  );

  const incluye = vigilancia.keywords.some((clave) => {
    const limpia = normaliza(clave);
    return limpia.length > 2 && texto.includes(limpia);
  });
  if (!incluye) return false;

  const descarta = vigilancia.excludeKeywords.some((clave) => {
    const limpia = normaliza(clave);
    return limpia.length > 2 && texto.includes(limpia);
  });
  if (descarta) return false;

  // El BOE publica muchísimos trámites de procesos ya convocados. Sin esta
  // condición, la academia recibiría cada mañana correcciones de erratas y
  // listas de admitidos, y dejaría de leer los avisos en una semana.
  if (vigilancia.requireCallPhrase !== false) {
    return FRASES_DE_CONVOCATORIA.some((frase) => texto.includes(normaliza(frase)));
  }

  return true;
}

/** Fórmulas con las que el BOE anuncia que se convocan plazas nuevas. */
export const FRASES_DE_CONVOCATORIA = [
  "se convoca",
  "se convocan",
  "por la que se anuncia convocatoria",
  "convocatoria de proceso selectivo",
  "convocatoria del proceso selectivo",
  "proceso selectivo para el ingreso",
  "proceso selectivo para ingreso",
  "pruebas selectivas para el ingreso",
  "pruebas selectivas para ingreso",
  "oferta de empleo publico",
];

/**
 * Palabras que casi siempre indican trámite y no convocatoria nueva.
 * Se usan como valor por defecto al crear una vigilancia; la academia las puede
 * cambiar.
 */
export const DESCARTES_HABITUALES = [
  "nombramiento",
  "cese",
  "lista definitiva",
  "relacion definitiva",
  "lista provisional",
  "relacion provisional",
  "resuelve parcialmente",
  "se resuelve la convocatoria",
  "adjudicacion de destinos",
  "toma de posesion",
  "corrigen errores",
  "correccion de errores",
  "personas aprobadas",
  "aspirantes que han superado",
  "tribunal calificador",
  "se hace publica la relacion",
];

function normaliza(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
