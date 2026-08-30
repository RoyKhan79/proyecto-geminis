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

/** Nombre de la cookie de sesión. Se exporta porque lo usa el arnés de pruebas. */
export const SESSION_COOKIE = "geminis_session";

const SESSION_MS = env.SESSION_DAYS * 24 * 60 * 60 * 1000;
/// A partir de la mitad de vida, la sesión se renueva sola al usarla.
const RENEW_THRESHOLD_MS = SESSION_MS / 2;

/**
 * Genera el testigo de sesión que viaja en la cookie.
 *
 * @returns 32 bytes aleatorios en base64url, 43 caracteres. No se guarda en
 *   claro en ningún sitio: en la base solo vive su SHA-256.
 * @see hashSessionToken
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Resumen del testigo, que es lo único que se guarda.
 *
 * SHA-256 a secas y no scrypt, a diferencia de las contraseñas: el testigo ya
 * son 256 bits aleatorios, así que no hay nada que adivinar por fuerza bruta y
 * un resumen lento solo encarecería cada petición. En una contraseña —corta y
 * elegida por una persona— el coste es justo lo que protege.
 *
 * @param token El testigo en claro.
 * @returns Su SHA-256 en hexadecimal.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Nombre legible del dispositivo, deducido del `User-Agent`.
 *
 * No es identificación ni seguimiento: es lo justo para que en «mis sesiones»
 * la persona reconozca cuál es la suya y para poder contar dispositivos
 * distintos. No se guarda nada que no estuviera ya guardado.
 *
 * @param userAgent La cabecera tal cual, o nada si no llegó.
 * @returns Algo como «Chrome en Windows», o «Dispositivo desconocido» si no se
 *   puede deducir. Nunca `null`: esto se pinta en pantalla.
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
  // tenant-ok · se miran TODAS las academias de la persona a propósito. Una
  // misma cuenta puede ser alumna en una y profesora en otra, y el límite tiene
  // que salir de todas: acotar por una sola dejaría fuera la que manda.
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

/**
 * Abre una sesión y devuelve el testigo en claro **una sola vez**.
 *
 * Es la única ocasión en que ese valor existe fuera de la cookie: en la base se
 * guarda solo su resumen, así que si se pierde aquí no se puede recuperar.
 *
 * @param params.userId Persona que entra.
 * @param params.activeAcademyId Academia con la que empieza, si ya se sabe.
 *   Quien pertenece a varias la elige después.
 * @param params.ipAddress Para que la persona reconozca sus sesiones.
 * @param params.userAgent Se recorta a 500 caracteres y se guarda también su
 *   versión legible.
 * @param params.impersonatedById Quién está dando soporte, si es una sesión de
 *   soporte. **Marca la diferencia**: esas sesiones no cuentan para el límite
 *   de dispositivos, porque entrar a ayudar no puede echar al alumno de su
 *   propia cuenta.
 * @returns El testigo en claro, la sesión creada y cuántas sesiones antiguas se
 *   han cerrado por el límite de dispositivos.
 */
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

/**
 * Las sesiones abiertas de una persona, para que las vea en su perfil.
 *
 * @param userId De quién.
 * @returns Las vivas —ni revocadas ni caducadas—, de la más reciente a la más
 *   antigua. No incluye el testigo ni su resumen: esta lista se pinta.
 */
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

/**
 * Una sesión ya comprobada, con su usuario y sus academias cargados.
 *
 * Se deriva del tipo de retorno en lugar de escribirse a mano para que no pueda
 * desincronizarse del `select` de la consulta.
 */
export type ValidatedSession = NonNullable<
  Awaited<ReturnType<typeof validateSessionToken>>
>;

/**
 * Comprueba un testigo y, de paso, renueva la sesión si toca.
 *
 * @param token El testigo de la cookie, en claro.
 * @returns La sesión con su usuario y sus academias, o `null` si el testigo no
 *   existe, está revocado o ha caducado. Los tres casos devuelven lo mismo a
 *   propósito: quien prueba testigos no debe poder distinguirlos.
 *
 * @remarks
 * Pasada la mitad de la vida de la sesión, la renueva sola al usarla. Así quien
 * entra a diario no tiene que volver a identificarse cada quince días, y quien
 * deja de entrar caduca igualmente.
 */
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

/**
 * Cierra una sesión concreta.
 *
 * No borra la fila: la marca. Las revocadas se conservan treinta días a
 * propósito, porque si alguien denuncia un acceso indebido la academia
 * necesita poder ver desde dónde se entró. El mantenimiento nocturno las
 * limpia después.
 *
 * @param sessionId Cuál. Si ya estaba cerrada no pasa nada: es idempotente.
 */
export async function revokeSession(sessionId: string) {
  await prismaBase.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Cierra todas las sesiones de una persona.
 *
 * Se llama al cambiar la contraseña, al dar de baja y al terminar el soporte.
 *
 * @param userId De quién.
 * @param exceptSessionId La que se salva, normalmente la actual: quien cambia
 *   su contraseña espera echar a los demás, no a sí mismo.
 */
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

/**
 * Cambia la academia activa de una sesión.
 *
 * Para quien pertenece a varias: el mismo inicio de sesión, otro contexto.
 *
 * @param sessionId La sesión en curso.
 * @param academyId La academia, o `null` para dejarla sin elegir. Quien llama
 *   es responsable de haber comprobado que esa persona pertenece a ella.
 */
export async function setActiveAcademy(sessionId: string, academyId: string | null) {
  await prismaBase.session.update({
    where: { id: sessionId },
    data: { activeAcademyId: academyId },
  });
}

// ── Cookie ───────────────────────────────────────────────────────────────────

/**
 * Deja la cookie de sesión en la respuesta.
 *
 * `httpOnly` para que ningún script pueda leerla, `sameSite: lax` contra CSRF y
 * `secure` en producción, donde va por HTTPS. En desarrollo no, porque en
 * `http://localhost` el navegador la descartaría y no se podría entrar.
 *
 * @param token El testigo en claro.
 */
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

/**
 * Borra la cookie de sesión.
 *
 * Se escribe vacía con caducidad cero en vez de eliminarla, que es la forma
 * fiable de que el navegador la tire. Las mismas banderas que al ponerla: si no
 * coinciden, algunos navegadores dejan la vieja donde estaba.
 */
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

/**
 * Lee el testigo de la petición en curso.
 *
 * @returns El testigo, o `null` si no hay cookie. Que exista no significa que
 *   valga: eso lo decide {@link validateSessionToken}.
 */
export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
