import type { ImportRowStatus } from "@/generated/prisma/enums";
import { prismaBase } from "@/lib/db/client";
import type { TenantClient } from "@/lib/db/tenant";
import { addMemberToAcademy } from "@/server/academies/provision";

/**
 * GEMINIS IMPORT · alumnos
 *
 * El proceso es siempre el mismo y en este orden:
 *
 *   subir → mapear columnas → VALIDAR → SIMULAR → importar → (poder revertir)
 *
 * La simulación no es un adorno. Una academia que se plantea cambiar de
 * programa necesita ver, antes de tocar nada, exactamente qué va a pasar con
 * sus 800 alumnos. Y necesita saber que si sale mal puede deshacerlo.
 */

export type FieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "code"
  | "status"
  | "source"
  | "notes"
  | "courseName"
  | "groupName";

export const STUDENT_FIELDS: {
  key: FieldKey;
  label: string;
  required: boolean;
  hint?: string;
  aliases: string[];
}[] = [
  {
    key: "firstName",
    label: "Nombre",
    required: true,
    aliases: ["nombre", "name", "first name", "firstname", "nombre alumno"],
  },
  {
    key: "lastName",
    label: "Apellidos",
    required: false,
    aliases: ["apellidos", "apellido", "last name", "lastname", "surname"],
  },
  {
    key: "email",
    label: "Correo electrónico",
    required: true,
    hint: "Es su usuario de acceso al Campus y sirve para detectar duplicados.",
    aliases: ["email", "correo", "e-mail", "correo electronico", "mail"],
  },
  {
    key: "phone",
    label: "Teléfono",
    required: false,
    aliases: ["telefono", "teléfono", "phone", "movil", "móvil", "tlf"],
  },
  {
    key: "code",
    label: "Nº de expediente",
    required: false,
    aliases: ["expediente", "codigo", "código", "matricula", "num", "id"],
  },
  {
    key: "status",
    label: "Estado",
    required: false,
    hint: "activo, pendiente, baja temporal, baja o antiguo alumno.",
    aliases: ["estado", "situacion", "situación", "status"],
  },
  {
    key: "source",
    label: "¿Cómo nos conoció?",
    required: false,
    aliases: ["origen", "procedencia", "source", "como nos conocio"],
  },
  {
    key: "notes",
    label: "Observaciones",
    required: false,
    aliases: ["observaciones", "notas", "comentarios", "notes"],
  },
  {
    key: "courseName",
    label: "Curso",
    required: false,
    hint: "Si el nombre coincide con un curso existente, se matricula solo.",
    aliases: ["curso", "course", "grupo curso"],
  },
  {
    key: "groupName",
    label: "Grupo",
    required: false,
    aliases: ["grupo", "group", "turno", "clase"],
  },
];

const ESTADOS: Record<string, "PENDING" | "ACTIVE" | "ON_HOLD" | "INACTIVE" | "ALUMNI"> = {
  activo: "ACTIVE",
  activa: "ACTIVE",
  alta: "ACTIVE",
  active: "ACTIVE",
  pendiente: "PENDING",
  pending: "PENDING",
  "baja temporal": "ON_HOLD",
  suspendido: "ON_HOLD",
  suspendida: "ON_HOLD",
  baja: "INACTIVE",
  inactivo: "INACTIVE",
  inactiva: "INACTIVE",
  "antiguo alumno": "ALUMNI",
  antiguo: "ALUMNI",
  egresado: "ALUMNI",
};

export type RowMessage = { level: "error" | "warning"; text: string };

export type EvaluatedRow = {
  rowNumber: number;
  parsed: Record<string, string | null>;
  status: ImportRowStatus;
  messages: RowMessage[];
  /// Membresía existente que se actualizaría, si la hay.
  existingMembershipId: string | null;
  courseId: string | null;
  groupId: string | null;
};

type Catalogo = {
  cursos: { id: string; name: string; groups: { id: string; name: string }[] }[];
  correosExistentes: Map<string, string>;
};

async function cargarCatalogo(db: TenantClient): Promise<Catalogo> {
  const [cursos, miembros] = await Promise.all([
    db.course.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        groups: { where: { deletedAt: null }, select: { id: true, name: true } },
      },
    }),
    db.membership.findMany({
      where: { deletedAt: null },
      select: { id: true, user: { select: { email: true } } },
    }),
  ]);

  return {
    cursos,
    correosExistentes: new Map(
      miembros.map((m) => [m.user.email.toLowerCase(), m.id]),
    ),
  };
}

/**
 * Evalúa todas las filas sin escribir nada. Devuelve exactamente lo que va a
 * pasar: qué se crea, qué se actualiza, qué se salta y qué da error.
 */
