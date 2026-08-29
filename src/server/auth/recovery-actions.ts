"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { prismaBase } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import {
  comprobarToken,
  consumirToken,
  enviarVerificacionDeCorreo,
  solicitarRecuperacion,
} from "@/lib/auth/recovery";

export type RecoveryState = { error?: string; enviado?: boolean } | undefined;

const correoSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
});

async function ipDeLaPeticion() {
  const cabeceras = await headers();
  return (
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabeceras.get("x-real-ip") ??
    "desconocida"
  );
}

/**
 * «He olvidado mi contraseña».
 *
 * Responde siempre lo mismo, exista el correo o no. Si el mensaje cambiara,
 * este formulario sería una forma cómoda de averiguar qué correos están dados
 * de alta en la plataforma.
 */
export async function requestRecoveryAction(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = correoSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Correo no válido." };
  }

  const ip = await ipDeLaPeticion();

  // Dos límites, como en el inicio de sesión: por IP, contra quien recorre una
  // lista de correos; y por cuenta, para no convertir esto en una forma de
  // llenarle el buzón a alguien.
  const porIp = await rateLimit(`recovery:ip:${ip}`, { limit: 10, windowSeconds: 900 });
  const porCuenta = await rateLimit(`recovery:acct:${parsed.data.email}`, {
    limit: 3,
    windowSeconds: 900,
  });

  if (!porIp.allowed || !porCuenta.allowed) {
    // Ni siquiera aquí se dice si la cuenta existe: el mensaje es de ritmo, no
    // de existencia.
    return {
      error: "Has pedido el enlace varias veces. Espera unos minutos y prueba otra vez.",
    };
  }

  await solicitarRecuperacion(parsed.data.email);

  return { enviado: true };
}

const cambioSchema = z
  .object({
    token: z.string().min(10),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      ),
    repeat: z.string(),
  })
  .refine((d) => d.password === d.repeat, {
    message: "Las dos contraseñas no coinciden.",
    path: ["repeat"],
  });

/**
 * Cambiar la contraseña con el enlace del correo.
 *
 * Al terminar se cierran TODAS las sesiones de esa persona. Si la cuenta estaba
 * comprometida, cambiar la contraseña sin echar al intruso no sirve de nada:
 * seguiría dentro con su cookie.
 */
export async function resetPasswordAction(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = cambioSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    repeat: formData.get("repeat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const ip = await ipDeLaPeticion();
  const limite = await rateLimit(`reset:ip:${ip}`, { limit: 20, windowSeconds: 900 });
  if (!limite.allowed) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }

  const resultado = await comprobarToken(parsed.data.token, "reset");
  if (!resultado.ok) {
    return {
      error:
        resultado.motivo === "caducado"
          ? "Este enlace ha caducado. Pide uno nuevo."
          : resultado.motivo === "usado"
            ? "Este enlace ya se ha usado. Pide uno nuevo."
            : "Este enlace no es válido. Pide uno nuevo.",
    };
  }

  await prismaBase.user.update({
    where: { id: resultado.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  await consumirToken(resultado.tokenId);
  await revokeAllSessions(resultado.userId);

  // La auditoría se anota en cada academia de la persona: es su equipo quien
  // tiene que poder ver que hubo un cambio de contraseña.
  const membresias = await prismaBase.membership.findMany({
    where: { userId: resultado.userId },
    select: { academyId: true },
  });

  for (const membresia of membresias) {
    await recordAudit({
      academyId: membresia.academyId,
      actorId: resultado.userId,
      action: "auth.password_reset",
      entityType: "User",
      entityId: resultado.userId,
      changes: { via: "enlace de recuperación", sesionesCerradas: true },
    });
  }

  redirect("/entrar?cambiada=1");
}

/** Reenviar el correo de verificación desde el perfil. */
export async function resendVerificationAction(): Promise<void> {
  const { getAuthContext } = await import("@/lib/auth/context");
  const ctx = await getAuthContext();
  if (!ctx) redirect("/entrar");

  const ip = await ipDeLaPeticion();
  const limite = await rateLimit(`verify:${ctx.user.id}:${ip}`, {
    limit: 3,
    windowSeconds: 900,
  });
  if (!limite.allowed) return;

  await enviarVerificacionDeCorreo(ctx.user.id);
}
