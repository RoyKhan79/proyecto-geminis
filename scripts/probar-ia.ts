/**
 * Prueba real del motor local contra el material de la academia demo.
 * Uso: npx tsx scripts/probar-ia.ts
 */
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { recuperarFragmentos } from "@/lib/ai/retrieval";
import { responderConMaterial, generarPreguntasLocales } from "@/lib/ai/local-engine";

const PREGUNTAS = [
  "¿Qué plazo hay para resolver?",
  "Resúmeme el tema",
  "¿Qué es el silencio administrativo?",
  "¿Cuál es la capital de Mongolia?",
  "¿Cuándo se entiende estimado el silencio?",
  "¿Qué diferencia hay entre nulidad y anulabilidad?",
  "Enumera los actos nulos de pleno derecho",
];

async function main() {
  const academia = await prismaBase.academy.findFirst({ select: { id: true, name: true } });
  if (!academia) throw new Error("No hay academias.");

  const alumno = await prismaBase.membership.findFirst({
    where: { academyId: academia.id, user: { email: "alumno1@academiademo.test" } },
    select: { id: true },
  });
  if (!alumno) throw new Error("No está el alumno demo.");

  const db = tenantDb(academia.id);
  console.log(`\nAcademia: ${academia.name}\n${"=".repeat(60)}`);

  for (const pregunta of PREGUNTAS) {
    const fragmentos = await recuperarFragmentos({
      academyId: academia.id,
      membershipId: alumno.id,
      esPersonal: false,
      pregunta,
      nodeId: null,
    });
    const r = responderConMaterial(pregunta, fragmentos);
    console.log(`\n❯ ${pregunta}`);
    console.log(`  intención: ${r.intencion} · confianza: ${r.confianza} · fragmentos: ${fragmentos.length}`);
    console.log(`  ${r.texto.replace(/\n/g, "\n  ").slice(0, 700)}`);
  }

  // Copiloto: preguntas generadas sin proveedor.
  const tema = await db.contentNode.findFirst({
    where: { kind: "TOPIC", deletedAt: null },
    select: { id: true, label: true },
  });
  if (tema) {
    const fragmentos = await recuperarFragmentos({
      academyId: academia.id,
      membershipId: alumno.id,
      esPersonal: false,
      pregunta: tema.label,
      nodeId: tema.id,
      limite: 10,
    });
    const generadas = generarPreguntasLocales(fragmentos, 3);
    console.log(`\n${"=".repeat(60)}\nCOPILOTO · ${tema.label} → ${generadas.length} preguntas`);
    for (const p of generadas) {
      console.log(`\n  ${p.enunciado.slice(0, 160)}`);
      p.opciones.forEach((o, i) =>
        console.log(`    ${i === p.correcta ? "✓" : " "} ${String.fromCharCode(65 + i)}. ${o}`),
      );
    }
  }

  await prismaBase.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
