import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RELACIONES_DE_TENANT } from "@/lib/db/tenant-relations";

/**
 * GENERA LA TERCERA BARRERA: LAS RELACIONES, COMPROBADAS EN LA BASE
 *
 *   npm run barrera:generar
 *
 * ── QUÉ PROBLEMA RESUELVE ──────────────────────────────────────────────────
 *
 * Una fila de la academia A podía apuntar a una entidad de la academia B:
 *
 *     dbDeLaAcademiaA.oppositionEdition.create({
 *       data: { oppositionId: <id de una oposición de B>, name: "2026" },
 *     })
 *
 * Las dos barreras existentes lo dejaban pasar, cada una por su motivo. La
 * guardia de aplicación mira a qué registro se apunta cuando el `where` señala
 * uno, pero al CREAR no hay registro al que apuntar. Y PostgreSQL comprueba la
 * fila que se escribe contra la política —y esa fila es legítima, es de A—;
 * la integridad referencial la verifica aparte, por diseño saltándose Row Level
 * Security, así que la oposición de B «existe» a esos efectos.
 *
 * `tenant-relations.ts` lo tapó en la aplicación. Esto lo baja a la base, que
 * es donde deja de depender de que nadie se despiste.
 *
 * ── POR QUÉ DISPARADORES Y NO CLAVES COMPUESTAS ────────────────────────────
 *
 * La solución de libro es la clave foránea compuesta:
 *
 *     (academyId, oppositionId) → oppositions(academyId, id)
 *
 * Son 109 claves sobre 71 modelos, y en Prisma significa reescribir todas las
 * relaciones y añadir un índice único `(academyId, id)` a cada modelo. Es un
 * proyecto entero, y uno donde un error se paga caro.
 *
 * Y hay una razón más fuerte para no hacerlo en SQL a mano: **Prisma borraría
 * esas claves**. Se comprobó con `prisma migrate diff`: una restricción que no
 * esté en el esquema aparece como sobrante y la primera migración que alguien
 * genere la elimina, sin ruido. Los disparadores, en cambio, Prisma no los ve,
 * igual que no ve las políticas de RLS: sobreviven.
 *
 * ── LO QUE CUESTA, MEDIDO ──────────────────────────────────────────────────
 *
 * Una consulta más por fila escrita que tenga una de estas claves. Sobre mil
 * inserciones seguidas en `question_options`:
 *
 *     sin barrera                          25 ms
 *     con barrera, consulta escrita        39 ms
 *     con barrera, consulta dinámica      110 ms
 *
 * Trece microsegundos por fila. En una petición normal, que escribe unas
 * cuantas, no se nota; en una importación de veinte mil filas son unos pocos
 * segundos sobre un proceso que ya tarda.
 *
 * La tercera línea es la razón de que haya una función por relación en vez de
 * una genérica: componiendo la consulta al vuelo con `EXECUTE format(...)`,
 * PostgreSQL no puede guardar el plan y la barrera costaba más que la propia
 * inserción. Se escribió así primero y se cambió al medirlo.
 *
 * ── CÓMO SE COMPORTA CON RLS ───────────────────────────────────────────────
 *
 * El disparador busca el padre con los permisos de quien escribe, así que si el
 * padre es de otra academia **no lo ve**, y no verlo se trata como error. Eso
 * es lo correcto: si el padre no existiera de verdad, la clave foránea de toda
 * la vida ya habría rechazado la fila antes.
 *
 * Cuando no hay academia fijada en la sesión —las tareas del sistema, que usan
 * el cliente sin guardia— la política deja verlo todo y entonces sí se comparan
 * los `academyId`. Las dos vías quedan cubiertas.
 *
 * ── LA LISTA MANDA ─────────────────────────────────────────────────────────
 *
 * No hay una segunda lista: se genera de `RELACIONES_DE_TENANT`, que ya tiene
 * su propia prueba comparándola con el esquema. Si mañana aparece una relación
 * nueva, esa prueba falla, se añade a la lista y se vuelve a generar esto.
 */

const RAIZ = process.cwd();
const DESTINO = "prisma/migrations/20260904160000_barrera_de_relaciones/migration.sql";

