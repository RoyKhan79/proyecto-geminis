import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, isDevelopment } from "@/lib/env";

/**
 * Cliente Prisma base.
 *
 * ATENCIÓN: este cliente NO está limitado a ninguna academia. Úsalo solo para:
 *   · autenticación (User, Session), que son entidades globales,
 *   · operaciones de plataforma del superadmin,
 *   · migraciones, semillas y scripts.
 *
 * Para cualquier dato de una academia usa `tenantDb(academyId)` (./tenant.ts),
 * que impide salirse del tenant.
 */
const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: isDevelopment ? ["warn", "error"] : ["error"],
  });
}

export const prismaBase = globalForPrisma.prismaBase ?? createClient();

// En desarrollo, Next.js recarga los módulos en caliente; sin esto se abrirían
// conexiones nuevas en cada recarga hasta agotar el pool de PostgreSQL.
if (isDevelopment) globalForPrisma.prismaBase = prismaBase;
