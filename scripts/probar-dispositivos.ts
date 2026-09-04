/**
 * ¿Funciona el límite de dispositivos?
 *
 *   npm run dispositivos:probar
 *
 * Compartir la cuenta es la primera fuga de ingresos de una academia. Aquí se
 * comprueba que el límite se aplica de verdad, que echa a la sesión más antigua
 * y no a la nueva, y que al profesorado no se le limita.
 */
import { prismaBase } from "@/lib/db/client";
import { createSession, etiquetaDeDispositivo } from "@/lib/auth/session";

async function main() {
  const academia = await prismaBase.academy.findFirst({
    where: { slug: "catedria-demo" },
    select: { id: true, maxSessionsPerStudent: true },
  });
  if (!academia) throw new Error("Falta la academia demo.");

  console.log(`\nLÍMITE DE DISPOSITIVOS\n${"=".repeat(60)}`);
  console.log(`  Límite de la academia: ${academia.maxSessionsPerStudent}\n`);

  let fallos = 0;
  const comprobar = (t: string, ok: boolean, detalle = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${t}${detalle ? ` · ${detalle}` : ""}`);
    if (!ok) fallos += 1;
  };

  // Etiquetas legibles
  comprobar(
    "reconoce el navegador y el sistema",
    etiquetaDeDispositivo(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Safari/605",
    ) === "Safari en iPhone o iPad",
    etiquetaDeDispositivo("Mozilla/5.0 (iPhone) Safari/605"),
  );

  const alumno = await prismaBase.membership.findFirst({
    where: {
      academyId: academia.id,
      studentProfile: { isNot: null },
      roles: { every: { role: { key: "STUDENT" } } },
    },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!alumno) throw new Error("No hay alumnos en la demo.");

  await prismaBase.session.deleteMany({ where: { userId: alumno.userId } });

  const limite = academia.maxSessionsPerStudent;
  const creadas: string[] = [];

  // Se abren tantas sesiones como el límite; ninguna debe cerrarse.
  for (let i = 0; i < limite; i += 1) {
    const { session, sesionesCerradas } = await createSession({
      userId: alumno.userId,
      userAgent: `Navegador ${i} (Windows)`,
    });
    creadas.push(session.id);
    if (sesionesCerradas > 0) fallos += 1;
  }
  comprobar(`abre ${limite} sesiones sin cerrar ninguna`, fallos === 0);

  // La siguiente debe cerrar la más antigua.
  const { session: nueva, sesionesCerradas } = await createSession({
    userId: alumno.userId,
    userAgent: "Navegador de más (Android)",
  });

  comprobar(
    "al pasarse del límite se cierra una sesión",
    sesionesCerradas === 1,
    `cerradas: ${sesionesCerradas}`,
  );

  const activas = await prismaBase.session.findMany({
    where: { userId: alumno.userId, revokedAt: null },
    select: { id: true },
  });

  comprobar(
    `nunca hay más de ${limite} sesiones abiertas`,
    activas.length === limite,
    `${activas.length} abiertas`,
  );
  comprobar(
    "la sesión NUEVA sigue viva: se echa al que estaba, no al que acaba de entrar",
    activas.some((s) => s.id === nueva.id),
  );
  comprobar(
    "la que se cerró es la más antigua",
    !activas.some((s) => s.id === creadas[0]),
  );

  // El profesorado no se limita.
  const profesor = await prismaBase.membership.findFirst({
    where: {
      academyId: academia.id,
      teacherProfile: { isNot: null },
    },
    select: { userId: true },
  });

  if (profesor) {
    await prismaBase.session.deleteMany({ where: { userId: profesor.userId } });
    let cerradasProfe = 0;
    for (let i = 0; i < limite + 2; i += 1) {
      const { sesionesCerradas: c } = await createSession({
        userId: profesor.userId,
        userAgent: `Navegador ${i}`,
      });
      cerradasProfe += c;
    }
    const activasProfe = await prismaBase.session.count({
      where: { userId: profesor.userId, revokedAt: null },
    });
    comprobar(
      "al profesorado no se le limita: tiene motivos para estar en varios sitios",
      cerradasProfe === 0 && activasProfe === limite + 2,
      `${activasProfe} sesiones abiertas`,
    );
  }

  // Limpieza
  await prismaBase.session.deleteMany({ where: { userId: alumno.userId } });
  if (profesor) {
    await prismaBase.session.deleteMany({ where: { userId: profesor.userId } });
  }

  console.log(`\n${"=".repeat(60)}`);
  if (fallos > 0) {
    console.log(`✗ ${fallos} comprobaciones han fallado.`);
    process.exit(1);
  }
  console.log("✓ El límite de dispositivos funciona.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
