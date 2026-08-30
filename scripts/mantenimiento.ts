/**
 * Tareas de mantenimiento diarias.
 *
 *   npm run mantenimiento
 *
 * Va en cron junto al radar. Lo que hace no es higiene estética: son datos que
 * apuntan a cuentas concretas —sesiones abiertas, enlaces de recuperación— y no
 * hay ninguna razón para conservarlos una vez han dejado de servir. Cuanto menos
 * haya guardado, menos hay que perder.
 */
import { prismaBase } from "@/lib/db/client";
import { limpiarTokensCaducados } from "@/lib/auth/recovery";
import { limpiarContadores } from "@/lib/rate-limit";
import { cerrarExamenesVencidos } from "@/server/exams/cierre";

async function main() {
  console.log("Mantenimiento de Proyecto Geminis");

  const tokens = await limpiarTokensCaducados();
  console.log(`  · ${tokens} enlaces de recuperación caducados eliminados`);

  // Sesiones caducadas o revocadas hace más de treinta días. Las revocadas se
  // conservan un tiempo a propósito: si alguien denuncia un acceso indebido,
  // la academia necesita poder ver desde dónde se entró.
  const { count: sesiones } = await prismaBase.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  console.log(`  · ${sesiones} sesiones caducadas eliminadas`);

  // Importaciones que se quedaron a medias hace más de una semana: nadie va a
  // volver a ellas y arrastran todas sus filas originales.
  const abandonadas = await prismaBase.importJob.findMany({
    where: {
      status: { in: ["UPLOADED", "MAPPING", "VALIDATED", "SIMULATED"] },
      createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (abandonadas.length > 0) {
    await prismaBase.importJob.deleteMany({
      where: { id: { in: abandonadas.map((i) => i.id) } },
    });
  }
  console.log(`  · ${abandonadas.length} importaciones abandonadas eliminadas`);

  // Contadores del limitador que ya vencieron. Sin esto, la tabla acumula una
  // fila por cada IP que haya intentado entrar alguna vez.
  const contadores = await limpiarContadores();
  console.log(`  · ${contadores} contadores de intentos vencidos eliminados`);

  // Exámenes de desarrollo a los que se les agotó el tiempo y nadie llegó a
  // cerrar: el alumno se quedó sin batería, cerró el portátil, se fue la luz.
  // Sin esto la entrega se quedaría «pendiente» para siempre y el profesor no
  // la vería en su lista de corregir, con el examen ya escrito y guardado.
  const examenes = await cerrarExamenesVencidos();
  console.log(`  · ${examenes} exámenes vencidos cerrados con lo último guardado`);

  console.log("✓ Terminado");
}

main()
  .catch((error) => {
    console.error("✗ El mantenimiento ha fallado:", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
