import { cache } from "react";
import { redirect } from "next/navigation";
import { prismaBase } from "@/lib/db/client";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import { readSessionCookie, validateSessionToken } from "./session";
import type { Permission } from "./permissions";
import {
  MODULOS,
  MODULOS_NUCLEO,
  moduloDelPermiso,
  type CodigoModulo,
} from "@/lib/modules/catalogo";

/**
 * Contexto de autenticación de la petición.
 *
 * Se resuelve una sola vez por petición (React `cache`) y es la ÚNICA vía por
 * la que el resto de la aplicación sabe quién está conectado, en qué academia y
 * qué puede hacer. Ningún componente lee cookies ni consulta sesiones por su
 * cuenta.
 */

/** La academia con la que se está trabajando ahora mismo. */
export type ActiveAcademy = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  status: string;
};

/**
 * Todo lo que hace falta saber de quien está haciendo la petición.
 *
 * Se resuelve una vez por petición y se reutiliza: `getAuthContext` va
 * envuelto en la caché de React, así que llamarlo diez veces en una página no
 * son diez consultas.
 */
export type AuthContext = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
    emailVerifiedAt: Date | null;
    isPlatformAdmin: boolean;
  };
  sessionId: string;
  /// Superadmin que está suplantando a este usuario, si procede.
  impersonatedById: string | null;
  academy: ActiveAcademy | null;
  membershipId: string | null;
  roleKeys: string[];
  permissions: Set<Permission>;
  /// Academias a las que pertenece el usuario (para el selector de academia).
  memberships: { academyId: string; academyName: string; academySlug: string }[];
  /**
   * Módulos que esta academia tiene contratados.
   *
   * Va en el contexto y no se consulta en cada pantalla para que la
   * comprobación sea igual de barata que la de un permiso: si costara una
   * consulta, alguien acabaría saltándosela «solo en esta pantalla».
   */
  modulos: Set<CodigoModulo>;
};

/**
 * Resuelve la sesión de la petición en curso.
 *
 * @returns El contexto, o `null` si no hay sesión válida. No redirige ni lanza:
 *   es la pieza que usan las guardas, y también las pantallas públicas que
 *   quieren saber si hay alguien dentro sin obligar a entrar.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const token = await readSessionCookie();
  if (!token) return null;

  const session = await validateSessionToken(token);
  if (!session) return null;

  const memberships = await prismaBase.membership.findMany({
    where: { userId: session.userId, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      academyId: true,
      academy: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          status: true,
          deletedAt: true,
        },
      },
      roles: {
        select: {
          role: {
            select: { key: true, permissions: { select: { permission: true } } },
          },
        },
      },
    },
  });

  const usable = memberships.filter(
    (m) => !m.academy.deletedAt && m.academy.status !== "CANCELLED",
  );

  // Academia activa: la de la sesión si sigue siendo válida; si no, la única
  // que tenga el usuario. Nunca se toma de un parámetro enviado por el cliente.
  const active =
    usable.find((m) => m.academyId === session.activeAcademyId) ??
    (usable.length === 1 ? usable[0] : undefined);

  // Los módulos contratados. Se leen con el cliente sin guardia porque esta
  // consulta ES la que decide el contexto: todavía no hay academia activa con
  // la que acotar, y el filtro por `academyId` va explícito.
  const modulos = new Set<CodigoModulo>(MODULOS_NUCLEO);
  if (active) {
    const contratados = await prismaBase.academyModule.findMany({
      where: { academyId: active.academy.id, active: true },
      select: { module: true },
    });
    for (const { module } of contratados) modulos.add(module as CodigoModulo);
  }

  const permissions = new Set<Permission>();
  const roleKeys: string[] = [];
  if (active) {
    for (const membershipRole of active.roles) {
      roleKeys.push(membershipRole.role.key);
      for (const { permission } of membershipRole.role.permissions) {
        permissions.add(permission as Permission);
      }
    }
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      avatarUrl: session.user.avatarUrl,
      emailVerifiedAt: session.user.emailVerifiedAt,
      isPlatformAdmin: session.user.isPlatformAdmin,
    },
    sessionId: session.id,
    impersonatedById: session.impersonatedById,
    modulos,
    academy: active
      ? {
          id: active.academy.id,
          slug: active.academy.slug,
          name: active.academy.name,
          logoUrl: active.academy.logoUrl,
          primaryColor: active.academy.primaryColor,
          status: active.academy.status,
        }
      : null,
    membershipId: active?.id ?? null,
    roleKeys,
    permissions,
    memberships: usable.map((m) => ({
      academyId: m.academyId,
      academyName: m.academy.name,
      academySlug: m.academy.slug,
    })),
  };
});

// ── Errores ──────────────────────────────────────────────────────────────────

/**
 * La academia no tiene contratado el módulo que hace falta.
 *
 * Es distinto de que falte el permiso, y por eso es otro error: aquí no hay
 * nada que un administrador pueda arreglar dando permisos. Se dice qué módulo
 * es para que el mensaje sirva de algo.
 */
export class ModuloNoContratadoError extends Error {
  /** El módulo que faltaba. */
  readonly modulo: CodigoModulo;

  constructor(modulo: CodigoModulo) {
    super(
      `Tu academia no tiene contratado el módulo «${MODULOS[modulo]?.nombre ?? modulo}».`,
    );
    this.name = "ModuloNoContratadoError";
    this.modulo = modulo;
  }
}

/**
 * ¿Tiene la academia este módulo?
 *
 * @param ctx Contexto de la sesión.
 * @param modulo El módulo.
 * @returns `true` si está contratado y activo.
 */
export function tieneModulo(ctx: AuthContext, modulo: CodigoModulo): boolean {
  return ctx.modulos.has(modulo);
}

