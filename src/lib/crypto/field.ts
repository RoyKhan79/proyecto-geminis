import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env, isProduction } from "@/lib/env";

/**
 * CIFRADO DE CAMPOS SENSIBLES
 *
 * Para lo que no debe leerse aunque alguien consiga una copia de la base de
 * datos: hoy, los números de cuenta del alumnado.
 *
 * Qué protege y qué no, sin adornos:
 *
 *   · SÍ: una copia de seguridad que se pierde, un volcado que acaba donde no
 *     debe, un acceso de solo lectura a la base, o el clásico «me han pasado el
 *     dump para depurar un problema».
 *   · NO: a quien tenga la aplicación en marcha y la clave. Si el servidor está
 *     comprometido, esto no salva nada. Para eso están las otras barreras.
 *
 * Decisiones:
 *
 *   · **AES-256-GCM.** Cifra y autentica a la vez: si alguien manipula el texto
 *     cifrado en la base, el descifrado falla en lugar de devolver basura que
 *     parezca un IBAN.
 *   · **Vector de inicialización nuevo en cada cifrado.** Cifrar dos veces el
 *     mismo IBAN da dos resultados distintos. Es lo correcto, y tiene una
 *     consecuencia: no se puede buscar por el campo cifrado. Por eso existe
 *     `huella()`.
 *   · **La clave viene del entorno**, nunca del código. Sin ella la aplicación
 *     arranca igual, pero los campos cifrados no se pueden leer y se dice.
 *
 * Formato guardado: `v1:base64(iv):base64(etiqueta):base64(cifrado)`. Lleva
 * versión delante para poder rotar el algoritmo sin adivinar qué es cada fila.
 */

const VERSION = "v1";
const ALGORITMO = "aes-256-gcm";
/// 96 bits es el tamaño recomendado para GCM.
const LONGITUD_IV = 12;

let avisoDado = false;

/**
 * La clave de cifrado, derivada del secreto del entorno.
 *
 * Se pasa por SHA-256 para admitir un secreto de cualquier longitud sin obligar
 * a quien despliega a generar exactamente 32 bytes.
 */
function clave(): Buffer | null {
  const secreto = env.FIELD_ENCRYPTION_KEY;

  if (!secreto) {
    if (isProduction) {
      // En producción esto es un fallo de configuración, no una opción.
      throw new Error(
        "FIELD_ENCRYPTION_KEY no está configurada. Sin ella, los datos bancarios se guardarían en claro.",
      );
    }
    if (!avisoDado) {
      console.warn(
        "[cifrado] FIELD_ENCRYPTION_KEY sin configurar: los campos sensibles se guardan en claro. Solo válido en desarrollo.",
      );
      avisoDado = true;
    }
    return null;
  }

  if (secreto.length < 32) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY es demasiado corta. Usa al menos 32 caracteres: `openssl rand -base64 48`.",
    );
  }

  return createHash("sha256").update(secreto).digest();
}

/** ¿Está ya cifrado este valor? Sirve para migrar sin cifrar dos veces. */
export function estaCifrado(valor: string): boolean {
  return valor.startsWith(`${VERSION}:`);
}

/**
 * Cifra un valor.
 *
 * Si no hay clave configurada devuelve el valor tal cual: en desarrollo se
 * prefiere que el proyecto arranque sin ceremonia, y ya se avisa por consola.
 * En producción, `clave()` lanza antes de llegar aquí.
 */
export function cifrar(valor: string): string {
  if (!valor) return valor;

  const k = clave();
  if (!k) return valor;

  const iv = randomBytes(LONGITUD_IV);
  const cipher = createCipheriv(ALGORITMO, k, iv);

  const cifrado = Buffer.concat([cipher.update(valor, "utf8"), cipher.final()]);
  const etiqueta = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    etiqueta.toString("base64"),
    cifrado.toString("base64"),
  ].join(":");
}

/**
 * Descifra un valor.
 *
 * Devuelve `null` si el texto está manipulado o la clave no es la que se usó
 * para cifrarlo. No se devuelve una cadena vacía ni se lanza: quien llama tiene
 * que poder distinguir «no hay IBAN» de «el IBAN no se puede leer».
 */
export function descifrar(valor: string | null): string | null {
  if (!valor) return null;

  // Valor antiguo, guardado antes de que existiera el cifrado.
  if (!estaCifrado(valor)) return valor;

  const k = clave();
  if (!k) return null;

  const [, ivB64, etiquetaB64, cifradoB64] = valor.split(":");
  if (!ivB64 || !etiquetaB64 || !cifradoB64) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITMO,
      k,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(etiquetaB64, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(cifradoB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Etiqueta de autenticación incorrecta: o la clave no es esa, o alguien ha
    // tocado la fila. En los dos casos, no hay dato.
    return null;
  }
}

/**
 * Huella determinista de un valor, para poder buscar sin descifrar.
 *
 * El cifrado usa un vector distinto cada vez, así que `WHERE iban = …` no
 * funciona. Cuando haga falta buscar por un campo cifrado, se guarda además su
 * huella y se busca por ella.
 *
 * Lleva la clave dentro (HMAC de pobre) para que quien tenga el volcado no
 * pueda comprobar si un IBAN concreto está en la base probándolo contra un
 * SHA-256 a secas.
 */
export function huella(valor: string): string {
  const k = clave();
  const base = k ? Buffer.concat([k, Buffer.from(valor, "utf8")]) : Buffer.from(valor, "utf8");
  return createHash("sha256").update(base).digest("hex");
}

/** Compara dos huellas en tiempo constante. */
export function mismaHuella(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** ¿Hay clave configurada? Lo usan las pantallas para avisar si falta. */
export function cifradoDisponible(): boolean {
  return Boolean(env.FIELD_ENCRYPTION_KEY);
}
