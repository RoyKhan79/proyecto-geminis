/**
 * ACADEMIA GEMINIS DEMO (§62)
 *
 * Datos ficticios pero realistas para poder trabajar sobre la interfaz sin
 * usar jamás datos personales reales. Se puede ejecutar varias veces: primero
 * limpia la academia demo y la vuelve a crear.
 *
 *   npm run db:seed
 */
import path from "node:path";

// Permite ejecutar la semilla directamente con `tsx prisma/seed.ts`.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  /* en CI las variables vienen del entorno */
}

import { prismaBase } from "../src/lib/db/client";
import { tenantDb } from "../src/lib/db/tenant";
import { hashPassword } from "../src/lib/auth/password";
import {
  addMemberToAcademy,
  createAcademyWithRoles,
} from "../src/server/academies/provision";
import { createContentNode } from "../src/server/content/tree";
import { PACKS, resolverDependencias } from "../src/lib/modules/catalogo";

const DEMO_SLUG = "geminis-demo";
const DEMO_PASSWORD = "Geminis2026!";

/**
 * El superadministrador de la plataforma.
 *
 * Es el nivel de arriba del todo: da de alta academias y da soporte, pero NO
 * pertenece a ninguna academia y por tanto no ve el contenido de ninguna. Para
 * entrar en una tiene que impersonar, y eso queda registrado (§3).
 *
 * Se pueden cambiar con variables de entorno al sembrar, para no dejar unas
 * credenciales conocidas en un despliegue real:
 *
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... npm run db:seed
 */
const SUPERADMIN_EMAIL =
  process.env.SUPERADMIN_EMAIL ?? "antonio.fusterverdu@gmail.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "licantropiA1!";