/**
 * Falta el permiso para hacer algo.
 *
 * Lo lanzan las acciones, no las páginas: una acción que no se puede ejecutar
 * es un error del programa —la interfaz no debería haber ofrecido ese botón— y
 * las páginas prefieren llevar a una pantalla que lo explique.
 *
 * @param permission Cuál faltaba, para que el mensaje sirva de algo al
 *   depurar. No se le enseña al usuario tal cual.
 */
export class ForbiddenError extends Error {
  constructor(permission?: Permission) {
    super(
      permission
        ? `No tienes permiso para esta acción (${permission}).`
        : "No tienes permiso para esta acción.",
    );
    this.name = "ForbiddenError";
  }
}

// ── Guardas ──────────────────────────────────────────────────────────────────

/**
 * Exige sesión.
 *
 * @returns El contexto de quien ha entrado.
 * @remarks Si no hay sesión **no devuelve**: redirige a `/entrar`. Como
 *   `redirect()` lanza por dentro, el código que va después no se ejecuta.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/entrar");
  return ctx;
}

/**
 * Exige sesión + academia activa y devuelve además el cliente de base de datos
 * ya limitado a esa academia. Es el punto de partida de casi toda la aplicación.
 *
 * @returns El contexto con `academy`, `membershipId` y `db` garantizados, sin
 *   necesidad de comprobar que existen.
 * @remarks Redirige a `/entrar` sin sesión y a `/elegir-academia` si la persona
 *   pertenece a varias y no ha elegido ninguna.
 *
 * @example
 * ```ts
 * const ctx = await requireAcademy();
 * const alumnos = await ctx.db.membership.findMany(); // solo los de su academia
 * ```
 */
export async function requireAcademy(): Promise<
  AuthContext & { academy: ActiveAcademy; membershipId: string; db: TenantClient }
> {
  const ctx = await requireAuth();
  if (!ctx.academy || !ctx.membershipId) redirect("/elegir-academia");
  return {
    ...ctx,
    academy: ctx.academy,
    membershipId: ctx.membershipId,
    db: tenantDb(ctx.academy.id),
  };
}

/**
 * ¿Tiene este permiso?
 *
 * Para decidir qué se pinta. **No sustituye a la comprobación del servidor**:
 * ocultar un botón no es autorizar, y la acción vuelve a comprobarlo.
 *
 * @param ctx Contexto de la sesión.
 * @param permission El permiso.
 * @returns `true` si lo tiene.
 */
export function can(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

/**
 * ¿Tiene alguno de estos permisos?
 *
 * Para apartados del menú que valen para varios roles.
 *
 * @param ctx Contexto de la sesión.
 * @param permissions Los permisos que valdrían.
 * @returns `true` si tiene al menos uno.
 */
export function canAny(ctx: AuthContext, permissions: Permission[]): boolean {
  return permissions.some((permission) => ctx.permissions.has(permission));
}

/**
 * Guarda para Server Actions y rutas: lanza si falta el permiso.
 * En servidor SIEMPRE hay que llamar a esto aunque la interfaz ya oculte el
 * botón: ocultar no es autorizar (§51).
 *
 * @param permission El permiso exigido.
 * @returns El contexto con academia y cliente de base de datos.
 * @throws {ModuloNoContratadoError} Si la academia no tiene el módulo al que
 *   pertenece ese permiso. Se comprueba **antes** que el permiso: dar permisos
 *   no arregla un módulo sin contratar.
 * @throws {ForbiddenError} Si falta el permiso.
 */
export async function requirePermission(permission: Permission) {
  const ctx = await requireAcademy();

  // El módulo antes que el permiso. Si la academia no lo tiene contratado, dar
  // permisos no arregla nada, y decir «no tienes permiso» mandaría a su
  // administrador a buscar un ajuste que no existe.
  const modulo = moduloDelPermiso(permission);
  if (!ctx.modulos.has(modulo)) throw new ModuloNoContratadoError(modulo);

  if (!ctx.permissions.has(permission)) throw new ForbiddenError(permission);
  return ctx;
}

/**
 * Guarda para PÁGINAS: si falta el permiso, lleva a una pantalla explicativa.
 *
 * Se diferencia de `requirePermission` a propósito. Una acción que no se puede
 * ejecutar es un error y debe lanzarlo; una página a la que alguien llega sin
 * permiso —por un enlace antiguo o por curiosidad— merece una explicación, no
 * un error del servidor.
 *
 * @param permission El permiso exigido.
 * @returns El contexto con academia y cliente de base de datos.
 * @remarks Si falta el módulo lleva a `/sin-modulo`, que explica qué es y qué
 *   incluye; si falta el permiso, a `/sin-acceso`. Son pantallas distintas
 *   porque son problemas distintos: uno lo resuelve la academia contratando y
 *   el otro su administrador dando permisos.
 */
export async function requirePagePermission(permission: Permission) {
  const ctx = await requireAcademy();

  const modulo = moduloDelPermiso(permission);
  if (!ctx.modulos.has(modulo)) redirect(`/sin-modulo?m=${modulo}`);

  if (!ctx.permissions.has(permission)) redirect("/sin-acceso");
  return ctx;
}

/**
 * Guarda de página para la consola de plataforma.
 * Redirige en lugar de lanzar: una persona que llega a una URL que no le
 * corresponde merece una pantalla clara, no un error del servidor.
 *
 * @returns El contexto del superadministrador. **Sin academia**: ese nivel no
 *   pertenece a ninguna, y por eso no ve el contenido ni el alumnado de
 *   ninguna salvo que entre expresamente a dar soporte.
 * @remarks Redirige a `/sin-acceso` si no es administrador de plataforma.
 */
export async function requirePlatformAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.user.isPlatformAdmin) redirect("/sin-acceso");
  return ctx;
}
