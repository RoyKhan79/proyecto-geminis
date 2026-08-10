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

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// ─────────────────────────────────────────────────────────────────────────────
// ROLES DEL SISTEMA
// Cada academia recibe una copia editable de estos roles al crearse.
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_ROLE_KEYS = {
  ACADEMY_ADMIN: "ACADEMY_ADMIN",
  TEACHER: "TEACHER",
  STAFF: "STAFF",
  STUDENT: "STUDENT",
} as const;

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

export function isValidPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}
