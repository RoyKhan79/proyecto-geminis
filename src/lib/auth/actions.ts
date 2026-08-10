"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { prismaBase } from "@/lib/db/client";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getAuthContext } from "./context";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import {
  clearSessionCookie,
  createSession,
  readSessionCookie,
  revokeSession,
  setActiveAcademy,
  setSessionCookie,
  validateSessionToken,
} from "./session";

export type ActionState = { error?: string } | undefined;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

async function requestInfo() {
  const headerList = await headers();
  return {
    ip:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      "desconocida",
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}

/**
 * Inicio de sesión.
 *
 * El mensaje de error es siempre el mismo tanto si el correo no existe como si
 * la contraseña es incorrecta: decir cuál de las dos falla permitiría averiguar
 * qué correos están dados de alta.
 */
export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const { email, password } = parsed.data;
  const { ip, userAgent } = await requestInfo();

  const byIp = rateLimit(`login:ip:${ip}`, { limit: 20, windowSeconds: 600 });
  const byAccount = rateLimit(`login:acct:${email}`, {
    limit: 8,
    windowSeconds: 600,
  });

  if (!byIp.allowed || !byAccount.allowed) {
    const wait = Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds);
    return {
      error: `Demasiados intentos. Vuelve a probar en ${Math.ceil(wait / 60)} minutos.`,
    };
  }

  const user = await prismaBase.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      deletedAt: true,
      isPlatformAdmin: true,
    },
  });

  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid || user.deletedAt || user.status === "DISABLED") {
    await recordAudit({
      action: "auth.login.failed",
      entityType: "User",
      entityId: user?.id,
      context: { email, ip },
    });
    return { error: "Correo o contraseña incorrectos." };
  }

  // Si la contraseña se guardó con parámetros más débiles, la reforzamos ahora
  // que la tenemos en claro. El usuario no se entera de nada.
  if (needsRehash(user.passwordHash)) {
    await prismaBase.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }

  const memberships = await prismaBase.membership.findMany({
    where: { userId: user.id, status: "ACTIVE", deletedAt: null },
    select: { academyId: true },
  });

  const { token } = await createSession({
    userId: user.id,
    activeAcademyId: memberships.length === 1 ? memberships[0].academyId : null,
    ipAddress: ip,
    userAgent,
  });

  await setSessionCookie(token);
  await prismaBase.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  resetRateLimit(`login:acct:${email}`);

  await recordAudit({
    academyId: memberships.length === 1 ? memberships[0].academyId : null,
    actorId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    context: { ip },
  });

  redirect(destinationFor(memberships.length, user.isPlatformAdmin));
}

function destinationFor(membershipCount: number, isPlatformAdmin: boolean) {
  if (membershipCount === 1) return "/inicio";
  if (membershipCount === 0 && isPlatformAdmin) return "/plataforma";
  return "/elegir-academia";
}

export async function signOutAction() {
  const ctx = await getAuthContext();
  const token = await readSessionCookie();

  if (token) {
    const session = await validateSessionToken(token);
    if (session) await revokeSession(session.id);
  }

  await clearSessionCookie();

  if (ctx) {
    await recordAudit({
      academyId: ctx.academy?.id ?? null,
      actorId: ctx.user.id,
      action: "auth.logout",
      entityType: "User",
      entityId: ctx.user.id,
    });
  }

  redirect("/entrar");
}

/**
 * Cambia la academia activa de la sesión.
 * La academia se valida contra las pertenencias reales del usuario: no basta
 * con que llegue en el formulario.
 */
export async function switchAcademyAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/entrar");

  const academyId = String(formData.get("academyId") ?? "");
  const allowed = ctx.memberships.some((m) => m.academyId === academyId);
  if (!allowed) throw new Error("No perteneces a esa academia.");

  await setActiveAcademy(ctx.sessionId, academyId);
  await recordAudit({
    academyId,
    actorId: ctx.user.id,
    action: "auth.switch_academy",
    context: { desde: ctx.academy?.id ?? null },
  });

  redirect("/inicio");
}
