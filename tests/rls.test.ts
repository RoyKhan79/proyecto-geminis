import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";

/**
 * COBERTURA DE ROW LEVEL SECURITY
 *
 * Catedria promete dos barreras de aislamiento: la guardia de aplicación
 * (`tenantDb`) y las políticas de PostgreSQL. La segunda se activó de una vez
 * sobre las 50 tablas que existían aquel día, con una lista escrita a mano
 * dentro de una migración.
 *
 * Y ahí estaba el fallo, que se encontró auditando: las tablas que llegaron
 * después —facturación, remesas, cobros recurrentes, perfiles bancarios— no
 * entraron en ninguna lista, y durante meses las seis tablas con los datos más
 * sensibles del producto fueron justamente las únicas con una sola barrera.
 *
 * Una lista escrita a mano en una migración de hace meses no puede ser la única
 * garantía de nada, porque nadie vuelve a leerla. Esta prueba la sustituye por
 * una comprobación que se ejecuta sola: **toda tabla con `academyId` tiene que
 * tener su política**. Si mañana alguien añade una tabla nueva y se olvida, esto
 * falla antes de que llegue a producción, y falla diciendo exactamente cuál es.
 */

const RAIZ = process.cwd();

/** Los modelos del esquema de Prisma que llevan `academyId`, con su tabla. */
function modelosDeAcademia(): { modelo: string; tabla: string }[] {
  const dir = path.join(RAIZ, "prisma", "schema");
  const esquema = readdirSync(dir)
    .filter((f) => f.endsWith(".prisma"))
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");

  const salida: { modelo: string; tabla: string }[] = [];

  for (const bloque of esquema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, modelo, cuerpo] = bloque;
    // El campo, no una relación que se llame parecido: se exige que la línea
    // empiece por `academyId` seguido de espacio.
    if (!/\n\s*academyId\s/.test(cuerpo)) continue;
    const mapeo = cuerpo.match(/@@map\("([^"]+)"\)/);
    salida.push({ modelo, tabla: mapeo ? mapeo[1] : modelo });
  }

  return salida;
}

afterAll(async () => {
  await prismaBase.$disconnect();
});

describe("Row Level Security · cobertura", () => {
  it("el esquema declara tablas de academia (la prueba tiene sentido)", () => {
    // Sin esto, un cambio que rompiera la lectura del esquema convertiría la
    // prueba en una que pasa siempre sin comprobar nada.
    expect(modelosDeAcademia().length).toBeGreaterThan(40);
  });

  it("toda tabla con academyId tiene RLS activada y forzada", async () => {
    const esperadas = modelosDeAcademia();

    const estado = await prismaBase.$queryRaw<
      { tabla: string; activada: boolean; forzada: boolean }[]
    >`
      SELECT c.relname AS tabla,
             c.relrowsecurity AS activada,
             c.relforcerowsecurity AS forzada
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;

    const porTabla = new Map(estado.map((f) => [f.tabla, f]));

    const sinRls: string[] = [];
    const sinForzar: string[] = [];

    for (const { modelo, tabla } of esperadas) {
      const fila = porTabla.get(tabla);
      if (!fila) continue; // Tabla que aún no existe en esta base: no es cosa nuestra.
      if (!fila.activada) sinRls.push(`${modelo} (${tabla})`);
      // FORCE importa tanto como ENABLE: sin él, el dueño de la tabla se salta
      // las políticas, y ese fue el fallo original que documenta la migración
      // `rol_de_aplicacion_sin_bypass`.
      else if (!fila.forzada) sinForzar.push(`${modelo} (${tabla})`);
    }

    expect(sinRls, `tablas de academia SIN RLS: ${sinRls.join(", ")}`).toEqual([]);
    expect(
      sinForzar,
      `tablas de academia con RLS sin FORCE: ${sinForzar.join(", ")}`,
    ).toEqual([]);
  });

  it("toda tabla con academyId tiene su política de aislamiento", async () => {
    const esperadas = modelosDeAcademia();

    const politicas = await prismaBase.$queryRaw<
      { tabla: string; politica: string; usando: string | null; comprobando: string | null }[]
    >`
      SELECT tablename AS tabla,
             policyname AS politica,
             qual AS usando,
             with_check AS comprobando
      FROM pg_policies
      WHERE schemaname = 'public'`;

    const porTabla = new Map<string, typeof politicas>();
    for (const p of politicas) {
      porTabla.set(p.tabla, [...(porTabla.get(p.tabla) ?? []), p]);
    }

    const sinPolitica: string[] = [];
    const sinComprobacion: string[] = [];

    for (const { modelo, tabla } of esperadas) {
      const suyas = porTabla.get(tabla);
      if (!suyas || suyas.length === 0) {
        sinPolitica.push(`${modelo} (${tabla})`);
        continue;
      }
      // WITH CHECK es lo que impide ESCRIBIR una fila de otra academia. Una
      // política solo con USING deja leer bien y escribir mal, que es peor que
      // no tenerla, porque parece que está.
      if (!suyas.some((p) => p.comprobando?.includes("geminis.academy_id"))) {
        sinComprobacion.push(`${modelo} (${tabla})`);
      }
    }

    expect(
      sinPolitica,
      `tablas de academia sin política: ${sinPolitica.join(", ")}`,
    ).toEqual([]);
    expect(
      sinComprobacion,
      `políticas sin WITH CHECK: ${sinComprobacion.join(", ")}`,
    ).toEqual([]);
  });

  it("las tablas de facturación están cubiertas, que es lo que faltaba", async () => {
    // Se nombran una a una además de la comprobación general: si alguien
    // relajara la lectura del esquema, esta seguiría fallando.
    const financieras = [
      "billing_profiles",
      "recurring_charges",
      "direct_debit_runs",
      "invoice_series",
      "invoices",
      "invoice_lines",
    ];

    const filas = await prismaBase.$queryRaw<{ tabla: string; n: bigint }[]>`
      SELECT tablename AS tabla, count(*) AS n
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY(${financieras})
      GROUP BY tablename`;

    const cubiertas = new Set(filas.map((f) => f.tabla));
    for (const tabla of financieras) {
      expect(cubiertas.has(tabla), `${tabla} sigue sin política de aislamiento`).toBe(
        true,
      );
    }
  });
});
