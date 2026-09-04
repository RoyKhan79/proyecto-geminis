/**
 * EL RADAR, CON VIGILANCIAS Y UNA PASADA DE VERDAD
 * ───────────────────────────────────────────────
 *   npm run demo:radar              → vigilancias + últimos 14 días del BOE
 *   npm run demo:radar -- --dias 30 → mira más atrás
 *
 * La pantalla de Convocatorias salía completamente vacía en la demo: sin
 * vigilancias, sin convocatorias y con el aviso de «el radar todavía no se ha
 * ejecutado». Justo debajo, el manual comercial afirmaba que ahí se ve «una
 * convocatoria detectada de verdad en el BOE». Una cosa o la otra.
 *
 * Esto crea las dos vigilancias que corresponden a las oposiciones de la demo y
 * **lanza el radar contra el BOE real**. No se inventa ninguna convocatoria: lo
 * que aparezca habrá salido publicado de verdad, y si esos días no hubo nada de
 * lo vigilado, la pantalla lo dirá con honestidad.
 *
 * Se mira una quincena hacia atrás y no solo el día de hoy porque una
 * convocatoria concreta no sale todos los días: con un solo boletín, lo normal
 * es no encontrar nada y volver a tener la pantalla vacía.
 *
 * NECESITA INTERNET. Sin conexión avisa y no rompe la siembra: es lo último de
 * `demo:todo` justamente para eso.
 */
import { prismaBase } from "@/lib/db/client";
import { DESCARTES_HABITUALES } from "@/server/radar/boe";
import { ejecutarRadarBoe } from "@/server/radar/service";

const SLUG = process.env.DEMO_SLUG ?? "catedria-demo";

/**
 * Las vigilancias de la demo.
 *
 * Las palabras son las que pondría una academia de verdad, no una lista
 * exhaustiva: se busca por CUALQUIERA de ellas, así que meter veinte sinónimos
 * solo trae ruido.
 *
 * ── LAS DE EXCLUSIÓN SALEN DEL PRODUCTO, NO DE AQUÍ ───────────────────────
 *
 * Aquí había una lista escrita a mano, y la primera pasada trajo una
 * «ampliación del plazo para aprobar la relación provisional de admitidos»: un
 * trámite, no una convocatoria. `DESCARTES_HABITUALES` —lo que el sistema pone
 * por defecto al crear una vigilancia— ya incluye «relación provisional» y lo
 * habría descartado.
 *
 * Es decir: el radar traía la configuración correcta y yo la sustituí por una
 * peor. La demo usa ahora la de serie, que además es lo honesto: enseña lo que
 * se encuentra una academia el primer día, no una lista afinada a mano para que
 * la captura quede bonita.
 */
const VIGILANCIAS = [
  {
    oposicion: "administrativo-estado",
    name: "Administrativo del Estado",
    keywords: [
      "Cuerpo General Administrativo",
      "Administración General del Estado",
      "Administrativo del Estado",
    ],
    excludeKeywords: DESCARTES_HABITUALES,
  },
  {
    oposicion: "maestros-educacion-primaria",
    name: "Maestros · Educación Primaria",
    /*
     * Aquí llegó a estar «funcionarios docentes», y la primera pasada trajo una
     * convocatoria de Catedráticos de Música de Canarias. El radar hizo lo
     * correcto —el epígrafe del BOE es literalmente «Cuerpos de funcionarios
     * docentes»—; la palabra era mía y era demasiado ancha.
     *
     * Queda escrito como aviso: en este radar el ruido casi nunca es del
     * programa, es de la lista de palabras. Por eso la pantalla deja editarlas.
     */
    keywords: ["Cuerpo de Maestros", "Educación Primaria"],
    excludeKeywords: DESCARTES_HABITUALES,
  },
];

function dias(argv: string[]): number {
  const i = argv.indexOf("--dias");
  const n = i >= 0 ? Number(argv[i + 1]) : 14;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 14;
}

