/**
 * Cifra los datos sensibles que se guardaron antes de que existiera el cifrado.
 *
 *   npm run cifrar:migrar
 *
 * Es idempotente: los que ya están cifrados se saltan. Se puede ejecutar tantas
 * veces como haga falta, y hay que ejecutarlo justo después de configurar
 * `FIELD_ENCRYPTION_KEY` por primera vez.
 */
import { prismaBase } from "@/lib/db/client";
import { cifrar, cifradoDisponible, estaCifrado } from "@/lib/crypto/field";

async function main() {
  if (!cifradoDisponible()) {
    console.error(
      "✗ FIELD_ENCRYPTION_KEY no está configurada. Genérala con `openssl rand -base64 48` y ponla en .env.",
    );
    process.exit(1);
  }

  console.log(`\nCIFRADO DE DATOS EXISTENTES\n${"=".repeat(60)}`);

  const perfiles = await prismaBase.billingProfile.findMany({
    where: { iban: { not: null } },
    select: { id: true, iban: true },
  });

  let cifrados = 0;
  for (const perfil of perfiles) {
    if (!perfil.iban || estaCifrado(perfil.iban)) continue;
    await prismaBase.billingProfile.update({
      where: { id: perfil.id },
      data: { iban: cifrar(perfil.iban) },
    });
    cifrados += 1;
  }
  console.log(`  · Perfiles de cobro: ${cifrados} cifrados de ${perfiles.length}`);

  const academias = await prismaBase.academy.findMany({
    where: { billingIban: { not: null } },
    select: { id: true, billingIban: true },
  });

  let academiasCifradas = 0;
  for (const academia of academias) {
    if (!academia.billingIban || estaCifrado(academia.billingIban)) continue;
    await prismaBase.academy.update({
      where: { id: academia.id },
      data: { billingIban: cifrar(academia.billingIban) },
    });
    academiasCifradas += 1;
  }
  console.log(
    `  · Cuentas de academia: ${academiasCifradas} cifradas de ${academias.length}`,
  );

  // Las remesas guardan una copia del IBAN del acreedor en el momento de
  // generarse. También se cifra: es el mismo dato.
  const remesas = await prismaBase.directDebitRun.findMany({
    where: { creditorIban: { not: "" } },
    select: { id: true, creditorIban: true },
  });

  let remesasCifradas = 0;
  for (const remesa of remesas) {
    if (!remesa.creditorIban || estaCifrado(remesa.creditorIban)) continue;
    await prismaBase.directDebitRun.update({
      where: { id: remesa.id },
      data: { creditorIban: cifrar(remesa.creditorIban) },
    });
    remesasCifradas += 1;
  }
  console.log(`  · Remesas: ${remesasCifradas} cifradas de ${remesas.length}`);

  console.log("\n✓ Terminado.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
