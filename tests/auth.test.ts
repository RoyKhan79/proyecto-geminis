import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { hashSessionToken, generateSessionToken } from "@/lib/auth/session";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  SYSTEM_ROLES,
  isValidPermission,
} from "@/lib/auth/permissions";
import { maskSensitive, diff } from "@/lib/audit";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("contraseñas", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashPassword("una-contraseña-larga");
    expect(await verifyPassword("una-contraseña-larga", hash)).toBe(true);
    expect(await verifyPassword("otra-contraseña-larga", hash)).toBe(false);
  });

  it("genera un hash distinto cada vez (sal aleatoria)", async () => {
    const a = await hashPassword("misma-contraseña");
    const b = await hashPassword("misma-contraseña");
    expect(a).not.toBe(b);
  });

  it("nunca guarda la contraseña en claro", async () => {
    const hash = await hashPassword("secreto-muy-secreto");
    expect(hash).not.toContain("secreto-muy-secreto");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("rechaza contraseñas demasiado cortas", async () => {
    await expect(hashPassword("corta")).rejects.toThrow();
  });

  it("no acepta un hash ausente o con formato desconocido", async () => {
    expect(await verifyPassword("lo-que-sea", null)).toBe(false);
    expect(await verifyPassword("lo-que-sea", "bcrypt$algo")).toBe(false);
  });

  it("detecta hashes con parámetros anticuados", async () => {
    expect(needsRehash("scrypt$1024$8$1$c2FsdA==$aGFzaA==")).toBe(true);
    expect(needsRehash(await hashPassword("una-contraseña-larga"))).toBe(false);
  });
});

describe("sesiones", () => {
  it("los tokens son largos y distintos entre sí", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("en base de datos solo se guarda el hash del token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(hash);
  });
});

describe("catálogo de permisos", () => {
  it("todos los permisos de los roles del sistema existen en el catálogo", () => {
    for (const [clave, rol] of Object.entries(SYSTEM_ROLES)) {
      for (const permiso of rol.permissions) {
        expect(isValidPermission(permiso), `${clave} → ${permiso}`).toBe(true);
      }
    }
  });

  it("el alumno no recibe ningún permiso de gestión", () => {
    const prohibidos = SYSTEM_ROLES.STUDENT.permissions.filter((permiso) =>
      permiso.endsWith(".write") ||
      permiso.endsWith(".publish") ||
      permiso === "manager.access" ||
      permiso === "attempts.read.all",
    );
    expect(prohibidos).toEqual([]);
  });

  it("el personal administrativo no ve observaciones internas ni publica contenido", () => {
    expect(SYSTEM_ROLES.STAFF.permissions).not.toContain("students.notes");
    expect(SYSTEM_ROLES.STAFF.permissions).not.toContain("content.publish");
  });

  it("el personal administrativo no accede a la configuración ni a los roles", () => {
    // La pantalla de Configuración muestra cómo está montado el acceso de toda
    // la academia; no forma parte del trabajo administrativo.
    expect(SYSTEM_ROLES.STAFF.permissions).not.toContain("settings.read");
    expect(SYSTEM_ROLES.STAFF.permissions).not.toContain("settings.write");
    expect(SYSTEM_ROLES.STAFF.permissions).not.toContain("roles.write");
  });

  it("el alumnado NUNCA lleva content.read (permiso de personal)", () => {
    // Regresión de un fallo real: la ruta de archivos usaba content.read para
    // distinguir al personal del alumnado. Con ese permiso, cualquier alumno
    // se saltaba la comprobación de derechos y podía abrir material no
    // contratado. Si alguien vuelve a añadirlo, esta prueba falla.
    expect(SYSTEM_ROLES.STUDENT.permissions).not.toContain("content.read");
    expect(SYSTEM_ROLES.STUDENT.permissions).not.toContain("manager.access");
  });

  it("el administrador de academia no recibe permisos de alumno", () => {
    expect(SYSTEM_ROLES.ACADEMY_ADMIN.permissions).not.toContain("campus.access");
  });

  it("cada permiso declara grupo y etiqueta", () => {
    for (const permiso of ALL_PERMISSIONS) {
      expect(PERMISSIONS[permiso].label.length).toBeGreaterThan(3);
      expect(PERMISSIONS[permiso].group).toBeTruthy();
    }
  });
});

describe("auditoría", () => {
  it("enmascara valores sensibles a cualquier profundidad", () => {
    const resultado = maskSensitive({
      email: "a@b.test",
      passwordHash: "scrypt$...",
      anidado: { apiKey: "sk-123", token: "abc", nombre: "Ana" },
    }) as Record<string, unknown>;

    expect(resultado.email).toBe("a@b.test");
    expect(resultado.passwordHash).toBe("·····");
    const anidado = resultado.anidado as Record<string, unknown>;
    expect(anidado.apiKey).toBe("·····");
    expect(anidado.token).toBe("·····");
    expect(anidado.nombre).toBe("Ana");
  });

  it("registra solo los campos que cambian", () => {
    const cambios = diff(
      { nombre: "Ana", telefono: "600", estado: "ACTIVE" },
      { nombre: "Ana María", estado: "ACTIVE" },
    );
    expect(Object.keys(cambios)).toEqual(["nombre"]);
    expect(cambios.nombre).toEqual({ antes: "Ana", despues: "Ana María" });
  });
});

describe("límite de intentos", () => {
  it("bloquea al superar el límite y se puede reiniciar", () => {
    const clave = `prueba:${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(clave, { limit: 3, windowSeconds: 60 }).allowed).toBe(true);
    }
    const bloqueado = rateLimit(clave, { limit: 3, windowSeconds: 60 });
    expect(bloqueado.allowed).toBe(false);
    expect(bloqueado.retryAfterSeconds).toBeGreaterThan(0);

    resetRateLimit(clave);
    expect(rateLimit(clave, { limit: 3, windowSeconds: 60 }).allowed).toBe(true);
  });
});
