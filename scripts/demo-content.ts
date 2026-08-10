/**
 * Añade material real a la Academia Geminis Demo: PDFs de temario colgados del
 * árbol de contenido, para poder probar el visor y los permisos de descarga.
 *
 *   npm run demo:contenido
 *
 * Los PDFs se generan aquí mismo, sin dependencias: son ficticios y sirven para
 * comprobar que la cadena completa funciona (subida → almacén → visor → permisos).
 */
import { prismaBase } from "../src/lib/db/client";
import { tenantDb } from "../src/lib/db/tenant";
import { buildStorageKey, storage } from "../src/lib/storage";
import { createContentNode } from "../src/server/content/tree";

/** PDF mínimo pero válido, con texto real dentro. */
function makePdf(titulo: string, lineas: string[]): Buffer {
  const limpio = (s: string) => s.replace(/[()\\]/g, "");
  const contenido = [
    `BT /F1 17 Tf 60 780 Td (${limpio(titulo)}) Tj ET`,
    ...lineas.map(
      (l, i) => `BT /F1 11 Tf 60 ${740 - i * 20} Td (${limpio(l)}) Tj ET`,
    ),
  ].join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objetos.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objetos.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

const DOCUMENTOS = [
  {
    tema: 0,
    nombre: "Tema 1 · La Constitución Española de 1978.pdf",
    titulo: "Tema 1 - La Constitucion Espanola de 1978",
    lineas: [
      "1. Caracteristicas y estructura de la Constitucion.",
      "2. Titulo Preliminar: principios fundamentales.",
      "3. Derechos y deberes fundamentales (arts. 10 a 55).",
      "4. Garantias de los derechos y libertades.",
      "5. La reforma constitucional: procedimientos.",
      "",
      "Academia Geminis Demo - material para alumnado matriculado.",
    ],
  },
  {
    tema: 4,
    nombre: "Tema 5 · El acto administrativo.pdf",
    titulo: "Tema 5 - El acto administrativo",
    lineas: [
      "1. Concepto, clases y elementos.",
      "2. Requisitos: motivacion y forma.",
      "3. Eficacia y notificacion.",
      "4. Nulidad y anulabilidad.",
      "5. La revision de oficio.",
    ],
  },
  {
    tema: 5,
    nombre: "Tema 6 · El procedimiento administrativo común.pdf",
    titulo: "Tema 6 - El procedimiento administrativo comun",
    lineas: [
      "1. Ley 39-2015: ambito de aplicacion.",
      "2. Fases: iniciacion, ordenacion, instruccion y terminacion.",
      "3. Plazos: art. 21.3 - tres meses salvo norma especial.",
      "4. Silencio administrativo: art. 24.1 - positivo con caracter general.",
      "5. Computo de plazos por dias habiles (art. 30).",
    ],
  },
];

async function main() {
  const academia = await prismaBase.academy.findUnique({
    where: { slug: "geminis-demo" },
    select: { id: true, name: true },
  });
  if (!academia) {
    console.error("✗ No existe la academia demo. Ejecuta antes `npm run db:seed`.");
    process.exit(1);
  }

  const db = tenantDb(academia.id);

  // Solo la convocatoria de Administrativo: si mezclamos oposiciones, los
  // documentos acaban colgando del tema equivocado.
  const edicion = await db.oppositionEdition.findFirst({
    where: { opposition: { slug: "administrativo-estado" }, deletedAt: null },
    select: { id: true },
  });
  if (!edicion) {
    console.error("✗ No encuentro la convocatoria de Administrativo en la demo.");
    process.exit(1);
  }

  const temas = await db.contentNode.findMany({
    where: { kind: "TOPIC", editionId: edicion.id, deletedAt: null },
    orderBy: { path: "asc" },
    select: { id: true, label: true, path: true, position: true, editionId: true },
  });
  temas.sort((a, b) =>
    a.path === b.path ? a.position - b.position : a.path.localeCompare(b.path),
  );

  if (temas.length === 0) {
    console.error("✗ La academia demo no tiene temas. Ejecuta `npm run db:seed`.");
    process.exit(1);
  }

  const almacen = storage();
  let creados = 0;

  for (const documento of DOCUMENTOS) {
    const tema = temas[documento.tema];
    if (!tema) continue;

    const yaTiene = await db.contentNode.findFirst({
      where: { parentId: tema.id, label: documento.nombre, deletedAt: null },
      select: { id: true },
    });
    if (yaTiene) {
      console.log(`  · ya existía: ${documento.nombre}`);
      continue;
    }

    const buffer = makePdf(documento.titulo, documento.lineas);
    const key = buildStorageKey(academia.id, documento.nombre);
    const guardado = await almacen.put(key, buffer, "application/pdf");

    const archivo = await db.storedFile.create({
      data: {
        storageKey: guardado.key,
        storageDriver: almacen.name,
        originalName: documento.nombre,
        mimeType: "application/pdf",
        sizeBytes: guardado.sizeBytes,
        checksumSha256: guardado.checksumSha256,
      },
    });

    const nodo = await createContentNode(db, {
      editionId: tema.editionId,
      parentId: tema.id,
      kind: "RESOURCE",
      label: documento.nombre,
      status: "PUBLISHED",
    });

    await prismaBase.contentResource.create({
      data: { nodeId: nodo.id, type: "PDF", fileId: archivo.id, pageCount: 1 },
    });

    creados += 1;
    console.log(`  ✓ ${documento.nombre} → ${tema.label}`);
  }

  console.log(`\n✓ ${creados} documentos añadidos a ${academia.name}`);
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
