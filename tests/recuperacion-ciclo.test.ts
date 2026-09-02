import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  comprobarToken,
  consumirToken,
  generarToken,
  hashToken,
  limpiarTokensCaducados,
  verificarCorreo,
} from "@/lib/auth/recovery";
import {
  createSession,
  revokeAllSessions,
  validateSessionToken,
} from "@/lib/auth/session";

/**
 * RECUPERAR LA CONTRASEÑA · el ciclo entero
 *
 * `tests/recovery.test.ts` comprueba las propiedades del testigo: que tiene
 * entropía, que no se repite, que el prefijo va dentro del resumen. Todo eso
 * está bien y no es lo que rompe una recuperación de contraseña.
 *
 * Lo que la rompe es el CICLO: que un enlace sirva dos veces, que uno caducado
 * siga valiendo, que pedir uno nuevo no invalide el anterior, o que cambiar la
 * contraseña deje abierta la sesión de quien se había metido en la cuenta. Nada
 * de eso estaba probado, y son justo los cuatro fallos que convierten una
 * recuperación en una puerta.
 *
 * Estas pruebas usan la base de datos porque el ciclo ES la base de datos: un
 * testigo de un solo uso lo es porque hay una fila que se marca.
 */

const SUF = `rec${Date.now().toString(36)}`;
let usuario: { id: string; email: string };

beforeAll(async () => {
  usuario = await prismaBase.user.create({
    data: {
      email: `recuperacion@${SUF}.test`,
      firstName: "Recuperación",
      passwordHash: await hashPassword("contrasena-inicial-larga"),
      emailVerifiedAt: null,
    },
    select: { id: true, email: true },
  });
});

afterAll(async () => {
  await prismaBase.passwordResetToken.deleteMany({ where: { userId: usuario.id } });
  await prismaBase.session.deleteMany({ where: { userId: usuario.id } });
  await prismaBase.user.deleteMany({ where: { email: { endsWith: `@${SUF}.test` } } });
  await prismaBase.$disconnect();
});

/** Crea un testigo de recuperación directamente, sin pasar por el correo. */
async function nuevoTestigo(opciones?: { caducaEn?: number }) {
  const token = generarToken();
  const fila = await prismaBase.passwordResetToken.create({
    data: {
      userId: usuario.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + (opciones?.caducaEn ?? 60 * 60 * 1000)),
    },
    select: { id: true },
  });
  return { token, id: fila.id };
}

describe("recuperación · un testigo sirve una vez y solo una", () => {
  it("el primer uso vale", async () => {
    const { token } = await nuevoTestigo();
    const resultado = await comprobarToken(token, "reset");
    expect(resultado.ok).toBe(true);
  });

  it("el segundo uso NO vale", async () => {
    const { token } = await nuevoTestigo();

    const primero = await comprobarToken(token, "reset");
    expect(primero.ok).toBe(true);
    if (!primero.ok) return;

    await consumirToken(primero.tokenId);

    const segundo = await comprobarToken(token, "reset");
    expect(segundo.ok).toBe(false);
    if (!segundo.ok) expect(segundo.motivo).toBe("usado");
  });

  it("un testigo caducado no vale, aunque no se haya usado nunca", async () => {
    const { token } = await nuevoTestigo({ caducaEn: -1000 });
    const resultado = await comprobarToken(token, "reset");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("caducado");
  });

  it("un testigo inventado no vale", async () => {
    for (const inventado of [
      generarToken(),
      "",
      "a".repeat(43),
      "../../etc/passwd",
      "' OR 1=1 --",
    ]) {
      const resultado = await comprobarToken(inventado, "reset");
      expect(resultado.ok).toBe(false);
    }
  });

  it("en la base no está el testigo, solo su resumen", async () => {
    const { token, id } = await nuevoTestigo();
    const fila = await prismaBase.passwordResetToken.findUniqueOrThrow({
      where: { id },
      select: { tokenHash: true },
    });

    // Quien lea la tabla no puede entrar en ninguna cuenta.
    expect(fila.tokenHash).not.toBe(token);
    expect(fila.tokenHash).toBe(hashToken(token));
    expect(fila.tokenHash).toHaveLength(64);
  });
});

