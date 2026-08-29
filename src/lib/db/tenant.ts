import { AsyncLocalStorage } from "node:async_hooks";
import { prismaBase } from "./client";
import { env } from "@/lib/env";
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
 * ── LA SEGUNDA BARRERA ──────────────────────────────────────────────────────
 * Todo lo anterior vive en la aplicación, y una sola barrera es una sola
 * barrera. Debajo hay otra: cada operación de academia se ejecuta dentro de una
 * transacción que fija `geminis.academy_id`, y PostgreSQL aplica sus políticas
 * de Row Level Security sobre las 50 tablas con datos de academia.
 *
 * Sirve exactamente para lo que la de arriba no puede cubrir: una consulta con
 * `$queryRaw`, un fallo futuro al fusionar el `where`, o una operación de Prisma
 * que esta extensión no contemple. Si la aplicación se equivoca, la base de
 * datos no devuelve la fila.
 *
 * Se puede apagar con `DB_RLS=off` para medir el coste; en producción va
 * encendida. Ver docs/SECURITY_MODEL.md.
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

const RLS_ACTIVO = env.DB_RLS === "on";

/**
 * Marca de «ya estamos dentro de una transacción de esta academia».
 *
 * Hace falta por un fallo real que apareció al probar la facturación: dentro de
 * una transacción interactiva, cada operación volvía a envolverse en SU PROPIA
 * transacción, en otra conexión. Con un `SELECT … FOR UPDATE` de por medio, la
 * de dentro esperaba un bloqueo que solo soltaría la de fuera, y la de fuera
 * esperaba a la de dentro. Bloqueo mutuo, y a los cinco segundos, timeout.
 *
 * No es un caso raro: reservar el número de una factura y borrar una oposición
 * en cascada lo hacen. Con esta marca, dentro de `transaccionDeAcademia` las
 * operaciones se ejecutan tal cual, porque la variable ya está fijada para toda
 * la transacción y la guardia de aplicación sigue filtrando igual.
 */
const enTransaccion = new AsyncLocalStorage<{ academyId: string }>();

/** Misma comprobación que en `tenantDb`, disponible antes de su definición. */
const UUID_TX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Una transacción con la academia fijada.
 *
 * Se usa cuando varias operaciones tienen que ir juntas o fallar juntas: media
 * oposición borrada es peor que no haberla borrado, y dos facturas con el mismo
 * número son un problema con Hacienda.
 *
 * Dentro se recibe el cliente de la transacción SIN la guardia. Es deliberado:
 * la guardia no puede envolver operaciones que ya están dentro de una
 * transacción. A cambio, **hay que acotar por `academyId` a mano**, y RLS sigue
 * puesta debajo comprobándolo.
 */
export async function transaccionDeAcademia<T>(
  academyId: string,
  fn: (tx: Parameters<Parameters<typeof prismaBase.$transaction>[0]>[0]) => Promise<T>,
  opciones?: { timeout?: number },
): Promise<T> {
  if (!UUID_TX.test(academyId)) {
    throw new TenantViolationError(
      `El academyId «${academyId}» no tiene forma de identificador. No se sigue.`,
    );
  }

  return prismaBase.$transaction(
    async (tx) => {
      if (RLS_ACTIVO) {
        await tx.$executeRawUnsafe(
          `SELECT set_config('geminis.academy_id', '${academyId}', true)`,
        );
      }
      return enTransaccion.run({ academyId }, () => fn(tx));
    },
    { timeout: opciones?.timeout ?? 15_000 },
  );
}

/**
 * Ejecuta una operación con `geminis.academy_id` fijado.
 *
 * El tercer argumento de `set_config` es `true`: la variable es local a la
 * transacción. Es imprescindible. Si fuera de sesión se quedaría pegada a una
 * conexión del pool y la petición siguiente heredaría la academia de la
 * anterior, que es un fallo mucho peor que el que estamos evitando.
 *
 * La operación se relanza sobre el cliente base en lugar de llamar a `query()`,
 * porque `query()` va por su cuenta y quedaría fuera de la transacción. El
 * cliente base no está extendido, así que no hay recursión con la guardia.
 *
 * Coste medido en local (`npm run rls:medir`): unos 3 ms por consulta, del
 * orden de 20 ms en una pantalla con seis. Es lo que cuesta tener una segunda
 * barrera, y está anotado en el ADR-0040 para que la cifra no se olvide.
 */