async function main() {
  console.log("→ Sembrando datos de demostración…");

  await seedPlans();
  await limpiarDemo();

  const academy = await createAcademyWithRoles({
    slug: DEMO_SLUG,
    name: "Academia Geminis Demo",
    legalName: "Academia Geminis Demo S.L.",
    email: "info@academiademo.test",
    planCode: "PRO",
    status: "ACTIVE",
  });
  const db = tenantDb(academy.id);
  console.log(`  · Academia creada: ${academy.name}`);

  await seedModulos(academy.id);

  await seedSuperadmin();
  const { admin, profesores } = await seedEquipo(academy.id);
  const tipos = await seedTiposOposicion(db);

  const administrativo = await seedAdministrativo(db, tipos.general);
  const magisterio = await seedMagisterio(db, tipos.magisterio);

  await seedProfesorado(db, profesores, administrativo, magisterio);
  const alumnos = await seedAlumnado(academy.id);
  await seedMatriculasYAccesos(db, alumnos, administrativo, magisterio);
  await seedClases(db, administrativo, profesores[0].membership.id);
  await seedPreguntas(db, administrativo, profesores[0].membership.id);
  await seedExamenes(db, administrativo, profesores[0].membership.id);

  console.log("\n✓ Listo. Puedes entrar con:");
  console.log(`   Administración   admin@academiademo.test      / ${DEMO_PASSWORD}`);
  console.log(`   Profesor         laura@academiademo.test      / ${DEMO_PASSWORD}`);
  console.log(`   Alumna           alumno1@academiademo.test    / ${DEMO_PASSWORD}`);
  console.log(`   Superadmin       ${SUPERADMIN_EMAIL}  / ${SUPERADMIN_PASSWORD}`);
  console.log(`   (admin: ${admin.membership.id.slice(0, 8)}…)`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedPlans() {
  const planes = [
    { code: "STARTER" as const, name: "Starter", priceCents: 4900, maxStudents: 100, maxTeachers: 3, maxAdmins: 2, maxOppositions: 2, storageGb: 20, aiTokensPerMonth: 500_000 },
    { code: "PRO" as const, name: "Pro", priceCents: 14900, maxStudents: 500, maxTeachers: 15, maxAdmins: 5, maxOppositions: 10, storageGb: 200, aiTokensPerMonth: 5_000_000 },
    { code: "BUSINESS" as const, name: "Business", priceCents: 34900, maxStudents: 2000, maxTeachers: 60, maxAdmins: 15, maxOppositions: 40, storageGb: 1000, aiTokensPerMonth: 25_000_000 },
    { code: "ENTERPRISE" as const, name: "Enterprise", priceCents: 0, maxStudents: null, maxTeachers: null, maxAdmins: null, maxOppositions: null, storageGb: null, aiTokensPerMonth: null },
  ];

  for (const plan of planes) {
    await prismaBase.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
}

async function limpiarDemo() {
  const existing = await prismaBase.academy.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!existing) return;

  // El borrado en cascada del esquema se encarga de todo lo que cuelga de la
  // academia. Los usuarios son globales, así que se borran aparte.
  await prismaBase.academy.delete({ where: { id: existing.id } });
  await prismaBase.user.deleteMany({
    where: { email: { endsWith: "@academiademo.test" } },
  });
  console.log("  · Datos de demostración anteriores eliminados");
}

async function seedSuperadmin() {
  const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);

  await prismaBase.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    // La contraseña se actualiza también en `update`: si no, volver a sembrar
    // sobre una base existente dejaría la anterior y nadie entendería por qué.
    update: { isPlatformAdmin: true, passwordHash },
    create: {
      email: SUPERADMIN_EMAIL,
      firstName: "Antonio",
      lastName: "Fuster",
      isPlatformAdmin: true,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
}

/**
 * Los módulos que tiene contratados la academia de demostración.
 *
 * Sin esto la demo nace muerta: desde que el ERP se vende por módulos, lo que
 * no está contratado no funciona, y una academia recién sembrada sin ninguna
 * línea aquí manda al alumnado a «sin módulo» nada más entrar al Campus.
 *
 * Va el pack «Completo» a propósito, porque la semilla siembra datos de todo
 * —temario, tests, cobros, normativa, IA— y una demo donde media aplicación
 * está apagada no enseña lo que se está vendiendo. Se toma del catálogo en vez
 * de escribir la lista aquí: cuando se añada un módulo nuevo, la demo lo tendrá
 * sin que nadie se acuerde de volver a este archivo.
 */
async function seedModulos(academyId: string) {
  const pack = PACKS.find((p) => p.codigo === "completo");
  if (!pack) throw new Error("Falta el pack «completo» en el catálogo");

  const modulos = resolverDependencias(pack.modulos);
  for (const codigo of modulos) {
    await prismaBase.academyModule.upsert({
      where: { academyId_module: { academyId, module: codigo } },
      create: { academyId, module: codigo, active: true },
      update: { active: true, deactivatedAt: null },
    });
  }
  console.log(`  · Módulos contratados: ${modulos.length} (pack «${pack.nombre}»)`);
}

async function seedEquipo(academyId: string) {
  const admin = await addMemberToAcademy(academyId, {
    email: "admin@academiademo.test",
    firstName: "Marta",
    lastName: "Ruiz",
    password: DEMO_PASSWORD,
    roleKeys: ["ACADEMY_ADMIN"],
  });

  const laura = await addMemberToAcademy(academyId, {
    email: "laura@academiademo.test",
    firstName: "Laura",
    lastName: "Nieto",
    password: DEMO_PASSWORD,
    roleKeys: ["TEACHER"],
  });

  const javier = await addMemberToAcademy(academyId, {
    email: "javier@academiademo.test",
    firstName: "Javier",
    lastName: "Serrano",
    password: DEMO_PASSWORD,
    roleKeys: ["TEACHER"],
  });

  await addMemberToAcademy(academyId, {
    email: "secretaria@academiademo.test",
    firstName: "Nuria",
    lastName: "Prats",
    password: DEMO_PASSWORD,
    roleKeys: ["STAFF"],
  });

  await prismaBase.teacherProfile.createMany({
    data: [
      {
        membershipId: laura.membership.id,
        headline: "Derecho Administrativo",
        specialties: ["Ley 39/2015", "Ley 40/2015", "Procedimiento administrativo"],
      },
      {
        membershipId: javier.membership.id,
        headline: "Didáctica y Educación Primaria",
        specialties: ["Programación de aula", "Situaciones de aprendizaje", "LOMLOE"],
      },
    ],
    skipDuplicates: true,
  });

  return { admin, profesores: [laura, javier] };
}

async function seedTiposOposicion(db: ReturnType<typeof tenantDb>) {
  const definiciones = [
    { key: "ADMINISTRACION_GENERAL", name: "Administración General", position: 0 },
    { key: "MAGISTERIO", name: "Magisterio", position: 1 },
    { key: "JUSTICIA", name: "Justicia", position: 2 },
    { key: "SANIDAD", name: "Sanidad", position: 3 },
    { key: "SEGURIDAD", name: "Policía, Guardia Civil y Bomberos", position: 4 },
    { key: "ADMINISTRACION_LOCAL", name: "Administración Local", position: 5 },
  ];

  const creados = new Map<string, string>();
  for (const definicion of definiciones) {
    const tipo = await db.oppositionType.create({ data: definicion });
    creados.set(definicion.key, tipo.id);
  }

  return {
    general: creados.get("ADMINISTRACION_GENERAL")!,
    magisterio: creados.get("MAGISTERIO")!,
  };
}

// ── Oposición 1 · Administrativo del Estado ──────────────────────────────────

async function seedAdministrativo(db: ReturnType<typeof tenantDb>, typeId: string) {
  const opposition = await db.opposition.create({
    data: {
      typeId,
      name: "Administrativo del Estado",
      slug: "administrativo-estado",
      code: "AGE-C1",
      authority: "Administración General del Estado",
      scope: "Estatal",
      status: "ACTIVE",
      description:
        "Cuerpo General Administrativo de la Administración del Estado, turno libre.",
    },
  });

  const edition = await db.oppositionEdition.create({
    data: {
      oppositionId: opposition.id,
      name: "Convocatoria 2026",
      year: 2026,
      examDate: new Date("2026-11-14T09:00:00Z"),
      positions: 1250,
      status: "OPEN",
      isDefault: true,
    },
  });

  const course = await db.course.create({
    data: {
      oppositionEditionId: edition.id,
      name: "Curso anual 2026",
      code: "AGE-2026",
      modality: "HIBRIDO",
      status: "ACTIVE",
      startDate: new Date("2025-09-15"),
      endDate: new Date("2026-11-01"),
      capacity: 120,
    },
  });

  const grupos = await Promise.all(
    [
      { name: "Mañana", schedule: "L-X-V · 10:00 a 13:00", modality: "PRESENCIAL" as const },
      { name: "Tarde", schedule: "M-J · 17:00 a 20:30", modality: "PRESENCIAL" as const },
      { name: "Online", schedule: "Clases en directo M-J · 19:00", modality: "ONLINE" as const },
    ].map((grupo, index) =>
      db.group.create({
        data: { courseId: course.id, capacity: 40, status: "ACTIVE", ...grupo, color: ["#4F46E5", "#0EA5E9", "#16A34A"][index] },
      }),
    ),
  );

  // ── Árbol de contenido. Los nombres los pone la academia. ──
  const temario = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "SYLLABUS",
    label: "Temario",
    icon: "book-open",
    status: "PUBLISHED",
    // La demostración deja el temario descargable para que se pueda enseñar la
    // mochila del alumnado —estudiar sin cobertura— sin tener que configurarlo
    // a mano. En una academia real esta bandera es una decisión suya, y por eso
    // viene cerrada por defecto.
    downloadable: true,
  });

  const bloques = [
    {
      label: "Bloque I · Organización pública",
      temas: [
        "La Constitución Española de 1978",
        "La Corona y las Cortes Generales",
        "El Gobierno y la Administración",
        "La organización territorial del Estado",
      ],
    },
    {
      label: "Bloque II · Actividad administrativa",
      temas: [
        "El acto administrativo",
        "El procedimiento administrativo común",
        "Los recursos administrativos",
        "El silencio administrativo y los plazos",
      ],
    },
    {
      label: "Bloque III · Gestión de personal",
      temas: [
        "El Estatuto Básico del Empleado Público",
        "Derechos y deberes de los funcionarios",
        "Situaciones administrativas",
      ],
    },
  ];

  const temas: { id: string; label: string }[] = [];

  for (const bloque of bloques) {
    const nodoBloque = await createContentNode(db, {
      editionId: edition.id,
      parentId: temario.id,
      kind: "FOLDER",
      label: bloque.label,
      status: "PUBLISHED",
    });

    for (const [index, tema] of bloque.temas.entries()) {
      const nodoTema = await createContentNode(db, {
        editionId: edition.id,
        parentId: nodoBloque.id,
        kind: "TOPIC",
        label: `Tema ${temas.length + 1} · ${tema}`,
        status: "PUBLISHED",
        estimatedMinutes: 90 + index * 10,
        // Los dos primeros temas son de muestra gratuita: sirven para enseñar
        // la plataforma a un alumno que aún no ha comprado nada.
        isFree: temas.length < 2,
      });
      temas.push({ id: nodoTema.id, label: nodoTema.label });
    }
  }

  const clases = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "CLASSES",
    label: "Clases",
    icon: "calendar-days",
    status: "PUBLISHED",
  });

  const tests = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "TESTS",
    label: "Tests y simulacros",
    icon: "list-checks",
    status: "PUBLISHED",
  });

  const normativa = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "LEGISLATION",
    label: "Normativa",
    icon: "scale",
    status: "PUBLISHED",
    downloadable: true,
  });

  // ── Productos y packs ──
  const cursoCompleto = await db.product.create({
    data: {
      name: "Curso completo Administrativo 2026",
      slug: "curso-completo-administrativo-2026",
      description: "Temario, clases en directo, tests, simulacros y Geminis IA.",
      priceCents: 6900,
      billing: "MONTHLY",
      status: "ACTIVE",
      oppositionId: opposition.id,
      editionId: edition.id,
      courseId: course.id,
    },
  });
  await db.productGrant.createMany({
    data: [
      { productId: cursoCompleto.id, nodeId: temario.id, capability: "VIEW_CONTENT" },
      { productId: cursoCompleto.id, nodeId: clases.id, capability: "VIEW_CONTENT" },
      { productId: cursoCompleto.id, nodeId: clases.id, capability: "ATTEND_CLASSES" },
      { productId: cursoCompleto.id, nodeId: clases.id, capability: "WATCH_RECORDINGS" },
      // VIEW_CONTENT hace falta también aquí: sin él, quien tiene el curso
      // completo puede hacer los tests pero no abrir la sección para verlos, y
      // la pantalla de estudiar le enseñaba un enlace que daba 404. Lo destapó
      // la batería de ataque comparando lo que se lista con lo que se abre.
      { productId: cursoCompleto.id, nodeId: tests.id, capability: "VIEW_CONTENT" },
      { productId: cursoCompleto.id, nodeId: tests.id, capability: "TAKE_TESTS" },
      { productId: cursoCompleto.id, nodeId: tests.id, capability: "TAKE_SIMULATIONS" },
      { productId: cursoCompleto.id, nodeId: normativa.id, capability: "VIEW_CONTENT" },
      { productId: cursoCompleto.id, nodeId: temario.id, capability: "USE_AI_TUTOR" },
      // El curso completo incluye llevarse el temario. Ver y descargar son
      // permisos distintos a propósito (§113), y sin este derecho la mochila
      // del alumnado —estudiar sin cobertura— quedaba inalcanzable en la
      // demostración: la pantalla salía vacía y los ataques que la prueban
      // pasaban sin haber probado nada. El pack de solo tests NO lo lleva, que
      // es lo que mantiene el contraste entre los dos planes.
      { productId: cursoCompleto.id, nodeId: temario.id, capability: "DOWNLOAD_CONTENT" },
    ],
  });

  const packTests = await db.product.create({
    data: {
      name: "Pack solo tests",
      slug: "pack-solo-tests",
      description: "Acceso al banco de tests y simulacros. Sin temario ni clases.",
      priceCents: 1900,
      billing: "MONTHLY",
      status: "ACTIVE",
      oppositionId: opposition.id,
      editionId: edition.id,
    },
  });
  await db.productGrant.createMany({
    data: [
      { productId: packTests.id, nodeId: tests.id, capability: "VIEW_CONTENT" },
      { productId: packTests.id, nodeId: tests.id, capability: "TAKE_TESTS" },
      { productId: packTests.id, nodeId: tests.id, capability: "TAKE_SIMULATIONS" },
    ],
  });

  const packClases = await db.product.create({
    data: {
      name: "Pack solo clases online",
      slug: "pack-solo-clases",
      description: "Clases en directo y grabaciones. Sin temario.",
      priceCents: 3900,
      billing: "MONTHLY",
      status: "ACTIVE",
      oppositionId: opposition.id,
      editionId: edition.id,
    },
  });
  await db.productGrant.createMany({
    data: [
      { productId: packClases.id, nodeId: clases.id, capability: "VIEW_CONTENT" },
      { productId: packClases.id, nodeId: clases.id, capability: "ATTEND_CLASSES" },
      { productId: packClases.id, nodeId: clases.id, capability: "WATCH_RECORDINGS" },
    ],
  });

  const packTemario = await db.product.create({
    data: {
      name: "Solo temario",
      slug: "solo-temario",
      description: "Temario completo y normativa. Sin clases ni tests.",
      priceCents: 2900,
      billing: "MONTHLY",
      status: "ACTIVE",
      oppositionId: opposition.id,
      editionId: edition.id,
    },
  });
  await db.productGrant.createMany({
    data: [
      { productId: packTemario.id, nodeId: temario.id, capability: "VIEW_CONTENT" },
      { productId: packTemario.id, nodeId: normativa.id, capability: "VIEW_CONTENT" },
    ],
  });

  return {
    opposition,
    edition,
    course,
    grupos,
    secciones: { temario, clases, tests, normativa },
    temas,
    productos: { cursoCompleto, packTests, packClases, packTemario },
  };
}

