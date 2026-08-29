import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prismaBase } from "@/lib/db/client";
import { env, isProduction } from "@/lib/env";

/**
 * Sesiones en base de datos.
 *
 * Decisión ADR-0015: sesiones opacas persistidas, no JWT. Una academia necesita
 * poder cerrar la sesión de un alumno al instante (impago, cuenta compartida,
 * baja) y ver desde qué dispositivos entra (§116). Con un JWT eso no se puede
 * hacer sin montar igualmente una lista de revocación, es decir, sin volver a
 * la base de datos. Coste: una consulta indexada por petición autenticada.
 *
 * En la base de datos solo se guarda el SHA-256 del token. Si alguien leyera la
 * tabla `sessions` no podría suplantar a nadie.
 */

export const SESSION_COOKIE = "geminis_session";

const SESSION_MS = env.SESSION_DAYS * 24 * 60 * 60 * 1000;
/// A partir de la mitad de vida, la sesión se renueva sola al usarla.
const RENEW_THRESHOLD_MS = SESSION_MS / 2;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Nombre legible del dispositivo, deducido del `User-Agent`.
 *
 * No es identificación ni seguimiento: es lo justo para que en «mis sesiones»
 * la persona reconozca cuál es la suya y para poder contar dispositivos
 * distintos. No se guarda nada que no estuviera ya guardado.
 */
export function etiquetaDeDispositivo(userAgent: string | null | undefined): string {
  if (!userAgent) return "Dispositivo desconocido";

  const navegador = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navegador";

  const sistema = /iPhone|iPad/.test(userAgent)
    ? "iPhone o iPad"
    : /Android/.test(userAgent)
      ? "Android"
      : /Macintosh|Mac OS/.test(userAgent)
        ? "Mac"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return sistema ? `${navegador} en ${sistema}` : navegador;
}

/**
 * Cierra las sesiones más antiguas si se supera el límite de la academia.
 *
 * Compartir la cuenta es la primera fuga de ingresos de una academia: uno paga
 * y estudian cuatro. El límite lo pone cada academia; cero significa sin
 * límite.
 *
 * Se echa a la MÁS ANTIGUA y no se rechaza la nueva a propósito: quien acaba de
 * poner su contraseña entra, y quien tenía la sesión prestada se queda fuera y
 * tiene que volver a pedírsela. Rechazar la nueva castigaría al titular.
 *
 * Solo se aplica al alumnado: al profesorado y al personal no se les limita,
 * porque tienen motivos legítimos para estar en el ordenador de la academia, en
 * el de casa y en el móvil a la vez.
 */
async function aplicarLimiteDeDispositivos(
  userId: string,
  sesionRecienCreada: string,
): Promise<number> {
  const membresias = await prismaBase.membership.findMany({
    where: { userId, deletedAt: null },
    select: {
      academy: { select: { maxSessionsPerStudent: true } },
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  if (membresias.length === 0) return 0;

  // Si en alguna academia esta persona NO es solo alumno, no se le limita.
  const soloAlumno = membresias.every((m) =>
    m.roles.every((r) => r.role.key === "STUDENT"),
  );
  if (!soloAlumno) return 0;

  // Con varias academias manda la más restrictiva que tenga límite.
  const limites = membresias
    .map((m) => m.academy.maxSessionsPerStudent)
    .filter((n) => n > 0);
  if (limites.length === 0) return 0;
  const limite = Math.min(...limites);

  const activas = await prismaBase.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      // Las sesiones de soporte no cuentan: no son del alumno.
      impersonatedById: null,
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });

  if (activas.length <= limite) return 0;

  const sobran = activas
    .slice(limite)
    .map((s) => s.id)
    .filter((id) => id !== sesionRecienCreada);

  if (sobran.length === 0) return 0;

  await prismaBase.session.updateMany({
    where: { id: { in: sobran } },
    data: { revokedAt: new Date() },
  });

  return sobran.length;
}

export async function createSession(params: {
  userId: string;
  activeAcademyId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedById?: string | null;
}) {
  const token = generateSessionToken();
  const session = await prismaBase.session.create({
    data: {
      userId: params.userId,
      tokenHash: hashSessionToken(token),
      activeAcademyId: params.activeAcademyId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      deviceLabel: etiquetaDeDispositivo(params.userAgent),
      impersonatedById: params.impersonatedById ?? null,
      expiresAt: new Date(Date.now() + SESSION_MS),
    },
  });

  // Una sesión de soporte no debe echar al alumno de su propia cuenta.
  const cerradas = params.impersonatedById
    ? 0
    : await aplicarLimiteDeDispositivos(params.userId, session.id);

  return { token, session, sesionesCerradas: cerradas };
}

/** Las sesiones abiertas de una persona, para que las vea en su perfil. */
export async function sesionesActivas(userId: string) {
  return prismaBase.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      impersonatedById: true,
    },
  });
}

export type ValidatedSession = NonNullable<
  Awaited<ReturnType<typeof validateSessionToken>>
>;

export async function validateSessionToken(token: string) {
  const tokenHash = hashSessionToken(token);
  const session = await prismaBase.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          locale: true,
          emailVerifiedAt: true,
          status: true,
          isPlatformAdmin: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prismaBase.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.deletedAt || session.user.status === "DISABLED") return null;

  // Renovación deslizante: evita que a un alumno que estudia a diario se le
  // caduque la sesión, sin alargar indefinidamente las sesiones abandonadas.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < RENEW_THRESHOLD_MS) {
    await prismaBase.session.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(Date.now() + SESSION_MS),
        lastSeenAt: new Date(),
      },
    });
  }

  return session;
}

export async function revokeSession(sessionId: string) {
  await prismaBase.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cierra todas las sesiones de un usuario (cambio de contraseña, baja, soporte). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prismaBase.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function setActiveAcademy(sessionId: string, academyId: string | null) {
  await prismaBase.session.update({
    where: { id: sessionId },
    data: { activeAcademyId: academyId },
  });
}

// ── Cookie ───────────────────────────────────────────────────────────────────

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
