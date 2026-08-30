import { createHash, randomBytes } from "node:crypto";
import { prismaBase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { BRAND } from "@/lib/brand";

/**
 * RECUPERAR LA CONTRASEÑA · VERIFICAR EL CORREO
 *
 * Las dos cosas usan el mismo mecanismo, y las dos son puertas de entrada a una
 * cuenta: por eso están escritas con el mismo cuidado que el inicio de sesión.
 *
 * Reglas que se siguen aquí:
 *
 *   · **En la base solo vive el resumen del testigo**, nunca el testigo. Igual
 *     que las sesiones (ADR-0015). Quien lea la base de datos no puede entrar
 *     en ninguna cuenta.
 *   · **Un solo uso y con caducidad.** Una hora para recuperar la contraseña,
 *     tres días para verificar el correo. Al usarlo se marca y ya no vale.
 *   · **Un testigo nuevo invalida los anteriores.** Si alguien pide el enlace
 *     tres veces, solo funciona el último.
 *   · **Al cambiar la contraseña se cierran todas las sesiones.** Si la cuenta
 *     estaba comprometida, cambiar la contraseña sin echar al intruso no sirve
 *     de nada.
 *   · **La respuesta es siempre la misma**, exista el correo o no. Si el
 *     mensaje cambiara, este formulario sería una lista de quién está dado de
 *     alta.
 */

/** Una hora. Suficiente para leer un correo; poco para dejarlo abandonado. */
const CADUCIDAD_RESET_MINUTOS = 60;
/** Tres días: el alta la suele hacer la academia y el alumno tarda en verlo. */
const CADUCIDAD_VERIFICACION_HORAS = 72;

/** Para qué sirve un testigo. Los dos tipos comparten tabla; esto los separa. */
/**
 * Para qué sirve un testigo.
 *
 * Los dos tipos comparten tabla, y por eso el propósito se comprueba siempre:
 * un enlace de «confirma tu correo» no puede acabar cambiando una contraseña.
 */
export type ProposiroToken = "reset" | "verify";

/**
 * Prefijo que distingue el testigo de verificación.
 *
 * Va DENTRO del texto sobre el que se calcula el resumen, así que no se puede
 * quitar ni añadir sin invalidar el testigo.
 */
const PREFIJO_VERIFICACION = "v_";

/**
 * El testigo que viaja en el enlace.
 *
 * @returns 32 bytes aleatorios en base64url. Como con las sesiones, en la base
 *   solo se guarda su resumen: quien lea la tabla no puede usar los enlaces.
 */
export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Resumen del testigo, que es lo único que se guarda.
 *
 * @param token El testigo del enlace, **con su prefijo si lo lleva**. El
 *   prefijo va dentro del texto que se resume, así que no se puede quitar ni
 *   añadir sin invalidar el testigo entero.
 * @returns Su SHA-256 en hexadecimal.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crea un testigo de recuperación y envía el correo.
 *
 * @param email El correo que se ha escrito en el formulario.
 * @returns Nada, y **no dice si existía**. Quien llama no puede distinguir «no
 *   hay nadie con ese correo» de «enviado», porque esa diferencia convertiría
 *   el formulario de recuperación en un comprobador de quién está apuntado.
 */
export async function solicitarRecuperacion(email: string): Promise<void> {
  const usuario = await prismaBase.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, status: true, deletedAt: true },
  });

  // Cuenta inexistente, de baja o suspendida: no se envía nada, pero tampoco se
  // dice. El silencio es la respuesta.
  if (!usuario || usuario.deletedAt || usuario.status !== "ACTIVE") return;

  const token = generarToken();

  // Los anteriores dejan de valer. Si alguien pidió el enlace tres veces, solo
  // el último funciona.
  await prismaBase.passwordResetToken.updateMany({
    where: { userId: usuario.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prismaBase.passwordResetToken.create({
    data: {
      userId: usuario.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + CADUCIDAD_RESET_MINUTOS * 60 * 1000),
    },
  });

  const enlace = `${env.APP_URL}/recuperar/${token}`;

  await sendEmail({
    to: email,
    subject: `Recupera tu contraseña de ${BRAND.name}`,
    text: [
      `Hola, ${usuario.firstName}:`,
      "",
      "Has pedido cambiar tu contraseña. Abre este enlace para hacerlo:",
      enlace,
      "",
      `El enlace caduca en ${CADUCIDAD_RESET_MINUTOS} minutos y solo se puede usar una vez.`,
      "",
      "Si no has sido tú, no hace falta que hagas nada: tu contraseña actual sigue funcionando.",
      "",
      BRAND.name,
    ].join("\n"),
    html: correoHtml({
      titulo: "Recupera tu contraseña",
      saludo: `Hola, ${usuario.firstName}:`,
      cuerpo:
        "Has pedido cambiar tu contraseña. Pulsa el botón para elegir una nueva.",
      boton: { texto: "Cambiar mi contraseña", enlace },
      pie: `El enlace caduca en ${CADUCIDAD_RESET_MINUTOS} minutos y solo sirve una vez. Si no has sido tú, no hace falta que hagas nada.`,
    }),
  });
}

/**
 * Qué ha pasado al comprobar un testigo.
 *
 * Los tres motivos se distinguen aquí dentro para poder decirle a la persona
 * algo útil —«este enlace ya se usó» es distinto de «ha caducado»—, pero un
 * enlace de otro propósito se responde como `no-existe`.
 */
export type ResultadoToken =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; motivo: "no-existe" | "caducado" | "usado" };

