import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// `promisify` elige la sobrecarga sin opciones; la fijamos a la que sí las
// acepta, que es la que necesitamos para controlar el coste del KDF.
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Hash de contraseñas con scrypt (node:crypto).
 *
 * Decisión ADR-0014: usamos scrypt de la biblioteca estándar de Node en lugar
 * de argon2 o bcrypt. Motivos: es un KDF con coste de memoria aprobado por
 * OWASP, no añade dependencias nativas que compilar en cada plataforma de
 * despliegue, y no hay que confiar en el mantenimiento de un paquete externo
 * para algo tan crítico. El formato guarda los parámetros, así que subir el
 * coste en el futuro no invalida las contraseñas existentes.
 *
 * Formato almacenado:  scrypt$N$r$p$<salt base64>$<hash base64>
 */
const PARAMS = { N: 65536, r: 8, p: 1, keylen: 64 } as const;
// 128 · N · r = 64 MiB; damos margen al límite de memoria de Node.
const MAXMEM = 160 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  assertPasswordShape(password);
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen, {
    ...PARAMS,
    maxmem: MAXMEM,
  });

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * ¿Conviene rehashear? Devuelve true si la contraseña se guardó con parámetros
 * más débiles que los actuales, para poder actualizarla en el siguiente acceso.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return true;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < PARAMS.N;
}

export const PASSWORD_MIN_LENGTH = 10;

function assertPasswordShape(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    );
  }
  if (password.length > 512) {
    // Evita que una entrada enorme convierta el login en una denegación de
    // servicio por consumo de CPU.
    throw new Error("La contraseña es demasiado larga.");
  }
}