describe("recuperación · pedir uno nuevo invalida el anterior", () => {
  it("solo funciona el último de tres", async () => {
    const primero = await nuevoTestigo();
    const segundo = await nuevoTestigo();

    // Es lo que hace `solicitarRecuperacion` antes de crear el nuevo: marcar
    // como usados todos los que siguieran vivos.
    await prismaBase.passwordResetToken.updateMany({
      where: { userId: usuario.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const tercero = await nuevoTestigo();

    expect((await comprobarToken(primero.token, "reset")).ok).toBe(false);
    expect((await comprobarToken(segundo.token, "reset")).ok).toBe(false);
    expect((await comprobarToken(tercero.token, "reset")).ok).toBe(true);
  });
});

describe("recuperación · los dos tipos de enlace no se mezclan", () => {
  it("un enlace de verificación de correo NO cambia la contraseña", async () => {
    // Comparten tabla, y sin la comprobación del propósito un enlace de
    // «confirma tu correo» —que dura tres días y que cualquiera puede haber
    // reenviado— serviría para entrar en la cuenta. Es el fallo clásico de
    // compartir tabla.
    const token = "v_" + generarToken();
    await prismaBase.passwordResetToken.create({
      data: {
        userId: usuario.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const comoReset = await comprobarToken(token, "reset");
    expect(comoReset.ok).toBe(false);

    const comoVerificacion = await comprobarToken(token, "verify");
    expect(comoVerificacion.ok).toBe(true);
  });

  it("un enlace de recuperación NO verifica el correo", async () => {
    const { token } = await nuevoTestigo();
    const resultado = await verificarCorreo(token);
    expect(resultado.ok).toBe(false);

    const fila = await prismaBase.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { emailVerifiedAt: true },
    });
    expect(fila.emailVerifiedAt).toBeNull();
  });
});

describe("recuperación · cambiar la contraseña echa a quien estuviera dentro", () => {
  it("todas las sesiones abiertas dejan de valer", async () => {
    // El escenario: alguien se ha metido en la cuenta y su sesión sigue abierta.
    // Si cambiar la contraseña no la cierra, el titular cree que ha resuelto el
    // problema y el intruso sigue dentro con su cookie.
    const intruso = await createSession({ userId: usuario.id });
    const otra = await createSession({ userId: usuario.id });

    expect(await validateSessionToken(intruso.token)).not.toBeNull();
    expect(await validateSessionToken(otra.token)).not.toBeNull();

    const { token } = await nuevoTestigo();
    const resultado = await comprobarToken(token, "reset");
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    await prismaBase.user.update({
      where: { id: resultado.userId },
      data: { passwordHash: await hashPassword("contrasena-nueva-larga") },
    });
    await consumirToken(resultado.tokenId);
    await revokeAllSessions(resultado.userId);

    expect(await validateSessionToken(intruso.token)).toBeNull();
    expect(await validateSessionToken(otra.token)).toBeNull();
  });

  it("la contraseña nueva vale y la vieja ya no", async () => {
    const fila = await prismaBase.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { passwordHash: true },
    });
    expect(await verifyPassword("contrasena-nueva-larga", fila.passwordHash)).toBe(true);
    expect(await verifyPassword("contrasena-inicial-larga", fila.passwordHash)).toBe(false);
  });
});

describe("recuperación · limpieza", () => {
  it("los testigos caducados se borran y los vivos se quedan", async () => {
    await nuevoTestigo({ caducaEn: -1000 });
    const vivo = await nuevoTestigo();

    const borrados = await limpiarTokensCaducados();
    expect(borrados).toBeGreaterThan(0);

    // No es solo higiene: son filas que apuntan a cuentas concretas y no hay
    // razón para conservarlas una vez no sirven.
    expect((await comprobarToken(vivo.token, "reset")).ok).toBe(true);
  });
});