// ── Oposición 2 · Magisterio (terminología LOMLOE actual) ────────────────────

async function seedMagisterio(db: ReturnType<typeof tenantDb>, typeId: string) {
  const opposition = await db.opposition.create({
    data: {
      typeId,
      name: "Maestros · Educación Primaria",
      slug: "maestros-educacion-primaria",
      authority: "Consejería de Educación",
      scope: "Autonómico",
      status: "ACTIVE",
      description:
        "Cuerpo de Maestros, especialidad de Educación Primaria. Incluye prueba práctica y defensa.",
    },
  });

  const edition = await db.oppositionEdition.create({
    data: {
      oppositionId: opposition.id,
      name: "Convocatoria 2026",
      year: 2026,
      examDate: new Date("2026-06-20T09:00:00Z"),
      positions: 340,
      status: "OPEN",
      isDefault: true,
    },
  });

  const course = await db.course.create({
    data: {
      oppositionEditionId: edition.id,
      name: "Preparación 2026",
      modality: "ONLINE",
      status: "ACTIVE",
      startDate: new Date("2025-10-01"),
    },
  });

  const grupo = await db.group.create({
    data: {
      courseId: course.id,
      name: "Online tarde",
      schedule: "L-X · 18:00 a 20:00",
      modality: "ONLINE",
      status: "ACTIVE",
    },
  });

  /*
   * Esta oposición existe en la demo justamente para demostrar que Geminis NO
   * impone la estructura: las secciones se llaman como toca hoy en Magisterio
   * ("Programación de aula", "Situaciones de aprendizaje") y no como se llamaban
   * antes. El día que la ley vuelva a cambiar el nombre, la academia lo edita
   * desde la interfaz y no hay que tocar una línea de código.
   */
  const temario = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "SYLLABUS",
    label: "Temario",
    status: "PUBLISHED",
  });

  for (const [index, tema] of [
    "Características del desarrollo en la etapa de Primaria",
    "La ordenación de la etapa: competencias clave y perfil de salida",
    "Evaluación competencial y criterios de evaluación",
  ].entries()) {
    await createContentNode(db, {
      editionId: edition.id,
      parentId: temario.id,
      kind: "TOPIC",
      label: `Tema ${index + 1} · ${tema}`,
      status: "PUBLISHED",
      estimatedMinutes: 120,
      isFree: index === 0,
    });
  }

  const programacion = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "LIBRARY",
    label: "Programación de aula",
    description:
      "Modelos, plantillas y ejemplos de programación revisados por el preparador.",
    status: "PUBLISHED",
    downloadable: true,
  });

  await createContentNode(db, {
    editionId: edition.id,
    parentId: programacion.id,
    kind: "FOLDER",
    label: "Plantillas oficiales",
    status: "PUBLISHED",
  });

  const situaciones = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "LIBRARY",
    label: "Situaciones de aprendizaje",
    description: "Situaciones de aprendizaje por áreas y por trimestre.",
    status: "PUBLISHED",
  });

  for (const area of ["Lengua Castellana", "Matemáticas", "Conocimiento del Medio"]) {
    await createContentNode(db, {
      editionId: edition.id,
      parentId: situaciones.id,
      kind: "FOLDER",
      label: area,
      status: "PUBLISHED",
    });
  }

  const supuestos = await createContentNode(db, {
    editionId: edition.id,
    kind: "SECTION",
    sectionKind: "PRACTICAL",
    label: "Supuestos prácticos",
    status: "PUBLISHED",
  });

  const producto = await db.product.create({
    data: {
      name: "Preparación completa Primaria 2026",
      slug: "preparacion-primaria-2026",
      priceCents: 7900,
      billing: "MONTHLY",
      status: "ACTIVE",
      oppositionId: opposition.id,
      editionId: edition.id,
      courseId: course.id,
    },
  });

  await db.productGrant.createMany({
    data: [temario, programacion, situaciones, supuestos].map((nodo) => ({
      productId: producto.id,
      nodeId: nodo.id,
      capability: "VIEW_CONTENT" as const,
    })),
  });

  return { opposition, edition, course, grupo, secciones: { temario, programacion, situaciones, supuestos }, producto };
}

