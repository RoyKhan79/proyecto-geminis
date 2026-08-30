/**
 * CATÁLOGO DE PERMISOS
 * ────────────────────
 * Fuente única de verdad del RBAC (§50). Las comprobaciones se hacen SIEMPRE
 * contra estas claves, nunca con condicionales sueltos del tipo
 * `if (rol === "profesor")` repartidos por la aplicación.
 *
 * Un permiso responde a "¿puede hacer esto?". El "¿sobre qué datos?" es otra
 * cosa distinta y se resuelve con el alcance: las asignaciones del profesor
 * (TeacherAssignment) y los derechos de acceso del alumno (Entitlement).
 * Ver docs/PERMISSIONS.md.
 */

export const PERMISSION_GROUPS = {
  personas: "Personas",
  academico: "Académico",
  contenido: "Contenido",
  evaluacion: "Evaluación",
  normativa: "Normativa",
  gestion: "Gestión",
  ia: "Inteligencia Artificial",
  plataforma: "Plataforma",
} as const;

type Group = keyof typeof PERMISSION_GROUPS;

function p(group: Group, label: string) {
  return { group, label } as const;
}

/**
 * EL CATÁLOGO ÚNICO DE PERMISOS.
 *
 * Cada permiso existe aquí y en ningún otro sitio. Un permiso que no esté en
 * esta tabla no se puede conceder, comprobar ni pintar, y eso es deliberado:
 * los sistemas de permisos se pudren cuando cada pantalla inventa el suyo.
 *
 * El nombre va en `área.verbo` para que se lea sin explicación: `students.read`
 * se entiende sin ir a buscar qué hace.
 */
export const PERMISSIONS = {
  // ── Personas ───────────────────────────────────────────────────────────────
  "students.read": p("personas", "Ver alumnos"),
  "students.write": p("personas", "Crear y editar alumnos"),
  "students.delete": p("personas", "Dar de baja y eliminar alumnos"),
  "students.notes": p("personas", "Ver observaciones internas del alumno"),
  "teachers.read": p("personas", "Ver profesores"),
  "teachers.write": p("personas", "Crear y editar profesores"),
  "members.invite": p("personas", "Invitar usuarios a la academia"),
  "roles.read": p("personas", "Ver roles y permisos"),
  "roles.write": p("personas", "Modificar roles y permisos"),

  // ── Académico ──────────────────────────────────────────────────────────────
  "oppositions.read": p("academico", "Ver oposiciones"),
  "oppositions.write": p("academico", "Crear y editar oposiciones y convocatorias"),
  "courses.read": p("academico", "Ver cursos"),
  "courses.write": p("academico", "Crear y editar cursos"),
  "groups.read": p("academico", "Ver grupos"),
  "groups.write": p("academico", "Crear y editar grupos"),
  "enrollments.read": p("academico", "Ver matrículas"),
  "enrollments.write": p("academico", "Matricular y modificar matrículas"),
  "classes.read": p("academico", "Ver clases"),
  "classes.write": p("academico", "Programar y editar clases"),
  "attendance.write": p("academico", "Pasar lista"),

  // ── Contenido ──────────────────────────────────────────────────────────────
  "content.read": p("contenido", "Ver contenido de la academia"),
  "content.write": p("contenido", "Crear y editar contenido"),
  "content.publish": p("contenido", "Publicar contenido para el alumnado"),
  "content.delete": p("contenido", "Eliminar contenido"),
  "content.settings": p("contenido", "Configurar secciones, descargas y marcas de agua"),

  // ── Evaluación ─────────────────────────────────────────────────────────────
  "questions.read": p("evaluacion", "Ver banco de preguntas"),
  "questions.write": p("evaluacion", "Crear y editar preguntas"),
  "questions.publish": p("evaluacion", "Aprobar y publicar preguntas"),
  "tests.read": p("evaluacion", "Ver tests y simulacros"),
  "tests.write": p("evaluacion", "Crear y editar tests y simulacros"),
  "tests.publish": p("evaluacion", "Publicar tests y simulacros"),
  "attempts.read.all": p("evaluacion", "Ver los resultados de cualquier alumno"),
  "attempts.take": p("evaluacion", "Realizar tests"),

  // ── Normativa ──────────────────────────────────────────────────────────────
  "legislation.read": p("normativa", "Consultar normativa"),
  "legislation.write": p("normativa", "Registrar y editar normativa"),
  "legislation.review": p("normativa", "Revisar y resolver alertas de cambio legislativo"),

  // ── Gestión ────────────────────────────────────────────────────────────────
  "analytics.read": p("gestion", "Ver analítica de la academia"),
  "communications.send": p("gestion", "Enviar comunicaciones"),
  "payments.read": p("gestion", "Ver pagos y recibos"),
  "payments.write": p("gestion", "Registrar y modificar pagos"),
  "products.read": p("gestion", "Ver catálogo de productos"),
  "products.write": p("gestion", "Crear y editar productos y packs"),
  "entitlements.write": p("gestion", "Conceder o retirar acceso a contenido"),
  "imports.run": p("gestion", "Importar datos"),
  "imports.rollback": p("gestion", "Revertir una importación"),
  "audit.read": p("gestion", "Consultar el registro de auditoría"),
  "settings.read": p("gestion", "Ver la configuración de la academia"),
  "settings.write": p("gestion", "Modificar la configuración de la academia"),
  "data.export": p("gestion", "Exportar los datos de la academia"),

  // ── IA ─────────────────────────────────────────────────────────────────────
  "ai.student": p("ia", "Usar Geminis IA como alumno"),
  "ai.copilot": p("ia", "Usar el Copiloto del profesor"),
  "ai.settings": p("ia", "Configurar Geminis IA y sus fuentes"),

  // ── Acceso a las dos aplicaciones ──────────────────────────────────────────
  "manager.access": p("plataforma", "Entrar en Geminis Manager"),
  "campus.access": p("plataforma", "Entrar en Geminis Campus"),
} as const;

