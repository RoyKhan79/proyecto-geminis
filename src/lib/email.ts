import { env, isProduction } from "@/lib/env";

/**
 * ENVÍO DE CORREO
 *
 * Interfaz única con dos comportamientos:
 *
 *   · en desarrollo (sin SMTP configurado) el correo se escribe en la consola
 *     y en `.dev/emails/`, para poder verlo sin montar nada;
 *   · en producción se envía por SMTP.
 *
 * Se hace así a propósito: durante el desarrollo hay que poder probar avisos y
 * radares sin arriesgarse a mandar correos de verdad a nadie.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

/**
 * Envía un correo.
 *
 * @returns Nada. **No lanza si el envío falla**: se registra y se sigue. Que el
 *   servidor de correo esté caído no puede impedir dar de alta a un alumno, y
 *   el reintento es una decisión de quien llama, no de aquí.
 * @remarks Sin SMTP configurado, escribe el correo en la salida estándar en
 *   lugar de fallar en silencio. Es lo que permite trabajar en local, y lo que
 *   evita que en producción nadie note que no se envía nada.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const configurado = Boolean(env.SMTP_HOST && env.SMTP_USER);

  if (!configurado) {
    if (isProduction) {
      console.error(
        "[email] SMTP sin configurar: no se ha enviado el correo a",
        message.to,
      );
      return false;
    }
    return escribirEnDisco(message);
  }

  try {
    // El transporte real se carga solo cuando hace falta, para no meter el
    // paquete en el build de quien no envía correo.
    const nodemailer = await import("nodemailer").catch(() => null);
    if (!nodemailer) {
      console.warn("[email] nodemailer no está instalado; se escribe en disco.");
      return escribirEnDisco(message);
    }

    const transport = nodemailer.default.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });

    await transport.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    return true;
  } catch (error) {
    // Que falle un correo no puede tumbar la operación que lo originó.
    console.error("[email] fallo al enviar a", message.to, error);
    return false;
  }
}

async function escribirEnDisco(message: EmailMessage): Promise<boolean> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");

  const carpeta = path.join(process.cwd(), ".dev", "emails");
  await mkdir(carpeta, { recursive: true });

  const nombre = `${Date.now()}-${message.to.replace(/[^a-z0-9@._-]/gi, "_")}.txt`;
  const contenido = [
    `Para: ${message.to}`,
    `Asunto: ${message.subject}`,
    "",
    message.text,
  ].join("\n");

  await writeFile(path.join(carpeta, nombre), contenido, "utf8");
  console.log(`[email] (desarrollo) → .dev/emails/${nombre} · ${message.subject}`);
  return true;
}