// ── Personas y accesos ───────────────────────────────────────────────────────

type Administrativo = Awaited<ReturnType<typeof seedAdministrativo>>;
type Magisterio = Awaited<ReturnType<typeof seedMagisterio>>;

async function seedProfesorado(
  db: ReturnType<typeof tenantDb>,
  profesores: { membership: { id: string } }[],
  administrativo: Administrativo,
  magisterio: Magisterio,
) {
  await db.teacherAssignment.createMany({
    data: [
      {
        teacherId: profesores[0].membership.id,
        oppositionId: administrativo.opposition.id,
        editionId: administrativo.edition.id,
        isCoordinator: true,
      },
      {
        teacherId: profesores[1].membership.id,
        oppositionId: magisterio.opposition.id,
        editionId: magisterio.edition.id,
        isCoordinator: true,
      },
    ],
  });
}

const NOMBRES = [
  ["Lucía", "Marín"], ["Carlos", "Ferrer"], ["Antonio", "Delgado"], ["María", "Cano"],
  ["Elena", "Vidal"], ["Pablo", "Ortiz"], ["Sara", "Iglesias"], ["Diego", "Moya"],
  ["Ana", "Bermúdez"], ["Rubén", "Castaño"], ["Irene", "Salas"], ["Marcos", "Peña"],
  ["Nerea", "Ibáñez"], ["Álvaro", "Rincón"], ["Cristina", "Lozano"], ["Hugo", "Merino"],
  ["Patricia", "Guerra"], ["Sergio", "Blanco"], ["Alba", "Cordero"], ["Iván", "Nogales"],
];