export async function evaluateRows(
  db: TenantClient,
  rows: { rowNumber: number; rawData: Record<string, string> }[],
  mapping: Partial<Record<FieldKey, string>>,
  options: { onDuplicate: "update" | "skip"; defaultCourseId?: string | null },
): Promise<EvaluatedRow[]> {
  const catalogo = await cargarCatalogo(db);
  const vistosEnArchivo = new Map<string, number>();
  const evaluadas: EvaluatedRow[] = [];

  for (const row of rows) {
    const messages: RowMessage[] = [];
    const parsed: Record<string, string | null> = {};

    for (const field of STUDENT_FIELDS) {
      const columna = mapping[field.key];
      const valor = columna ? (row.rawData[columna] ?? "").trim() : "";
      parsed[field.key] = valor || null;

      if (field.required && !valor) {
        messages.push({ level: "error", text: `Falta ${field.label.toLowerCase()}.` });
      }
    }

    const email = parsed.email?.toLowerCase() ?? "";

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      messages.push({ level: "error", text: `El correo «${email}» no es válido.` });
    }
    parsed.email = email || null;

    // Duplicado dentro del propio archivo.
    if (email && vistosEnArchivo.has(email)) {
      messages.push({
        level: "error",
        text: `Correo repetido en el archivo (fila ${vistosEnArchivo.get(email)}).`,
      });
    } else if (email) {
      vistosEnArchivo.set(email, row.rowNumber);
    }

    // Estado: si no se entiende, se avisa y se deja en activo.
    if (parsed.status) {
      const normalizado = ESTADOS[parsed.status.toLowerCase().trim()];
      if (!normalizado) {
        messages.push({
          level: "warning",
          text: `Estado «${parsed.status}» no reconocido; se dará de alta como activo.`,
        });
        parsed.status = "ACTIVE";
      } else {
        parsed.status = normalizado;
      }
    } else {
      parsed.status = "ACTIVE";
    }

    // Curso y grupo por nombre.
    let courseId: string | null = options.defaultCourseId ?? null;
    let groupId: string | null = null;

    if (parsed.courseName) {
      const curso = catalogo.cursos.find(
        (c) => c.name.toLowerCase() === parsed.courseName!.toLowerCase(),
      );
      if (curso) {
        courseId = curso.id;
      } else {
        messages.push({
          level: "warning",
          text: `No existe el curso «${parsed.courseName}»; se importará sin matrícula.`,
        });
      }
    }

    if (parsed.groupName && courseId) {
      const curso = catalogo.cursos.find((c) => c.id === courseId);
      const grupo = curso?.groups.find(
        (g) => g.name.toLowerCase() === parsed.groupName!.toLowerCase(),
      );
      if (grupo) {
        groupId = grupo.id;
      } else {
        messages.push({
          level: "warning",
          text: `No existe el grupo «${parsed.groupName}» en ese curso.`,
        });
      }
    }

    const existente = email ? (catalogo.correosExistentes.get(email) ?? null) : null;

    let status: ImportRowStatus;
    if (messages.some((m) => m.level === "error")) {
      status = "ERROR";
    } else if (existente) {
      if (options.onDuplicate === "skip") {
        status = "SKIPPED";
        messages.push({ level: "warning", text: "Ya existe en la academia; se salta." });
      } else {
        status = "WARNING";
        messages.push({ level: "warning", text: "Ya existe; se actualizarán sus datos." });
      }
    } else {
      status = messages.length > 0 ? "WARNING" : "VALID";
    }

    evaluadas.push({
      rowNumber: row.rowNumber,
      parsed,
      status,
      messages,
      existingMembershipId: existente,
      courseId,
      groupId,
    });
  }

  return evaluadas;
}

export function summarize(rows: EvaluatedRow[]) {
  return {
    total: rows.length,
    crear: rows.filter((r) => r.status === "VALID" || (r.status === "WARNING" && !r.existingMembershipId)).length,
    actualizar: rows.filter((r) => r.status === "WARNING" && r.existingMembershipId).length,
    saltar: rows.filter((r) => r.status === "SKIPPED").length,
    errores: rows.filter((r) => r.status === "ERROR").length,
  };
}

/**
 * Aplica la importación. Cada fila deja constancia de qué entidad creó o
 * actualizó y de cómo estaba antes: sin eso, revertir sería imposible.
 */
