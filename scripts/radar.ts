/**
 * RADAR DE CONVOCATORIAS · tarea diaria
 *
 *   npm run radar              → analiza el boletín de hoy
 *   npm run radar -- 2026-08-07 → analiza el de un día concreto
 *   npm run radar -- --dias 7   → recupera los últimos 7 días
 *
 * Pensado para lanzarse desde cron en el servidor, de modo que la academia no
 * necesita tener nada abierto. Ejemplo de crontab (8:30 cada mañana):
 *
 *   30 8 * * *  cd /ruta/proyecto && /usr/bin/npm run radar >> /var/log/geminis-radar.log 2>&1
 *
 * Es idempotente: si se ejecuta dos veces el mismo día, la segunda no hace nada.
 */
import { prismaBase } from "../src/lib/db/client";
import { ejecutarRadarBoe } from "../src/server/radar/service";

function parsearArgumentos(argv: string[]) {
  const dias = argv.includes("--dias")
    ? Number(argv[argv.indexOf("--dias") + 1] ?? 1)
    : 1;
  const fechaSuelta = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  return { dias: Number.isFinite(dias) && dias > 0 ? Math.min(dias, 30) : 1, fechaSuelta };
}

async function main() {
  const { dias, fechaSuelta } = parsearArgumentos(process.argv.slice(2));

  const fechas: Date[] = [];
  if (fechaSuelta) {
    fechas.push(new Date(`${fechaSuelta}T00:00:00.000Z`));
  } else {
    const hoy = new Date();
    for (let i = 0; i < dias; i += 1) {
      fechas.push(new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000));
    }
  }

  console.log(`Radar del BOE · ${fechas.length} ${fechas.length === 1 ? "día" : "días"}`);

  for (const fecha of fechas) {
    const resultado = await ejecutarRadarBoe(fecha);
    const detalle = resultado.saltado
      ? resultado.saltado
      : resultado.error
        ? `ERROR: ${resultado.error}`
        : `${resultado.itemsAnalizados} anuncios · ${resultado.coincidencias} coincidencias · ${resultado.avisos} avisos · ${resultado.academias} academias`;
    console.log(`  ${resultado.fecha}  ${detalle}`);
  }
}

main()
  .catch((error) => {
    console.error("✗ El radar ha fallado:", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
