import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { TENANT_MODELS } from "@/lib/db/tenant-models";
import {
  createAcademyWithRoles,
  addMemberToAcademy,
} from "@/server/academies/provision";
import { createContentNode } from "@/server/content/tree";
import {
  loadStudentGrants,
  releaseWhere,
  studentCanAccessNode,
  studentNodeWhere,
} from "@/lib/access/content-access";
import { recuperarFragmentos } from "@/lib/ai/retrieval";
import { trocear, extraerTextoPdf } from "@/lib/ai/indexer";
import { coincide, DESCARTES_HABITUALES } from "@/server/radar/boe";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ArchivoDeOtraAcademiaError,
  abrirParaAcademia,
  buildStorageKey,
  claveEsDeLaAcademia,
} from "@/lib/storage";

/**
 * AUDITORÍA DE SEGURIDAD AUTOMATIZADA
 *
 * Recrea los escenarios que de verdad importan, con dos academias reales y
 * alumnos con planes distintos. Si alguna de estas pruebas falla, hay una fuga.
 */

const SUF = `s${Date.now().toString(36)}`;
let academiaA: { id: string };
let academiaB: { id: string };
let edicionA: { id: string };
let temarioA: { id: string; path: string };
let testsA: { id: string; path: string };
let temaA: { id: string; path: string };
let alumnoCompleto: { id: string };
let alumnoSoloTests: { id: string };
let alumnoDeB: { id: string };

beforeAll(async () => {
  academiaA = await createAcademyWithRoles({ slug: `sec-a-${SUF}`, name: "Seguridad A" });
  academiaB = await createAcademyWithRoles({ slug: `sec-b-${SUF}`, name: "Seguridad B" });

  const dbA = tenantDb(academiaA.id);

  const oposicion = await dbA.opposition.create({
    data: { name: "Oposición A", slug: `op-a-${SUF}` },
  });
  edicionA = await dbA.oppositionEdition.create({
    data: { oppositionId: oposicion.id, name: "2026" },
  });
  const curso = await dbA.course.create({
    data: { oppositionEditionId: edicionA.id, name: "Curso A" },
  });

  temarioA = await createContentNode(dbA, {
    editionId: edicionA.id,
    kind: "SECTION",
    sectionKind: "SYLLABUS",
    label: "Temario",
    status: "PUBLISHED",
  });
  testsA = await createContentNode(dbA, {
    editionId: edicionA.id,
    kind: "SECTION",
    sectionKind: "TESTS",
    label: "Tests",
    status: "PUBLISHED",
  });
  temaA = await createContentNode(dbA, {
    editionId: edicionA.id,
    parentId: temarioA.id,
    kind: "TOPIC",
    label: "Tema 1",
    status: "PUBLISHED",
  });

  // Alumno con todo el temario
  const completo = await addMemberToAcademy(academiaA.id, {
    email: `completo@${SUF}.test`,
    firstName: "Completo",
    roleKeys: ["STUDENT"],
  });
  alumnoCompleto = completo.membership;
  const matriculaCompleto = await dbA.enrollment.create({
    data: { studentId: alumnoCompleto.id, courseId: curso.id, status: "ACTIVE" },
  });
  await dbA.entitlement.create({
    data: {
      studentId: alumnoCompleto.id,
      enrollmentId: matriculaCompleto.id,
      source: "PRODUCT",
      status: "ACTIVE",
      scopes: { create: [{ nodeId: temarioA.id, capability: "VIEW_CONTENT" }] },
    },
  });

  // Alumno con solo la rama de tests
  const soloTests = await addMemberToAcademy(academiaA.id, {
    email: `solotests@${SUF}.test`,
    firstName: "SoloTests",
    roleKeys: ["STUDENT"],
  });
  alumnoSoloTests = soloTests.membership;
  const matriculaTests = await dbA.enrollment.create({
    data: { studentId: alumnoSoloTests.id, courseId: curso.id, status: "ACTIVE" },
  });
  await dbA.entitlement.create({
    data: {
      studentId: alumnoSoloTests.id,
      enrollmentId: matriculaTests.id,
      source: "PRODUCT",
      status: "ACTIVE",
      scopes: { create: [{ nodeId: testsA.id, capability: "TAKE_TESTS" }] },
    },
  });

  // Alumno de la OTRA academia
  const deB = await addMemberToAcademy(academiaB.id, {
    email: `deb@${SUF}.test`,
    firstName: "DeB",
    roleKeys: ["STUDENT"],
  });
  alumnoDeB = deB.membership;
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({
    where: { id: { in: [academiaA.id, academiaB.id] } },
  });
  await prismaBase.user.deleteMany({ where: { email: { endsWith: `@${SUF}.test` } } });
  await prismaBase.$disconnect();
});