async function seedAlumnado(academyId: string) {
  const alumnos = [];

  for (const [index, [firstName, lastName]] of NOMBRES.entries()) {
    const numero = index + 1;
    const { membership } = await addMemberToAcademy(academyId, {
      email: `alumno${numero}@academiademo.test`,
      firstName,
      lastName,
      password: DEMO_PASSWORD,
      roleKeys: ["STUDENT"],
    });

    // Actividad repartida a propósito: algunos al día, otros desconectados.
    // Sirve para probar el módulo de riesgo de abandono sin inventar nada.
    const diasSinActividad = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 9, 11, 14, 17, 21, 26, 33, 41, 60][index];

    await prismaBase.studentProfile.create({
      data: {
        membershipId: membership.id,
        code: `EXP-${String(numero).padStart(4, "0")}`,
        status: index >= 18 ? "ON_HOLD" : "ACTIVE",
        source: ["Recomendación", "Google", "Instagram", "Antiguo alumno"][index % 4],
        lastActivityAt: new Date(Date.now() - diasSinActividad * 24 * 60 * 60 * 1000),
      },
    });

    alumnos.push({ membershipId: membership.id, index });
  }

  return alumnos;
}

async function seedMatriculasYAccesos(
  db: ReturnType<typeof tenantDb>,
  alumnos: { membershipId: string; index: number }[],
  administrativo: Administrativo,
  magisterio: Magisterio,
) {
  for (const alumno of alumnos) {
    const esMagisterio = alumno.index >= 14;

    const course = esMagisterio ? magisterio.course : administrativo.course;
    const groupId = esMagisterio
      ? magisterio.grupo.id
      : administrativo.grupos[alumno.index % 3].id;

    const enrollment = await db.enrollment.create({
      data: {
        studentId: alumno.membershipId,
        courseId: course.id,
        groupId,
        status: alumno.index >= 18 ? "SUSPENDED" : "ACTIVE",
        startDate: new Date(Date.now() - (30 + alumno.index * 5) * 24 * 60 * 60 * 1000),
        priceCents: esMagisterio ? 7900 : 6900,
      },
    });

    // Reparto de productos: así la demo enseña de verdad los distintos packs.
    const producto = esMagisterio
      ? magisterio.producto
      : alumno.index % 5 === 1
        ? administrativo.productos.packTests
        : alumno.index % 5 === 2
          ? administrativo.productos.packClases
          : alumno.index % 5 === 3
            ? administrativo.productos.packTemario
            : administrativo.productos.cursoCompleto;

    const grants = await db.productGrant.findMany({
      where: { productId: producto.id },
      select: { nodeId: true, capability: true },
    });

    await db.entitlement.create({
      data: {
        studentId: alumno.membershipId,
        enrollmentId: enrollment.id,
        productId: producto.id,
        source: "PRODUCT",
        status: alumno.index >= 18 ? "SUSPENDED" : "ACTIVE",
        scopes: {
          create: grants.map((grant) => ({
            nodeId: grant.nodeId,
            capability: grant.capability,
          })),
        },
      },
    });

    await db.payment.create({
      data: {
        studentId: alumno.membershipId,
        enrollmentId: enrollment.id,
        productId: producto.id,
        concept: `Mensualidad · ${producto.name}`,
        amountCents: producto.priceCents,
        status: alumno.index % 7 === 0 ? "PENDING" : "PAID",
        method: "SEPA_DIRECT_DEBIT",
        dueDate: new Date(),
        paidAt: alumno.index % 7 === 0 ? null : new Date(),
      },
    });
  }
}

