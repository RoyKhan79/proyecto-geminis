import { describe, expect, it } from "vitest";
import { esTokenDeVerificacion, generarToken, hashToken } from "@/lib/auth/recovery";

/**
 * Recuperar la contraseña es una puerta de entrada a una cuenta. Se prueba con
 * el mismo criterio que el inicio de sesión: lo que no puede fallar nunca.
 */

describe("generarToken", () => {
  it("no repite", () => {
    const testigos = new Set(Array.from({ length: 500 }, () => generarToken()));
    expect(testigos.size).toBe(500);
  });

  it("tiene entropía suficiente", () => {
    // 32 bytes en base64url son 43 caracteres. Con menos, sería adivinable por
    // fuerza bruta con el tiempo suficiente.
    expect(generarToken().length).toBeGreaterThanOrEqual(43);
  });

  it("es seguro en una URL", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generarToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("hashToken", () => {
  it("no permite recuperar el testigo", () => {
    const token = generarToken();
    const resumen = hashToken(token);
    expect(resumen).not.toContain(token);
    expect(resumen).toHaveLength(64);
  });

  it("es estable", () => {
    const token = generarToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("cambia entero con un solo carácter distinto", () => {
    expect(hashToken("abcdef")).not.toBe(hashToken("abcdeg"));
  });
});

describe("separación de propósitos", () => {
  it("distingue el testigo de verificación del de recuperación", () => {
    expect(esTokenDeVerificacion("v_" + generarToken())).toBe(true);
    expect(esTokenDeVerificacion(generarToken())).toBe(false);
  });

  it("el prefijo va dentro del resumen, así que no se puede quitar", () => {
    // Si alguien recorta el prefijo, el resumen cambia y el testigo deja de
    // existir en la base. Es lo que impide usar un enlace de «confirma tu
    // correo» para cambiar una contraseña.
    const base = generarToken();
    expect(hashToken("v_" + base)).not.toBe(hashToken(base));
  });
});
