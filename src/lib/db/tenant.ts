import { prismaBase } from "./client";
import { DERIVED_MODELS, GLOBAL_MODELS, TENANT_MODELS } from "./tenant-models";

/**
 * GUARDIA MULTI-TENANT
 * ────────────────────
 * `tenantDb(academyId)` devuelve un cliente Prisma que NO PUEDE tocar datos de
 * otra academia. No es una convención ni una recomendación: es una barrera que
 * intercepta todas las operaciones antes de llegar a la base de datos.
 *
 * Qué hace, por tipo de operación:
 *
 *   lecturas (findMany, findFirst, count, aggregate, groupBy)
 *       → añade `academyId` al `where`.
 *
 *   findUnique / findUniqueOrThrow
 *       → se reescriben como `findFirst` con `academyId`, porque un `where`
 *         único no admite filtros extra. Buscar por id el registro de otra
 *         academia devuelve "no encontrado", nunca el registro.
 *
 *   create / createMany
 *       → fija `academyId`. Si el código intentaba escribir otro, lanza error:
 *         una escritura cruzada es un fallo grave, no algo que se corrija en
 *         silencio.
 *
 *   update / delete / upsert
 *       → comprueba primero la propiedad del registro. Si no es de esta
 *         academia, lanza `TenantViolationError` y no ejecuta nada.
 *
 *   updateMany / deleteMany
 *       → añade `academyId` al `where`.
 *
 * Los modelos globales (User, Academy, Plan…) pasan sin tocar.
 * Los modelos derivados (StudentProfile, ContentResource…) NO se pueden usar
 * directamente desde un cliente de tenant: se accede a ellos a través de su
 * padre, que sí está protegido. Intentarlo lanza error.
 *
 * Ver docs/SECURITY_MODEL.md.
 */

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}

export class NotFoundInTenantError extends Error {
  constructor(model: string) {
    super(`No se ha encontrado el registro solicitado (${model}).`);
    this.name = "NotFoundInTenantError";
  }
}

const READ_MANY_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

function delegateKey(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function mergeWhere(where: unknown, academyId: string) {
  return { ...((where as Record<string, unknown>) ?? {}), academyId };
}

function withAcademyId(
  data: Record<string, unknown>,
  academyId: string,
  model: string,
) {
  if (data.academyId !== undefined && data.academyId !== academyId) {
    throw new TenantViolationError(
      `Intento de escribir en ${model} con academyId ajeno al contexto activo.`,
    );
  }
  // Si el llamante usa la forma relacional `academy: { connect: … }`, no la
  // tocamos: Prisma ya exige que sea coherente y la comprobación se haría a
  // ciegas. Ese estilo está desaconsejado en el proyecto justo por esto.
  if (data.academy !== undefined) return data;
  return { ...data, academyId };
}

export function tenantDb(academyId: string) {
  if (!academyId) {
    throw new TenantViolationError(
      "tenantDb() requiere un academyId. Nunca lo derives de datos enviados por el cliente sin validarlo.",
    );
  }

  return prismaBase.$extends({
    name: "geminis-tenant-guard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (GLOBAL_MODELS.has(model) && !DERIVED_MODELS.has(model)) {
            return query(args);
          }

          if (DERIVED_MODELS.has(model)) {
            throw new TenantViolationError(
              `${model} no se consulta directamente desde un cliente de academia. ` +
                `Accede a través de su entidad padre (ver src/lib/db/tenant-models.ts).`,
            );
          }

          if (!TENANT_MODELS.has(model)) {
            throw new TenantViolationError(
              `El modelo ${model} no está clasificado como global ni de tenant. ` +
                `Añádelo a src/lib/db/tenant-models.ts antes de usarlo.`,
            );
          }

          const a = args as Record<string, unknown>;

          if (READ_MANY_OPS.has(operation)) {
            return query({ ...a, where: mergeWhere(a.where, academyId) });
          }

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow": {
              // Se comprueba la propiedad con el propio `where` único y después
              // se ejecuta la consulta original. Antes se reescribía como
              // findFirst añadiendo academyId, pero eso rompía con las claves
              // únicas compuestas (p. ej. studentId_questionId), que findFirst
              // no admite. Cuesta una consulta más y funciona siempre.
              if (!(await ownsByUnique(model, a.where, academyId))) {
                if (operation === "findUniqueOrThrow") {
                  throw new NotFoundInTenantError(model);
                }
                return null;
              }
              return query(a);
            }

            case "create":
              return query({
                ...a,
                data: withAcademyId(
                  (a.data as Record<string, unknown>) ?? {},
                  academyId,
                  model,
                ),
              });

            case "createMany":
            case "createManyAndReturn": {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              return query({
                ...a,
                data: rows.map((row) =>
                  withAcademyId(row as Record<string, unknown>, academyId, model),
                ),
              });
            }

            case "update":
            case "delete": {
              if (!(await ownsByUnique(model, a.where, academyId))) {
                throw new NotFoundInTenantError(model);
              }
              return query(a);
            }

            case "upsert": {
              // Si ya existe y es de otra academia, no se toca ni se duplica.
              const propiedad = await ownershipOfUnique(model, a.where, academyId);
              if (propiedad === "ajeno") {
                throw new TenantViolationError(
                  `El registro de ${model} pertenece a otra academia.`,
                );
              }
              const payload = {
                ...a,
                create: withAcademyId(
                  (a.create as Record<string, unknown>) ?? {},
                  academyId,
                  model,
                ),
              };
              return query(payload as Parameters<typeof query>[0]);
            }

            default:
              // Operaciones no contempladas (p. ej. futuras de Prisma): las
              // bloqueamos en lugar de dejarlas pasar sin filtrar.
              throw new TenantViolationError(
                `Operación '${operation}' no soportada por la guardia multi-tenant en ${model}.`,
              );
          }
        },
      },
    },
  });
}

/**
 * ¿De quién es el registro que señala este `where` único?
 *
 *   "propio"      → es de esta academia
 *   "ajeno"       → existe pero es de otra
 *   "inexistente" → no hay tal registro
 *
 * Se consulta con `findUnique`, que es el único que entiende las claves únicas
 * compuestas, y se pide solo `academyId`.
 */
async function ownershipOfUnique(
  model: string,
  where: unknown,
  academyId: string,
): Promise<"propio" | "ajeno" | "inexistente"> {
  const delegate = (
    prismaBase as unknown as Record<
      string,
      { findUnique: (arg: unknown) => Promise<{ academyId: string } | null> }
    >
  )[delegateKey(model)];

  const encontrado = await delegate.findUnique({
    where: where as Record<string, unknown>,
    select: { academyId: true },
  });

  if (!encontrado) return "inexistente";
  return encontrado.academyId === academyId ? "propio" : "ajeno";
}

async function ownsByUnique(model: string, where: unknown, academyId: string) {
  return (await ownershipOfUnique(model, where, academyId)) === "propio";
}

export type TenantClient = ReturnType<typeof tenantDb>;