/**
 * Comprueba un testigo sin consumirlo.
 *
 * El propósito importa: los dos tipos comparten tabla, así que sin esta
 * comprobación un enlace de «confirma tu correo» —que caduca en tres días y que
 * cualquiera puede haber reenviado— serviría para cambiar la contraseña. Es el
 * error clásico de compartir tabla y aquí está cerrado por el prefijo del
 * propio testigo, que va dentro del resumen y no se puede falsear.
 *
 * @param token El testigo del enlace.
 * @param proposito Para qué se quiere usar.
 * @returns `{ ok: true }` con el usuario y el identificador del testigo, o
 *   `{ ok: false }` con el motivo. **No lo consume**: eso es
 *   {@link consumirToken}, y va después de haber cambiado la contraseña.
 */
export async function comprobarToken(
  token: string,
  proposito: ProposiroToken,
): Promise<ResultadoToken> {
  const esVerificacion = token.startsWith(PREFIJO_VERIFICACION);
  if (proposito === "reset" && esVerificacion) {
    return { ok: false, motivo: "no-existe" };
  }
  if (proposito === "verify" && !esVerificacion) {
    return { ok: false, motivo: "no-existe" };
  }

  const registro = await prismaBase.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!registro) return { ok: false, motivo: "no-existe" };
  if (registro.usedAt) return { ok: false, motivo: "usado" };
  if (registro.expiresAt.getTime() < Date.now()) {
    return { ok: false, motivo: "caducado" };
  }

  return { ok: true, userId: registro.userId, tokenId: registro.id };
}

/**
 * Marca el testigo como usado.
 *
 * Va **después** de cambiar la contraseña, no antes: si el cambio falla, el
 * enlace tiene que seguir sirviendo. Al revés, la persona se quedaría fuera con
 * un enlace gastado y sin contraseña nueva.
 *
 * @param tokenId El identificador que devolvió {@link comprobarToken}.
 */
