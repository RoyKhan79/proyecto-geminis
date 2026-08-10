import { prismaBase } from "@/lib/db/client";

/**
 * Registro de auditoría (§49).
 *
 * Único punto de escritura. Nada de esto se borra ni se edita desde la
 * aplicación: si hiciera falta purgar por retención, sería un proceso
 * administrativo explícito y documentado.
 */

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "secret",
  "apikey",
  "authorization",
  "cookie",
];

/** Sustituye valores sensibles por «·····» a cualquier profundidad. */
export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
        ? "·····"
        : maskSensitive(val);
    }
    return out;
  }
  return value;
}

export type AuditEvent = {
  academyId?: string | null;
  actorId?: string | null;
  impersonatorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: unknown;
  context?: Record<string, unknown>;
};

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    await prismaBase.auditLog.create({
      data: {
        academyId: event.academyId ?? null,
        actorId: event.actorId ?? null,
        impersonatorId: event.impersonatorId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        changes: event.changes
          ? (maskSensitive(event.changes) as object)
          : undefined,
        context: event.context
          ? (maskSensitive(event.context) as object)
          : undefined,
      },
    });
  } catch (error) {
    // Que falle la auditoría no debe tumbar la operación del usuario, pero
    // tiene que verse: en la fase de observabilidad esto irá al recolector.
    console.error("[audit] no se ha podido registrar el evento", event.action, error);
  }
}

/** Calcula qué campos han cambiado, para no guardar filas enteras. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { antes: unknown; despues: unknown }> {
  const changes: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    const prev = before[key];
    const same =
      prev instanceof Date && value instanceof Date
        ? prev.getTime() === value.getTime()
        : prev === value;
    if (!same) changes[key] = { antes: prev ?? null, despues: value ?? null };
  }
  return changes;
}
