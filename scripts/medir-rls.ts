/**
 * ¿Cuánto cuesta la segunda barrera?
 *
 *   npm run rls:medir
 *
 * Envolver cada consulta en una transacción para fijar la variable no es
 * gratis. Aquí se mide, en lugar de suponerlo, para que la decisión de tenerla
 * encendida se tome con el número delante.
 */
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";

const VUELTAS = 200;

async function medir(nombre: string, fn: () => Promise<unknown>) {
  await fn(); // calentar
  const inicio = process.hrtime.bigint();
  for (let i = 0; i < VUELTAS; i += 1) await fn();
  const fin = process.hrtime.bigint();
  const ms = Number(fin - inicio) / 1e6 / VUELTAS;
  console.log(`  ${nombre.padEnd(34)} ${ms.toFixed(2)} ms/consulta`);
  return ms;
}

async function main() {
  const a = await prismaBase.academy.findFirst({ select: { id: true } });
  if (!a) throw new Error("No hay academias.");
  const db = tenantDb(a.id);

  console.log(`\nCOSTE DE LA SEGUNDA BARRERA · DB_RLS = ${env.DB_RLS}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  ${VUELTAS} repeticiones de cada consulta\n`);

  const conGuardia = await medir("con la guardia de academia", () =>
    db.membership.count(),
  );
  const sinGuardia = await medir("consulta directa, sin guardia", () =>
    prismaBase.membership.count({ where: { academyId: a.id } }),
  );

  console.log("");
  const diferencia = conGuardia - sinGuardia;
  console.log(`  Sobrecoste: ${diferencia.toFixed(2)} ms por consulta`);
  console.log(
    `  Una pantalla con 6 consultas: ${(diferencia * 6).toFixed(1)} ms más.`,
  );
  console.log(
    env.DB_RLS === "on"
      ? "\n  (Con DB_RLS=off el sobrecoste baja a casi cero, pero se pierde la\n   segunda barrera. La decisión está en el ADR-0040.)\n"
      : "\n  (RLS está apagada: esto NO mide la segunda barrera.)\n",
  );
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