export async function consumirToken(tokenId: string): Promise<void> {
  await prismaBase.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

/**
 * Verificación del correo.
 *
 * Reutiliza la misma tabla que la recuperación. La diferencia está en la
 * caducidad y en lo que hace el enlace al abrirse: aquí no se cambia ninguna
 * contraseña, solo se sella `emailVerifiedAt`.
 *
 * Se distingue del testigo de recuperación por su prefijo: así un enlace de
 * verificación nunca puede usarse para cambiar una contraseña.
 *
 * @param userId A quién se le manda.
 * @returns Nada. No hace nada si el correo ya estaba verificado o si el usuario
 *   no existe: reenviar una verificación es una acción que se repite sola.
 */
export async function enviarVerificacionDeCorreo(userId: string): Promise<void> {
  const usuario = await prismaBase.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, emailVerifiedAt: true },
  });
  if (!usuario || usuario.emailVerifiedAt) return;

  const token = PREFIJO_VERIFICACION + generarToken();

  await prismaBase.passwordResetToken.create({
    data: {
      userId: usuario.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(
        Date.now() + CADUCIDAD_VERIFICACION_HORAS * 60 * 60 * 1000,
      ),
    },
  });

  const enlace = `${env.APP_URL}/verificar/${token}`;

  await sendEmail({
    to: usuario.email,
    subject: `Confirma tu correo en ${BRAND.name}`,
    text: [
      `Hola, ${usuario.firstName}:`,
      "",
      "Confirma que este correo es tuyo abriendo este enlace:",
      enlace,
      "",
      `El enlace caduca en ${CADUCIDAD_VERIFICACION_HORAS} horas.`,
      "",
      BRAND.name,
    ].join("\n"),
    html: correoHtml({
      titulo: "Confirma tu correo",
      saludo: `Hola, ${usuario.firstName}:`,
      cuerpo:
        "Confirma que este correo es tuyo. Así podremos avisarte de tus clases, de tus entregas y de las convocatorias que te interesan.",
      boton: { texto: "Confirmar mi correo", enlace },
      pie: `El enlace caduca en ${CADUCIDAD_VERIFICACION_HORAS} horas.`,
    }),
  });
}

/**
 * ¿Es un testigo de verificación de correo?
 *
 * @param token El testigo del enlace.
 * @returns `true` si lleva el prefijo. Se mira antes de nada para no gastar una
 *   consulta con un enlace del otro tipo.
 */
export function esTokenDeVerificacion(token: string): boolean {
  return token.startsWith(PREFIJO_VERIFICACION);
}

/**
 * Consume un testigo de verificación y sella la fecha en el usuario.
 *
 * @param token El testigo del enlace.
 * @returns El resultado de la comprobación. Si sale bien, el correo queda
 *   verificado y el testigo gastado.
 */
export async function verificarCorreo(token: string): Promise<ResultadoToken> {
  if (!esTokenDeVerificacion(token)) return { ok: false, motivo: "no-existe" };

  const resultado = await comprobarToken(token, "verify");
  if (!resultado.ok) return resultado;

  await prismaBase.user.update({
    where: { id: resultado.userId },
    data: { emailVerifiedAt: new Date() },
  });
  await consumirToken(resultado.tokenId);

  return resultado;
}

/**
 * Limpieza de testigos caducados.
 *
 * La ejecuta la tarea programada. No es solo higiene: son datos que apuntan a
 * cuentas concretas y no hay razón para conservarlos una vez no sirven.
 *
 * @returns Cuántos se han borrado. Se van los caducados y los ya usados hace
 *   más de una semana; los usados se conservan ese tiempo por si hay que
 *   reconstruir qué pasó con una cuenta.
 */
export async function limpiarTokensCaducados(): Promise<number> {
  const { count } = await prismaBase.passwordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return count;
}

/** Plantilla del correo. Sobria y legible en cualquier cliente. */
function correoHtml(params: {
  titulo: string;
  saludo: string;
  cuerpo: string;
  boton: { texto: string; enlace: string };
  pie: string;
}): string {
  // Estilos en línea y tabla: es lo único que respetan todos los clientes de
  // correo. Aquí no se puede usar el design system.
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f5f3ef;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c2233">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fefdfb;border-radius:16px;border:1px solid #e6e2da">
    <tr><td style="padding:28px 28px 8px">
      <div style="width:40px;height:40px;border-radius:12px;background:#2956c4;color:#fff;font-size:20px;font-weight:700;text-align:center;line-height:40px">G</div>
      <h1 style="margin:20px 0 4px;font-size:22px;line-height:1.25">${params.titulo}</h1>
      <p style="margin:16px 0 4px;font-size:15px">${params.saludo}</p>
      <p style="margin:8px 0 20px;font-size:15px;line-height:1.6;color:#4b5262">${params.cuerpo}</p>
      <a href="${params.boton.enlace}" style="display:inline-block;background:#2956c4;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${params.boton.texto}</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7182">${params.pie}</p>
      <p style="margin:12px 0 0;font-size:12px;color:#8a8f9c;word-break:break-all">Si el botón no funciona, copia esta dirección en tu navegador:<br>${params.boton.enlace}</p>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #e6e2da;font-size:12px;color:#8a8f9c">
      ${BRAND.name}
    </td></tr>
  </table>
</body></html>`;
}