describe("derechos de acceso al contenido", () => {
  it("el alumno con el temario contratado lo ve", async () => {
    const grants = await loadStudentGrants(academiaA.id, alumnoCompleto.id);
    const nodo = await prismaBase.contentNode.findUniqueOrThrow({
      where: { id: temaA.id },
      select: {
        id: true,
        path: true,
        editionId: true,
        isFree: true,
        visibleToStudents: true,
        status: true,
      },
    });
    expect(studentCanAccessNode(grants, nodo, "VIEW_CONTENT")).toBe(true);
  });

  it("el alumno con solo tests NO ve el temario", async () => {
    const grants = await loadStudentGrants(academiaA.id, alumnoSoloTests.id);
    const nodo = await prismaBase.contentNode.findUniqueOrThrow({
      where: { id: temaA.id },
      select: {
        id: true,
        path: true,
        editionId: true,
        isFree: true,
        visibleToStudents: true,
        status: true,
      },
    });
    expect(studentCanAccessNode(grants, nodo, "VIEW_CONTENT")).toBe(false);
  });

  it("ver no implica descargar", async () => {
    const grants = await loadStudentGrants(academiaA.id, alumnoCompleto.id);
    const nodo = await prismaBase.contentNode.findUniqueOrThrow({
      where: { id: temaA.id },
      select: {
        id: true,
        path: true,
        editionId: true,
        isFree: true,
        visibleToStudents: true,
        status: true,
      },
    });
    expect(studentCanAccessNode(grants, nodo, "DOWNLOAD_CONTENT")).toBe(false);
  });

  it("el alumno de otra academia no tiene derechos aquí", async () => {
    const grants = await loadStudentGrants(academiaA.id, alumnoDeB.id);
    expect(grants.prefixes).toHaveLength(0);
    expect(grants.editionIds.size).toBe(0);
  });
});

describe("ritmo de publicación", () => {
  it("un cierre explícito oculta el tema aunque esté publicado", async () => {
    const dbA = tenantDb(academiaA.id);

    await dbA.contentRelease.create({
      data: { nodeId: temaA.id, groupId: null, isOpen: false },
    });

    const grants = await loadStudentGrants(academiaA.id, alumnoCompleto.id);
    const visibles = await dbA.contentNode.findMany({
      where: {
        id: temaA.id,
        ...studentNodeWhere(grants),
        ...releaseWhere(grants.groupIds),
      },
      select: { id: true },
    });
    expect(visibles).toHaveLength(0);

    // Y al abrirlo vuelve a verse.
    await dbA.contentRelease.deleteMany({ where: { nodeId: temaA.id } });
    await dbA.contentRelease.create({
      data: { nodeId: temaA.id, groupId: null, isOpen: true },
    });

    const tras = await dbA.contentNode.findMany({
      where: {
        id: temaA.id,
        ...studentNodeWhere(grants),
        ...releaseWhere(grants.groupIds),
      },
      select: { id: true },
    });
    expect(tras).toHaveLength(1);
  });

  it("una apertura programada en el futuro no se ve todavía", async () => {
    const dbA = tenantDb(academiaA.id);
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await dbA.contentRelease.deleteMany({ where: { nodeId: temaA.id } });
    await dbA.contentRelease.create({
      data: { nodeId: temaA.id, groupId: null, isOpen: true, releasedAt: manana },
    });

    const grants = await loadStudentGrants(academiaA.id, alumnoCompleto.id);
    const visibles = await dbA.contentNode.findMany({
      where: {
        id: temaA.id,
        ...studentNodeWhere(grants),
        ...releaseWhere(grants.groupIds),
      },
      select: { id: true },
    });
    expect(visibles).toHaveLength(0);

    await dbA.contentRelease.deleteMany({ where: { nodeId: temaA.id } });
  });
});