/**
 * Un permiso válido.
 *
 * Sale del propio catálogo, así que escribir mal un permiso no compila. Es la
 * diferencia entre un error a las cinco de la tarde y un agujero que nadie ve.
 */
export type Permission = keyof typeof PERMISSIONS;

/** Todos los permisos. Lo usan la pantalla de configuración y la auditoría. */
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// ─────────────────────────────────────────────────────────────────────────────
// LOS TRES NIVELES
//
// Hay tres alturas y no se mezclan nunca:
//
//   1 · SUPERADMINISTRADOR DE LA PLATAFORMA
//       `User.isPlatformAdmin`. Da de alta academias, ve el estado del servicio
//       y da soporte. NO pertenece a ninguna academia y por tanto NO ve el
//       contenido, los alumnos ni los datos de ninguna. Para entrar en una
//       tiene que impersonar, y la impersonación queda registrada (§3). No es
//       una limitación técnica que se pueda saltar: sin `Membership` no hay
//       `tenantDb`, y sin `tenantDb` no hay datos.
//
//   2 · ADMINISTRADOR DE ACADEMIA
//       Rol `ACADEMY_ADMIN` dentro de SU academia. Manda sobre todo lo suyo:
//       alumnos, profesorado, contenido, cobros, facturas, IA y configuración.
//       No puede ver nada de otra academia, y eso lo garantizan dos barreras
//       independientes (ver docs/SECURITY_MODEL.md).
//
//   3 · USUARIOS DE LA ACADEMIA
//       Profesorado, personal administrativo y alumnado. Cada uno con lo suyo:
//       · TEACHER — su gente y su contenido,
//       · STAFF   — matrículas, cobros y comunicaciones, sin datos académicos
//                   sensibles,
//       · STUDENT — solo el Campus, y dentro de él solo lo que tenga contratado.
//
// La frontera que importa es la de arriba: el nivel 1 no ve datos, y el nivel 2
// no ve más allá de su academia.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los tres niveles del sistema, explicados para leer.
 *
 * Se pinta tal cual en la configuración de la academia. Está aquí y no en la
 * pantalla porque la frontera entre niveles es una decisión del producto, y la
 * explicación tiene que vivir al lado de lo que la implementa.
 */