/** Nombre de tabla de cada modelo, leído de los `@@map` del esquema. */
function tablasPorModelo(): Map<string, string> {
  const dir = path.join(RAIZ, "prisma", "schema");
  const tablas = new Map<string, string>();

  for (const archivo of readdirSync(dir).filter((f) => f.endsWith(".prisma"))) {
    const texto = readFileSync(path.join(dir, archivo), "utf8");
    for (const bloque of texto.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, modelo, cuerpo] = bloque;
      const mapa = cuerpo.match(/@@map\("([^"]+)"\)/);
      // Sin `@@map`, Prisma usa el nombre del modelo tal cual.
      tablas.set(modelo, mapa ? mapa[1] : modelo);
    }
  }
  return tablas;
}

function main() {
  const tablas = tablasPorModelo();
  const lineas: string[] = [];
  let cuantas = 0;

  lineas.push(
    "-- LA TERCERA BARRERA · NO SE PUEDE APUNTAR A OTRA ACADEMIA",
    "--",
    "-- GENERADO POR `npm run barrera:generar`. No editar a mano: se regenera",
    "-- desde `src/lib/db/tenant-relations.ts`, que es donde está la lista.",
    "--",
    "-- Una fila de la academia A podía apuntar a una entidad de la B. La guardia",
    "-- de aplicación no lo veía al crear —no hay registro al que apuntar— y",
    "-- PostgreSQL tampoco: la fila que se escribe es legítima, y la integridad",
    "-- referencial se verifica aparte, saltándose Row Level Security por diseño.",
    "--",
    "-- Va una función por relación, con la consulta escrita dentro en vez de una",
    "-- función genérica que la componga al vuelo. Son 108 funciones en lugar de",
    "-- una, y se hace así porque está medido: con la consulta dinámica, mil",
    "-- inserciones pasaban de 32 ms a 110; con la consulta fija, PostgreSQL",
    "-- guarda el plan y la diferencia se reduce mucho.",
    "",
    "-- La versión con consulta dinámica tenía una sola función compartida. Se",
    "-- quita en cascada: con ella se van sus disparadores, y justo debajo se",
    "-- vuelven a crear todos. En una base nueva no existe y no hace nada.",
    "DROP FUNCTION IF EXISTS comprobar_academia_de_relacion() CASCADE;",
    "",
  );

  for (const [modelo, relaciones] of Object.entries(RELACIONES_DE_TENANT)) {
    const tabla = tablas.get(modelo);
    if (!tabla) throw new Error(`Sin tabla para el modelo ${modelo}`);

    for (const { campo, destino } of relaciones) {
      const tablaDestino = tablas.get(destino);
      if (!tablaDestino) throw new Error(`Sin tabla para el destino ${destino}`);

      const nombre = `barrera_${tabla}_${campo}`.slice(0, 63);
      cuantas += 1;

      lineas.push(
        `-- ${modelo}.${campo} → ${destino}`,
        `CREATE OR REPLACE FUNCTION "${nombre}"()`,
        "RETURNS trigger",
        "LANGUAGE plpgsql",
        "AS $$",
        "DECLARE",
        "  v_academia text;",
        "BEGIN",
        `  SELECT "academyId" INTO v_academia FROM "${tablaDestino}"`,
        `    WHERE id = NEW."${campo}";`,
        "",
        "  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer",
        "  -- ya es motivo suficiente: la clave foránea normal habría rechazado",
        "  -- antes una fila que apuntara a algo inexistente, así que si llega",
        "  -- hasta aquí y no se ve, es que existe y es de otra academia.",
        `  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN`,
        "    RAISE EXCEPTION",
        `      'La columna ${tabla}.${campo} apunta a un registro de otra academia'`,
        "      USING ERRCODE = 'check_violation';",
        "  END IF;",
        "",
        "  RETURN NEW;",
        "END;",
        "$$;",
        `DROP TRIGGER IF EXISTS "${nombre}" ON "${tabla}";`,
        `CREATE TRIGGER "${nombre}"`,
        // `UPDATE OF` limita las veces que se dispara: si no se toca ni la
        // clave ni la academia, no hay nada que comprobar.
        `  BEFORE INSERT OR UPDATE OF "${campo}", "academyId" ON "${tabla}"`,
        `  FOR EACH ROW WHEN (NEW."${campo}" IS NOT NULL)`,
        `  EXECUTE FUNCTION "${nombre}"();`,
        "",
      );
    }
  }

  writeFileSync(path.join(RAIZ, DESTINO), lineas.join("\n"), "utf8");
  console.log(`✓ ${DESTINO}`);
  console.log(`  ${cuantas} relaciones vigiladas en la base de datos.`);
}

main();