describe("Catedria IA no es una puerta trasera", () => {
  it("no recupera fragmentos de contenido no contratado", async () => {
    const dbA = tenantDb(academiaA.id);

    const fuente = await dbA.knowledgeSource.create({
      data: { nodeId: temaA.id, title: "Tema 1", status: "INDEXED", chunkCount: 1 },
    });
    await dbA.documentChunk.create({
      data: {
        sourceId: fuente.id,
        nodeId: temaA.id,
        position: 0,
        content:
          "El plazo máximo para resolver un procedimiento administrativo es de tres meses.",
        locator: "fragmento 1",
      },
    });

    const conDerecho = await recuperarFragmentos({
      academyId: academiaA.id,
      membershipId: alumnoCompleto.id,
      esPersonal: false,
      pregunta: "plazo máximo resolver procedimiento",
    });
    expect(conDerecho.length).toBeGreaterThan(0);

    const sinDerecho = await recuperarFragmentos({
      academyId: academiaA.id,
      membershipId: alumnoSoloTests.id,
      esPersonal: false,
      pregunta: "plazo máximo resolver procedimiento",
    });
    expect(sinDerecho).toHaveLength(0);
  });

  it("no recupera fragmentos de otra academia", async () => {
    const desdeB = await recuperarFragmentos({
      academyId: academiaB.id,
      membershipId: alumnoDeB.id,
      esPersonal: false,
      pregunta: "plazo máximo resolver procedimiento",
    });
    expect(desdeB).toHaveLength(0);
  });

  it("el personal ve su material pero nunca el de otra academia", async () => {
    const comoPersonalDeB = await recuperarFragmentos({
      academyId: academiaB.id,
      membershipId: alumnoDeB.id,
      esPersonal: true,
      pregunta: "plazo máximo resolver procedimiento",
    });
    expect(comoPersonalDeB).toHaveLength(0);
  });
});

describe("indexador", () => {
  it("trocea sin dejar fragmentos vacíos ni bucles infinitos", () => {
    const texto = "Frase de prueba. ".repeat(400);
    const trozos = trocear(texto, 500, 80);
    expect(trozos.length).toBeGreaterThan(1);
    expect(trozos.every((t) => t.content.length > 40)).toBe(true);
    expect(trozos.every((t, i) => t.position === i)).toBe(true);
  });

  it("no se cuelga con un texto más corto que el fragmento", () => {
    expect(trocear("Texto corto pero suficiente para pasar el filtro.", 500, 80))
      .toHaveLength(1);
    expect(trocear("")).toHaveLength(0);
  });

  it("devuelve vacío ante un PDF sin capa de texto", () => {
    expect(extraerTextoPdf(Buffer.from("%PDF-1.4 sin texto"))).toBe("");
  });
});

describe("radar del BOE", () => {
  const base = {
    source: "BOE" as const,
    externalId: "BOE-A-2026-1",
    section: "2B",
    department: "MINISTERIO DE HACIENDA",
    epigraph: null,
    url: null,
    pdfUrl: null,
    publishedAt: new Date(),
  };

  const vigilancia = {
    keywords: ["administrativo"],
    excludeKeywords: DESCARTES_HABITUALES,
    requireCallPhrase: true,
  };

  it("detecta una convocatoria real", () => {
    expect(
      coincide(
        {
          ...base,
          title:
            "Resolución por la que se convoca proceso selectivo para ingreso en el Cuerpo General Administrativo",
        },
        vigilancia,
      ),
    ).toBe(true);
  });

  it("descarta los trámites", () => {
    for (const titulo of [
      "Resolución por la que se publica la relación definitiva de aprobados del Cuerpo Administrativo",
      "Orden por la que se nombra personal funcionario del Cuerpo Administrativo",
      "Resolución por la que se corrigen errores en la relación de plazas del Cuerpo Administrativo",
    ]) {
      expect(coincide({ ...base, title: titulo }, vigilancia), titulo).toBe(false);
    }
  });

  it("no coincide con lo que no es de la academia", () => {
    expect(
      coincide(
        { ...base, title: "Se convoca proceso selectivo para el Cuerpo de Bomberos" },
        vigilancia,
      ),
    ).toBe(false);
  });
});

describe("cobertura de la guardia", () => {
  it("los modelos nuevos están declarados como de tenant", () => {
    for (const modelo of [
      "ContentRelease",
      "OppositionWatch",
      "OfficialCall",
      "WallPost",
      "WallComment",
      "MessageThread",
      "Message",
      "Assignment",
      "Submission",
      "SubmissionFile",
      "LiveRoom",
    ]) {
      expect(TENANT_MODELS.has(modelo), modelo).toBe(true);
    }
  });

  it("no se pueden leer publicaciones del muro de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const publicacion = await dbA.wallPost.create({
      data: { authorId: alumnoCompleto.id, body: "Mensaje privado de la academia A" },
    });

    expect(await dbB.wallPost.findUnique({ where: { id: publicacion.id } })).toBeNull();
    expect(await dbB.wallPost.findMany()).toHaveLength(0);
  });

  it("no se pueden leer conversaciones de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const hilo = await dbA.messageThread.create({
      data: { studentId: alumnoCompleto.id, subject: "Duda privada" },
    });

    expect(await dbB.messageThread.findUnique({ where: { id: hilo.id } })).toBeNull();
  });

  it("no se pueden leer entregas de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const curso = await dbA.course.findFirstOrThrow({ select: { id: true } });
    const tarea = await dbA.assignment.create({
      data: { title: "Supuesto", courseId: curso.id, status: "PUBLISHED" },
    });
    const entrega = await dbA.submission.create({
      data: { assignmentId: tarea.id, studentId: alumnoCompleto.id, status: "SUBMITTED" },
    });

    expect(await dbB.submission.findUnique({ where: { id: entrega.id } })).toBeNull();
    expect(await dbB.assignment.findMany()).toHaveLength(0);
  });
});

