/**
 * AVISOS DE IMPAGO · tarea diaria
 *
 *   npm run avisos              → pasa los avisos de hoy
 *   npm run avisos -- 2026-09-15 → los de un día concreto (para comprobar)
 *
 * Pensado para lanzarse desde cron, como el radar. Lo instala
 * `scripts/cron/instalar.sh`.
 *
 * Es idempetente: las marcas que deja en cada recibo hacen que ejecutarlo dos
 * veces el mismo día no mande el aviso dos veces ni vuelva a suspender a nadie.
 */
import { prismaBase } from "../src/lib/db/client";
import { ejecutarAvisosDeImpago } from "../src/server/billing/dunning";

async function main() {
  const fechaSuelta = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const hoy = fechaSuelta ? new Date(`${fechaSuelta}T12:00:00.000Z`) : new Date();

  const r = await ejecutarAvisosDeImpago(hoy);

  console.log(
    `Avisos de impago · ${r.academias} ${r.academias === 1 ? "academia" : "academias"} · ` +
      `${r.avisos} ${r.avisos === 1 ? "aviso" : "avisos"} · ${r.suspendidos} suspendidos`,
  );
  for (const error of r.errores) console.error("  ✗", error);

  await prismaBase.$disconnect();
  if (r.errores.length > 0) process.exitCode = 1;
}

main();