export const NIVELES = [
  {
    nivel: 1,
    clave: "PLATAFORMA",
    nombre: "Superadministrador de la plataforma",
    resumen:
      "Da de alta academias y presta soporte. No pertenece a ninguna academia, así que no ve el contenido de ninguna.",
    donde: "/plataforma",
  },
  {
    nivel: 2,
    clave: "ACADEMY_ADMIN",
    nombre: "Administrador de la academia",
    resumen:
      "Manda sobre todo lo de SU academia y sobre nada de las demás.",
    donde: "/gestion",
  },
  {
    nivel: 3,
    clave: "USUARIOS",
    nombre: "Usuarios de la academia",
    resumen:
      "Profesorado, personal administrativo y alumnado, cada uno con sus permisos.",
    donde: "/gestion y /campus",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ROLES DEL SISTEMA
// Cada academia recibe una copia editable de estos roles al crearse.
// ─────────────────────────────────────────────────────────────────────────────

/** Las claves de los roles que trae el sistema de fábrica. */
export const SYSTEM_ROLE_KEYS = {
  ACADEMY_ADMIN: "ACADEMY_ADMIN",
  TEACHER: "TEACHER",
  STAFF: "STAFF",
  STUDENT: "STUDENT",
} as const;

/** Uno de los roles de fábrica. La academia puede crear más además de estos. */
export type SystemRoleKey = keyof typeof SYSTEM_ROLE_KEYS;

const TEACHER_PERMISSIONS: Permission[] = [
  "manager.access",
  "students.read",
  "students.notes",
  "teachers.read",
  "oppositions.read",
  "courses.read",
  "groups.read",
  "enrollments.read",
  "classes.read",
  "classes.write",
  "attendance.write",
  "content.read",
  "content.write",
  "content.publish",
  "content.settings",
  "questions.read",
  "questions.write",
  "questions.publish",
  "tests.read",
  "tests.write",
  "tests.publish",
  "attempts.read.all",
  "legislation.read",
  "legislation.write",
  "legislation.review",
  "analytics.read",
  "communications.send",
  "entitlements.write",
  "ai.copilot",
];

const STAFF_PERMISSIONS: Permission[] = [
  "manager.access",
  "students.read",
  "students.write",
  "teachers.read",
  "members.invite",
  "oppositions.read",
  "courses.read",
  "groups.read",
  "groups.write",
  "enrollments.read",
  "enrollments.write",
  "classes.read",
  "communications.send",
  "payments.read",
  "payments.write",
  "products.read",
  "imports.run",
  "analytics.read",
];

const STUDENT_PERMISSIONS: Permission[] = [
  "campus.access",
  // OJO: el alumnado NO lleva "content.read". Ese permiso significa "ver el
  // contenido de la academia como personal" y se usa para distinguir al equipo
  // del alumnado. Lo que un alumno puede ver lo deciden sus derechos de acceso,
  // no un permiso. Dárselo abriría un agujero: cualquiera pasaría por personal.
  "classes.read",
  "tests.read",
  "attempts.take",
  "legislation.read",
  "ai.student",
];

/**
 * Qué puede hacer cada rol de fábrica.
 *
 * Es la definición de la que salen los roles al dar de alta una academia. Un
 * detalle que importa: el alumnado **no** lleva `content.read`. Ese permiso
 * significa «ver el contenido como personal de la academia», y dárselo a un
 * alumno le abriría el temario entero saltándose sus derechos de acceso.
 */
export const SYSTEM_ROLES: Record<
  SystemRoleKey,
  { name: string; description: string; permissions: Permission[] }
> = {
  ACADEMY_ADMIN: {
    name: "Administrador",
    description: "Gestiona toda la academia.",
    // El administrador tiene todo salvo lo que solo tiene sentido para alumnos.
    permissions: ALL_PERMISSIONS.filter(
      (perm) => perm !== "campus.access" && perm !== "attempts.take" && perm !== "ai.student",
    ),
  },
  TEACHER: {
    name: "Profesor / Preparador",
    description:
      "Trabaja sobre las oposiciones, grupos y alumnos que tenga asignados.",
    permissions: TEACHER_PERMISSIONS,
  },
  STAFF: {
    name: "Personal administrativo",
    description:
      "Gestión de matrículas, altas, bajas, recibos y comunicaciones administrativas.",
    permissions: STAFF_PERMISSIONS,
  },
  STUDENT: {
    name: "Alumno",
    description: "Accede a Geminis Campus con el contenido que tenga contratado.",
    permissions: STUDENT_PERMISSIONS,
  },
};

/**
 * ¿Es un permiso del catálogo?
 *
 * @param value Un texto cualquiera, normalmente venido de la base de datos.
 * @returns `true` si existe, y además se lo dice a TypeScript. Se usa al leer
 *   los permisos guardados: un permiso que se renombró en el código y sigue en
 *   una fila antigua no puede colarse como válido.
 */
export function isValidPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}