describe("saneado de HTML", () => {
  it("elimina scripts y su contenido", () => {
    const sucio = '<p>Hola</p><script>fetch("/api/robar")</script>';
    const limpio = sanitizeHtml(sucio);
    expect(limpio).not.toContain("script");
    expect(limpio).not.toContain("fetch");
    expect(limpio).toContain("<p>Hola</p>");
  });

  it("elimina los atributos de evento", () => {
    expect(sanitizeHtml('<img src="/x.png" onerror="alert(1)" />')).not.toContain(
      "onerror",
    );
    expect(sanitizeHtml('<div onclick="robar()">texto</div>')).not.toContain("onclick");
  });

  it("bloquea javascript: y data: en los enlaces", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
    expect(sanitizeHtml('<a href="data:text/html,<script>">x</a>')).not.toContain(
      "data:",
    );
    expect(sanitizeHtml('<a href="https://boe.es">BOE</a>')).toContain("https://boe.es");
  });

  it("descarta iframes y formularios", () => {
    expect(sanitizeHtml('<iframe src="https://malo.test"></iframe>')).toBe("");
    expect(
      sanitizeHtml('<form action="https://malo.test"><input name="p" /></form>'),
    ).toBe("");
  });

  it("conserva el formato legítimo de unos apuntes", () => {
    const apuntes =
      "<h2>Plazos</h2><p>El plazo es de <strong>tres meses</strong>.</p><ul><li>Art. 21</li></ul>";
    const limpio = sanitizeHtml(apuntes);
    expect(limpio).toContain("<h2>Plazos</h2>");
    expect(limpio).toContain("<strong>tres meses</strong>");
    expect(limpio).toContain("<li>Art. 21</li>");
  });

  it("los enlaces salen con rel de seguridad", () => {
    const limpio = sanitizeHtml('<a href="https://boe.es">BOE</a>');
    expect(limpio).toContain('rel="noopener noreferrer nofollow"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("segunda barrera para los archivos", () => {
  /**
   * La base de datos tiene dos barreras: la guardia de la aplicación y las
   * políticas de PostgreSQL. Los archivos tenían una sola —la comprobación de
   * la ruta que los sirve— y eso quedaba anotado como riesgo abierto en la
   * auditoría: un fallo ahí no lo tapaba nada por debajo.
   *
   * La segunda barrera aprovecha algo que ya era cierto: la clave de todo
   * objeto empieza por su academia. Antes de devolver un byte se comprueba.
   */
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";

  it("una clave construida para una academia es suya y de nadie más", () => {
    const clave = buildStorageKey(A, "tema-12.pdf");
    expect(claveEsDeLaAcademia(clave, A)).toBe(true);
    expect(claveEsDeLaAcademia(clave, B)).toBe(false);
  });

  it("no se cuela un identificador que solo EMPIECE igual", () => {
    // Sin la barra final, la academia «1111…1111» abriría los archivos de una
    // academia cuyo identificador empezara por el suyo. No puede pasar hoy
    // —son UUID de longitud fija— pero es el error clásico de comparar
    // prefijos, y aquí se deja cerrado por escrito.
    expect(claveEsDeLaAcademia(`academies/${A}extra/x/f.pdf`, A)).toBe(false);
  });

  it("no valen las rutas relativas para salir de la carpeta", () => {
    expect(claveEsDeLaAcademia(`academies/${B}/../${A}/f.pdf`, A)).toBe(false);
    expect(claveEsDeLaAcademia(`../academies/${A}/f.pdf`, A)).toBe(false);
  });

  it("abrir un archivo ajeno falla antes de tocar el almacén", async () => {
    // Lo importante es que reviente ANTES de leer nada: si llegara a abrir el
    // archivo y fallara después, ya habría sacado los bytes del disco.
    await expect(
      abrirParaAcademia(`academies/${B}/x/tema.pdf`, A),
    ).rejects.toThrow(ArchivoDeOtraAcademiaError);
  });
});