/**
 * Exámenes de desarrollo de demostración.
 *
 * Tres, porque los tres estados que importan se ven distintos y hay que poder
 * enseñarlos: uno abierto ahora mismo con reloj, uno convocado para dentro de
 * unos días y uno ya corregido con su nota y su comentario.
 */
async function seedExamenes(
  db: ReturnType<typeof tenantDb>,
  administrativo: Administrativo,
  teacherId: string,
) {
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  // Se convoca a todo el curso y no a un grupo suelto: en la demo el alumnado
  // está repartido en tres grupos, y un examen de uno solo dejaría a dos
  // tercios de la lista sin nada que enseñar.
  const matriculados = await db.enrollment.findMany({
    where: { courseId: administrativo.course.id, deletedAt: null },
    select: { studentId: true },
  });
  if (matriculados.length === 0) return;

  const convocar = async (datos: {
    title: string;
    instructions: string;
    opensAt: Date | null;
    dueAt: Date | null;
    timeLimitMinutes: number | null;
  }) => {
    const examen = await db.assignment.create({
      data: {
        kind: "EXAM",
        title: datos.title,
        instructions: datos.instructions,
        courseId: administrativo.course.id,
        editionId: administrativo.edition.id,
        opensAt: datos.opensAt,
        dueAt: datos.dueAt,
        timeLimitMinutes: datos.timeLimitMinutes,
        maxScore: 10,
        allowLate: false,
        status: "PUBLISHED",
        createdById: teacherId,
      },
    });

    await db.submission.createMany({
      data: matriculados.map((m) => ({
        assignmentId: examen.id,
        studentId: m.studentId,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });

    return examen;
  };

  // 1. Abierto ahora, con reloj de 90 minutos.
  await convocar({
    title: "Examen de desarrollo · El acto administrativo",
    instructions:
      "Desarrolle el concepto de acto administrativo, sus elementos y sus clases, " +
      "con especial atención a los requisitos de validez. Extensión orientativa: cuatro caras.",
    opensAt: new Date(ahora - 2 * 60 * 60 * 1000),
    dueAt: new Date(ahora + 5 * dia),
    timeLimitMinutes: 90,
  });

  // 2. Convocado para dentro de una semana: todavía no se puede empezar.
  await convocar({
    title: "Examen de desarrollo · Procedimiento administrativo común",
    instructions:
      "Fases del procedimiento administrativo común, con los plazos de cada una " +
      "y las consecuencias de su incumplimiento.",
    opensAt: new Date(ahora + 7 * dia),
    dueAt: new Date(ahora + 7 * dia + 3 * 60 * 60 * 1000),
    timeLimitMinutes: 120,
  });

  // 3. Uno pasado y corregido, para que la primera alumna vea una nota suya.
  const corregido = await convocar({
    title: "Examen de desarrollo · Fuentes del Derecho administrativo",
    instructions: "Jerarquía normativa y potestad reglamentaria.",
    opensAt: new Date(ahora - 20 * dia),
    dueAt: new Date(ahora - 20 * dia + 2 * 60 * 60 * 1000),
    timeLimitMinutes: 90,
  });

  // Un simulacro publicado, atado a SU convocatoria. Además de dar contenido a
  // la demo, es lo que hace que la batería de ataque pueda comprobar que un
  // alumno de otra oposición no lo abre: sin ninguno publicado, ese ataque no
  // se lanzaba y la batería terminaba en verde sin haberlo probado.
  await db.testDefinition.create({
    data: {
      title: "Simulacro · Bloque I de Administrativo",
      description:
        "Cincuenta preguntas de los temas abiertos, con el tiempo y la penalización del examen real.",
      kind: "SIMULATION",
      status: "PUBLISHED",
      editionId: administrativo.edition.id,
      questionCount: 50,
      timeLimitMinutes: 70,
      penaltyPerWrong: 0.33,
      revealMode: "AT_END",
      maxAttempts: 2,
      availableFrom: new Date(ahora - dia),
      availableUntil: new Date(ahora + 30 * dia),
      createdById: teacherId,
    },
  });

  const primera = matriculados[0];
  await db.submission.updateMany({
    where: { assignmentId: corregido.id, studentId: primera.studentId },
    data: {
      status: "GRADED",
      startedAt: new Date(ahora - 20 * dia),
      submittedAt: new Date(ahora - 20 * dia + 80 * 60 * 1000),
      draftSavedAt: new Date(ahora - 20 * dia + 80 * 60 * 1000),
      body:
        "La jerarquía normativa se recoge en el artículo 9.3 de la Constitución. " +
        "En el ámbito administrativo se concreta en el artículo 128 de la Ley 39/2015…",
      score: 7.5,
      feedback:
        "Bien estructurado y con las citas correctas. Te falta desarrollar el " +
        "principio de competencia frente al de jerarquía: repásalo, cae mucho.",
      gradedById: teacherId,
      gradedAt: new Date(ahora - 18 * dia),
    },
  });
}

async function seedClases(
  db: ReturnType<typeof tenantDb>,
  administrativo: Administrativo,
  teacherId: string,
) {
  const base = new Date();
  base.setHours(18, 0, 0, 0);

  for (let i = -3; i <= 4; i += 1) {
    const startsAt = new Date(base.getTime() + i * 2 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);

    await db.classSession.create({
      data: {
        editionId: administrativo.edition.id,
        courseId: administrativo.course.id,
        groupId: administrativo.grupos[2].id,
        teacherId,
        nodeId: administrativo.temas[Math.abs(i) % administrativo.temas.length].id,
        title: `Clase ${i + 4} · ${administrativo.temas[Math.abs(i) % administrativo.temas.length].label}`,
        status: i < 0 ? "FINISHED" : "SCHEDULED",
        startsAt,
        endsAt,
        durationMinutes: 90,
        meetingProvider: "external",
        meetingUrl: "https://ejemplo.test/aula-virtual",
      },
    });
  }
}

async function seedPreguntas(
  db: ReturnType<typeof tenantDb>,
  administrativo: Administrativo,
  authorId: string,
) {
  const banco = [
    {
      tema: 4,
      statement:
        "Conforme a la Ley 39/2015, el plazo general para resolver un procedimiento iniciado de oficio, si la norma no fija otro, es de:",
      opciones: ["Un mes", "Tres meses", "Seis meses", "Un año"],
      correcta: 1,
      explicacion:
        "El artículo 21.3 fija tres meses cuando las normas reguladoras no establecen un plazo distinto.",
    },
    {
      tema: 5,
      statement:
        "El silencio administrativo en procedimientos iniciados a solicitud del interesado tiene, con carácter general, efecto:",
      opciones: ["Desestimatorio", "Estimatorio", "Sin efecto", "Depende del órgano"],
      correcta: 1,
      explicacion:
        "El artículo 24.1 establece el silencio positivo como regla general, con las excepciones que el propio precepto enumera.",
    },
    {
      tema: 5,
      statement: "El recurso de alzada se interpone ante:",
      opciones: [
        "El mismo órgano que dictó el acto",
        "El órgano superior jerárquico",
        "El órgano judicial competente",
        "El Defensor del Pueblo",
      ],
      correcta: 1,
      explicacion:
        "Puede presentarse ante el órgano que dictó el acto o ante el superior jerárquico, que es quien lo resuelve.",
    },
  ];

  for (const item of banco) {
    const nodo = administrativo.temas[item.tema];
    const question = await db.question.create({
      data: {
        editionId: administrativo.edition.id,
        nodeId: nodo.id,
        type: "SINGLE_CHOICE",
        difficulty: "MEDIUM",
        status: "PUBLISHED",
        source: "MANUAL",
        statement: item.statement,
        explanation: item.explicacion,
        authorId,
        reviewerId: authorId,
        reviewedAt: new Date(),
      },
    });

    // Las opciones se crean en su propia llamada, no anidadas: las escrituras
    // anidadas no pasan por la guardia multi-tenant y `academyId` quedaría sin
    // rellenar. Es la regla general del proyecto (ver docs/SECURITY_MODEL.md).
    await db.questionOption.createMany({
      data: item.opciones.map((text, position) => ({
        questionId: question.id,
        text,
        position,
        isCorrect: position === item.correcta,
      })),
    });
  }
}

main()
  .catch((error) => {
    console.error("\n✗ La siembra ha fallado:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
