import type { StudentStatus } from "@/generated/prisma/enums";
import type { TenantClient } from "@/lib/db/tenant";
import { descifrar } from "@/lib/crypto/field";

/**
 * Consultas de alumnos.
 *
 * Toda la lógica de datos vive aquí, no en los componentes (§65). Las páginas
 * solo deciden qué pintar con lo que reciben.
 */

export const PAGE_SIZE = 25;

/** Los filtros del listado de alumnado, tal como llegan de la barra de búsqueda. */
export type StudentFilters = {
  search?: string;
  status?: StudentStatus | "ALL";
  courseId?: string;
  groupId?: string;
  page?: number;
};

/**
 * Una fila del listado.
 *
 * Se deriva del tipo de retorno en lugar de escribirse a mano: así el `select`
 * de la consulta y lo que la pantalla espera no pueden desincronizarse.
 */
export type StudentListItem = Awaited<
  ReturnType<typeof listStudents>
>["items"][number];

/**
 * El listado de alumnado, filtrado y paginado.
 *
 * @param db Cliente ya acotado a la academia. Al pedirlo como `TenantClient`
 *   queda escrito en la firma que esta consulta no puede salirse de ella.
 * @param filters Búsqueda, estado, curso y página.
 * @returns Las filas y el total, para poder pintar el paginador.
 */
export async function listStudents(db: TenantClient, filters: StudentFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const search = filters.search?.trim();

  const where = {
    deletedAt: null,
    studentProfile: {
      isNot: null,
      ...(filters.status && filters.status !== "ALL"
        ? { is: { status: filters.status } }
        : {}),
    },
    ...(search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { studentProfile: { is: { code: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
    ...(filters.courseId || filters.groupId
      ? {
          enrollments: {
            some: {
              deletedAt: null,
              ...(filters.courseId ? { courseId: filters.courseId } : {}),
              ...(filters.groupId ? { groupId: filters.groupId } : {}),
            },
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.membership.findMany({
      where,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        studentProfile: {
          select: { code: true, status: true, lastActivityAt: true },
        },
        enrollments: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            course: { select: { id: true, name: true } },
            group: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.membership.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * La ficha completa de un alumno: matrículas, derechos, pagos y rendimiento.
 *
 * @param db Cliente acotado a la academia.
 * @param membershipId Qué alumno.
 * @returns La ficha, o `null` si ese identificador no es de esta academia. Las
 *   dos cosas se responden igual a propósito: quien prueba identificadores no
 *   debe poder averiguar quién estudia en la academia de al lado.
 */
export async function getStudent(db: TenantClient, membershipId: string) {
  const alumno = await db.membership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
      studentProfile: true,
      // Cómo paga y su cuota mensual, si la tiene.
      billingProfile: {
        select: {
          method: true,
          iban: true,
          holderName: true,
          mandateRef: true,
          mandateSignedAt: true,
          mandateUsed: true,
          chargeDay: true,
          notes: true,
        },
      },
      recurringCharge: {
        select: {
          concept: true,
          amountCents: true,
          startsOn: true,
          endsOn: true,
          status: true,
        },
      },
      enrollments: {
        where: { deletedAt: null },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          priceCents: true,
          discountCents: true,
          notes: true,
          course: {
            select: {
              id: true,
              name: true,
              oppositionEdition: {
                select: {
                  id: true,
                  name: true,
                  opposition: { select: { id: true, name: true } },
                },
              },
            },
          },
          group: { select: { id: true, name: true } },
        },
      },
      entitlements: {
        where: { status: { in: ["ACTIVE", "PENDING", "PAST_DUE", "SUSPENDED"] } },
        select: {
          id: true,
          source: true,
          status: true,
          startsAt: true,
          endsAt: true,
          note: true,
          product: { select: { id: true, name: true } },
          scopes: {
            select: {
              capability: true,
              editionId: true,
              node: { select: { id: true, label: true } },
              edition: {
                select: {
                  name: true,
                  opposition: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { dueDate: "desc" },
        take: 12,
        select: {
          id: true,
          concept: true,
          amountCents: true,
          status: true,
          method: true,
          dueDate: true,
          paidAt: true,
        },
      },
    },
  });

  if (!alumno) return null;

  // El IBAN se guarda cifrado. Se devuelve descifrado porque esta consulta
  // alimenta el formulario donde se edita, y ahí hace falta el número completo.
  return {
    ...alumno,
    billingProfile: alumno.billingProfile
      ? { ...alumno.billingProfile, iban: descifrar(alumno.billingProfile.iban) }
      : null,
  };
}

/** Cursos y grupos disponibles, para los desplegables de filtros y matrícula. */
/**
 * Las convocatorias entre las que reparte acceso la ficha del alumno.
 *
 * Se ofrecen las abiertas y las de la academia entera, no solo aquellas en las
 * que el alumno está matriculado: el sentido de conceder acceso a mano es
 * precisamente poder abrirle algo en lo que no lo está.
 */
export async function loadEditionOptions(db: TenantClient) {
  const ediciones = await db.oppositionEdition.findMany({
    where: { deletedAt: null },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      opposition: { select: { name: true } },
    },
  });

  return ediciones.map((edicion) => ({
    id: edicion.id,
    nombre: `${edicion.opposition.name} · ${edicion.name}`,
  }));
}

export async function loadCourseOptions(db: TenantClient) {
  return db.course.findMany({
    where: { deletedAt: null, status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      oppositionEdition: {
        select: {
          name: true,
          opposition: { select: { name: true } },
        },
      },
      groups: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}