async function main() {
  console.log(`\nRADAR DE LA DEMO\n${"=".repeat(60)}`);

  const academia = await prismaBase.academy.findFirst({
    where: { slug: SLUG },
    select: { id: true, name: true },
  });
  if (!academia) {
    console.log(`  · No existe la academia «${SLUG}». No se hace nada.`);
    return;
  }

  // ── Las vigilancias ───────────────────────────────────────────────────────
  for (const v of VIGILANCIAS) {
    const oposicion = await prismaBase.opposition.findFirst({
      where: { academyId: academia.id, slug: v.oposicion },
      select: { id: true },
    });

    const existe = await prismaBase.oppositionWatch.findFirst({
      where: { academyId: academia.id, name: v.name },
      select: { id: true },
    });

    const datos = {
      name: v.name,
      keywords: v.keywords,
      excludeKeywords: v.excludeKeywords,
      sources: ["BOE" as const],
      oppositionId: oposicion?.id ?? null,
      requireCallPhrase: true,
      isActive: true,
    };

    if (existe) {
      await prismaBase.oppositionWatch.update({ where: { id: existe.id }, data: datos });
    } else {
      await prismaBase.oppositionWatch.create({
        data: { academyId: academia.id, ...datos },
      });
    }
    console.log(`  ✓ Vigilancia «${v.name}» · ${v.keywords.length} palabras`);
  }

  // ── La pasada, contra el BOE real ─────────────────────────────────────────
  const cuantos = dias(process.argv.slice(2));
  /*
   * `--rehacer` borra las pasadas y lo encontrado antes de empezar.
   *
   * El radar es idempotente a propósito: si ya analizó un boletín no lo vuelve
   * a mirar, porque el cron puede dispararse dos veces. Eso está bien en
   * producción y estorba aquí, donde se cambian las palabras y hay que volver a
   * pasar los mismos días.
   */
  if (process.argv.includes("--rehacer")) {
    await prismaBase.officialCall.deleteMany({ where: { academyId: academia.id } });
    await prismaBase.radarRun.deleteMany({});
    console.log("  · Se borran las pasadas anteriores para repetirlas.");
  }

  console.log(`\n  Mirando los últimos ${cuantos} días del BOE…`);

  const hoy = new Date();
  let analizados = 0;
  let encontradas = 0;
  let fallos = 0;

  /*
   * Del más antiguo al más reciente, no al revés.
   *
   * La pantalla enseña «última revisión» leyendo la pasada más nueva. Yendo
   * hacia atrás, la última que se ejecuta es la del boletín más viejo, y la
   * academia lee que el radar va un mes retrasado. En producción el cron avanza
   * un día cada mañana; aquí se recorre en el mismo sentido para que el estado
   * final sea el mismo.
   */
  for (let i = cuantos - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
    try {
      const r = await ejecutarRadarBoe(fecha);
      if (r.error) {
        fallos += 1;
        // Solo se enseña el primero: veinte líneas de «sin conexión» no aportan.
        if (fallos === 1) console.log(`  ✗ ${r.fecha}: ${r.error}`);
        continue;
      }
      analizados += r.itemsAnalizados;
      encontradas += r.coincidencias;
      if (r.coincidencias > 0) {
        console.log(`  ✓ ${r.fecha} · ${r.coincidencias} coincidencia(s)`);
      }
    } catch (error) {
      fallos += 1;
      if (fallos === 1) console.log(`  ✗ ${(error as Error).message}`);
    }
  }

  console.log("");
  console.log(`  ${analizados} anuncios analizados · ${encontradas} coincidencias`);
  if (fallos > 0) {
    console.log(`  ${fallos} días no se pudieron consultar (¿sin conexión?).`);
  }

  const total = await prismaBase.officialCall.count({ where: { academyId: academia.id } });
  if (total === 0) {
    console.log(
      "\n  Ninguna convocatoria de lo vigilado en estas fechas. Es un resultado\n" +
        "  legítimo: el BOE no publica una oposición concreta todos los días.\n" +
        "  Prueba con `npm run demo:radar -- --dias 30`.",
    );
  } else {
    console.log(`\n  ${total} convocatoria(s) en la pantalla de Convocatorias.\n`);
  }
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