export async function applyImport(
  db: TenantClient,
  academyId: string,
  jobId: string,
  rows: EvaluatedRow[],
): Promise<{ creados: number; actualizados: number; saltados: number; errores: number }> {
  let creados = 0;
  let actualizados = 0;
  let saltados = 0;
  let errores = 0;

  for (const row of rows) {
    if (row.status === "ERROR" || row.status === "SKIPPED") {
      if (row.status === "ERROR") errores += 1;
      else saltados += 1;
      await db.importRow.updateMany({
        where: { jobId, rowNumber: row.rowNumber },
        data: { status: row.status, messages: row.messages },
      });
      continue;
    }

    try {
      const esActualizacion = Boolean(row.existingMembershipId);

      const anterior = esActualizacion
        ? await prismaBase.studentProfile.findUnique({
            where: { membershipId: row.existingMembershipId! },
          })
        : null;

      const { membership } = await addMemberToAcademy(academyId, {
        email: row.parsed.email!,
        firstName: row.parsed.firstName!,
        lastName: row.parsed.lastName ?? undefined,
        phone: row.parsed.phone ?? undefined,
        roleKeys: ["STUDENT"],
      });

      await prismaBase.studentProfile.upsert({
        where: { membershipId: membership.id },
        create: {
          membershipId: membership.id,
          code: row.parsed.code,
          status: (row.parsed.status ?? "ACTIVE") as "ACTIVE",
          source: row.parsed.source,
          notes: row.parsed.notes,
        },
        update: {
          code: row.parsed.code ?? anterior?.code ?? null,
          status: (row.parsed.status ?? "ACTIVE") as "ACTIVE",
          source: row.parsed.source ?? anterior?.source ?? null,
          notes: row.parsed.notes ?? anterior?.notes ?? null,
        },
      });

      if (row.courseId) {
        const yaMatriculado = await db.enrollment.findFirst({
          where: { studentId: membership.id, courseId: row.courseId, deletedAt: null },
          select: { id: true },
        });

        if (!yaMatriculado) {
          const enrollment = await db.enrollment.create({
            data: {
              studentId: membership.id,
              courseId: row.courseId,
              groupId: row.groupId,
              status: "ACTIVE",
            },
          });

          // La matrícula concede el acceso, igual que si la hiciera una persona.
          const producto = await db.product.findFirst({
            where: { courseId: row.courseId, status: "ACTIVE" },
            select: { id: true, grants: { select: { nodeId: true, capability: true } } },
          });

          await db.entitlement.create({
            data: {
              studentId: membership.id,
              enrollmentId: enrollment.id,
              productId: producto?.id ?? null,
              source: producto ? "PRODUCT" : "ENROLLMENT",
              status: "ACTIVE",
              ...(producto && producto.grants.length > 0
                ? {
                    scopes: {
                      create: producto.grants.map((grant) => ({
                        nodeId: grant.nodeId,
                        capability: grant.capability,
                      })),
                    },
                  }
                : {}),
            },
          });
        }
      }

      if (esActualizacion) actualizados += 1;
      else creados += 1;

      await db.importRow.updateMany({
        where: { jobId, rowNumber: row.rowNumber },
        data: {
          status: esActualizacion ? "UPDATED" : "CREATED",
          parsedData: row.parsed,
          messages: row.messages,
          entityType: "Membership",
          entityId: membership.id,
          wasCreated: !esActualizacion,
          previousData: anterior ? JSON.parse(JSON.stringify(anterior)) : undefined,
        },
      });
    } catch (error) {
      errores += 1;
      await db.importRow.updateMany({
        where: { jobId, rowNumber: row.rowNumber },
        data: {
          status: "ERROR",
          messages: [
            ...row.messages,
            {
              level: "error",
              text: error instanceof Error ? error.message : "Error desconocido.",
            },
          ],
        },
      });
    }
  }

  return { creados, actualizados, saltados, errores };
}

/**
 * Deshace una importación.
 *
 * Lo que se creó se borra; lo que se actualizó se devuelve a como estaba. Es la
 * red de seguridad que hace que una academia se atreva a migrar: si el archivo
 * venía mal, no se queda con 800 fichas medio importadas.
 */
export async function rollbackImport(db: TenantClient, jobId: string) {
  const filas = await db.importRow.findMany({
    where: { jobId, status: { in: ["CREATED", "UPDATED"] } },
    select: {
      id: true,
      entityId: true,
      wasCreated: true,
      previousData: true,
    },
  });

  let borrados = 0;
  let restaurados = 0;

  for (const fila of filas) {
    if (!fila.entityId) continue;

    if (fila.wasCreated) {
      // Borrar la membresía arrastra en cascada perfil, matrículas y derechos.
      // El usuario global se conserva si pertenece a otra academia.
      const membership = await db.membership.findUnique({
        where: { id: fila.entityId },
        select: { id: true, userId: true },
      });

      if (membership) {
        await db.membership.delete({ where: { id: membership.id } });

        // tenant-ok · la pregunta es justo si esta persona pertenece a ALGUNA
        // otra academia. Acotar por la nuestra daría siempre cero y borraría
        // usuarios que son alumnos en otro sitio.
        const otras = await prismaBase.membership.count({
          where: { userId: membership.userId },
        });
        if (otras === 0) {
          await prismaBase.user.delete({ where: { id: membership.userId } });
        }
        borrados += 1;
      }
    } else if (fila.previousData) {
      const anterior = fila.previousData as Record<string, unknown>;
      await prismaBase.studentProfile.updateMany({
        where: { membershipId: fila.entityId },
        data: {
          code: (anterior.code as string) ?? null,
          status: (anterior.status as "ACTIVE") ?? "ACTIVE",
          source: (anterior.source as string) ?? null,
          notes: (anterior.notes as string) ?? null,
        },
      });
      restaurados += 1;
    }

    await db.importRow.updateMany({
      where: { id: fila.id },
      data: { status: "ROLLED_BACK" },
    });
  }

  return { borrados, restaurados };
}
