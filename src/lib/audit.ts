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

/**
 * Sustituye valores sensibles por «·····» a cualquier profundidad.
 *
 * El registro de auditoría se conserva años y lo leen personas. Una contraseña
 * o un IBAN que se cuelen ahí quedan en claro para siempre, así que se tapan
 * antes de escribir y no después.
 *
 * @param value Cualquier cosa: objeto, lista, valor suelto.
 * @returns Una copia con los valores cuya CLAVE suene a secreto sustituidos.
 *   Se mira la clave y no el valor: adivinar por el contenido dejaría pasar
 *   demasiado y taparía cosas que no tocan.
 */
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

/**
 * Un hecho que queda registrado.
 *
 * `impersonatorId` es el que da sentido al soporte: cuando alguien de la
 * plataforma entra en una academia a ayudar, en el registro consta **quién
 * estaba de verdad detrás** de cada acción, no solo la cuenta suplantada.
 */
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

/**
 * Registra un hecho en la auditoría.
 *
 * @param event Qué ha pasado y quién lo ha hecho.
 * @returns Nada. **No lanza aunque falle**: que la auditoría no pueda escribir
 *   no puede tumbar la operación del usuario, que ya se ha hecho. El fallo se
 *   escribe en la salida de errores para que se vea.
 */
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

/**
 * Qué campos han cambiado, para no guardar la fila entera.
 *
 * @typeParam T La forma del registro.
 * @param before Cómo estaba.
 * @param after Lo que se ha escrito; basta con los campos tocados.
 * @returns Un objeto con solo lo que cambia, cada uno con su `antes` y su
 *   `despues`. Guardar la fila completa haría el registro ilegible y
 *   arrastraría datos personales que no hacían falta.
 */
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