async function conRls<T>(
  academyId: string,
  model: string,
  operation: string,
  args: unknown,
): Promise<T> {
  // Forma interactiva, que es la más barata de las tres que se midieron
  // (`npm run rls:medir`): 2,96 ms frente a 3,86 ms del lote con parámetro.
  // La transacción en sí no cuesta casi nada; lo que cuesta es el ida y vuelta
  // de fijar la variable, y eso no se puede evitar sin perder la barrera.
  //
  // El academyId va dentro del texto de la sentencia y no como parámetro
  // porque así ahorra una preparación; es seguro porque `tenantDb()` ya ha
  // comprobado que es un UUID y no deja pasar otra cosa.
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('geminis.academy_id', '${academyId}', true)`,
    );

    const enTx = (tx as unknown as Record<string, Record<string, unknown>>)[
      model.charAt(0).toLowerCase() + model.slice(1)
    ];
    const correrEnTx = enTx?.[operation] as ((a: unknown) => Promise<T>) | undefined;

    if (typeof correrEnTx !== "function") {
      throw new TenantViolationError(
        `No se puede ejecutar ${model}.${operation} bajo RLS.`,
      );
    }

    return correrEnTx.call(enTx, args);
  });
}

/**
 * Un identificador de academia tiene que ser un UUID y nada más.
 *
 * Se comprueba aquí, en la puerta, por dos motivos. El primero es que un
 * academyId que no lo sea significa que algo ha ido mal antes y es mejor
 * enterarse ya. El segundo es que ese valor acaba dentro de la sentencia que
 * fija la variable de RLS, y una comprobación estricta en el origen vale más
 * que confiar en que nadie lo cambie nunca.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tenantDb(academyId: string) {
  if (!academyId) {
    throw new TenantViolationError(
      "tenantDb() requiere un academyId. Nunca lo derives de datos enviados por el cliente sin validarlo.",
    );
  }
  if (!UUID.test(academyId)) {
    throw new TenantViolationError(
      `El academyId «${academyId}» no tiene forma de identificador. No se sigue.`,
    );
  }

  /** Ejecuta la operación ya saneada, con o sin la segunda barrera. */
  const correr = <T>(
    model: string,
    operation: string,
    args: unknown,
    query: (a: unknown) => Promise<T>,
  ): Promise<T> => {
    // Si ya estamos dentro de una transacción de esta academia, la variable ya
    // está fijada: envolver otra vez sería abrir una transacción anidada en
    // otra conexión y bloquearse contra la de fuera.
    if (!RLS_ACTIVO || enTransaccion.getStore()?.academyId === academyId) {
      return query(args);
    }
    return conRls<T>(academyId, model, operation, args);
  };

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
            return correr(
              model,
              operation,
              { ...a, where: mergeWhere(a.where, academyId) },
              query,
            );
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
              return correr(model, operation, a, query);
            }

            case "create":
              return correr(
                model,
                operation,
                {
                  ...a,
                  data: withAcademyId(
                    (a.data as Record<string, unknown>) ?? {},
                    academyId,
                    model,
                  ),
                },
                query,
              );

            case "createMany":
            case "createManyAndReturn": {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              return correr(
                model,
                operation,
                {
                  ...a,
                  data: rows.map((row) =>
                    withAcademyId(row as Record<string, unknown>, academyId, model),
                  ),
                },
                query,
              );
            }

            case "update":
            case "delete": {
              if (!(await ownsByUnique(model, a.where, academyId))) {
                throw new NotFoundInTenantError(model);
              }
              return correr(model, operation, a, query);
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
              return correr(
                model,
                operation,
                payload,
                query as (x: unknown) => Promise<unknown>,
              );
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
