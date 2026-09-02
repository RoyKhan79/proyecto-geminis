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
 * datos: los números de cuenta del alumnado, el IBAN de cobro de cada academia
 * y la clave de comercio de su TPV.
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
 *     arranca igual en desarrollo, pero los campos cifrados no se pueden leer y
 *     se dice; en producción, `env.ts` no deja arrancar.
 *
 * Formato guardado: `v1:base64(iv):base64(etiqueta):base64(cifrado)`.
 *
 * ── ROTAR LA CLAVE ──────────────────────────────────────────────────────────
 *
 * Una clave se rota cuando se sospecha que ha podido verse: un `.env` que se
 * compartió por un canal que no tocaba, una copia de seguridad que salió del
 * sitio, alguien que dejó el equipo. Antes eso no se podía hacer: la
 * documentación mencionaba un `npm run cifrar:rotar` que no existía, y cambiar
 * la clave a secas dejaba TODOS los IBAN ilegibles para siempre, porque el
 * descifrado usaba una sola clave y devolvía `null` en cuanto no cuadraba. Una
 * clave que no se puede rotar es una clave que, comprometida, se queda.
 *
 * Ahora se descifra probando dos claves, en este orden:
 *
 *   1. `FIELD_ENCRYPTION_KEY`, la actual,
 *   2. `FIELD_ENCRYPTION_KEY_ANTERIOR`, si está puesta.
 *
 * Y se cifra SIEMPRE con la actual. Así una rotación es:
 *
 *   · mover la clave vieja a `FIELD_ENCRYPTION_KEY_ANTERIOR`,
 *   · poner la nueva en `FIELD_ENCRYPTION_KEY`,
 *   · desplegar —todo se sigue leyendo, lo nuevo ya se guarda con la nueva—,
 *   · pasar `npm run cifrar:rotar`, que reescribe lo que quedaba,
 *   · quitar `FIELD_ENCRYPTION_KEY_ANTERIOR`.
 *
 * Sin parada y sin un momento en el que algo esté ilegible.
 *
 * Probar dos claves no abre nada: GCM autentica, así que una clave que no es la
 * que cifró ese valor falla, no devuelve un texto distinto. El coste es un
 * descifrado fallido por valor mientras dure la migración.
 */

const VERSION = "v1";
const ALGORITMO = "aes-256-gcm";
/// 96 bits es el tamaño recomendado para GCM.
const LONGITUD_IV = 12;
/// Longitud mínima del secreto del entorno. No es la de la clave: esa la fija
/// SHA-256 en 32 bytes exactos.
const MINIMO_SECRETO = 32;

let avisoDado = false;

/**
 * Deriva la clave de 32 bytes a partir del secreto del entorno.
 *
 * Se pasa por SHA-256 para admitir un secreto de cualquier longitud sin obligar
 * a quien despliega a generar exactamente 32 bytes.
 *
 * @param secreto El valor de la variable de entorno.
 * @returns La clave, o `null` si no hay secreto.
 * @throws {Error} Si el secreto existe pero es demasiado corto. Se prefiere
 *   fallar a derivar una clave de algo que no tiene entropía suficiente.
 */
function derivar(secreto: string | undefined, cual: string): Buffer | null {
  if (!secreto) return null;

  if (secreto.length < MINIMO_SECRETO) {
    throw new Error(
      `${cual} es demasiado corta. Usa al menos ${MINIMO_SECRETO} caracteres: \`openssl rand -base64 48\`.`,
    );
  }

  return createHash("sha256").update(secreto).digest();
}

/**
 * La clave con la que se CIFRA. Siempre la actual, nunca la anterior.
 */
function claveActual(): Buffer | null {
  const clave = derivar(env.FIELD_ENCRYPTION_KEY, "FIELD_ENCRYPTION_KEY");

  if (!clave) {
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
  }

  return clave;
}

/**
 * Todas las claves con las que se puede intentar DESCIFRAR, en orden.
 *
 * La actual primero, porque es con la que está cifrado casi todo y así el caso
 * normal cuesta un solo intento.
 */
function clavesDeLectura(): Buffer[] {
  const claves: Buffer[] = [];

  const actual = claveActual();
  if (actual) claves.push(actual);

  const anterior = derivar(
    env.FIELD_ENCRYPTION_KEY_ANTERIOR,
    "FIELD_ENCRYPTION_KEY_ANTERIOR",
  );
  if (anterior) claves.push(anterior);

  return claves;
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
 * En producción, `claveActual()` lanza antes de llegar aquí.
 *
 * @param valor El texto en claro. Una cadena vacía se devuelve tal cual: no hay
 *   nada que proteger y así `cifrar(x) || null` sigue funcionando.
 * @returns `v1:iv:etiqueta:cifrado`, en base64 y separado por dos puntos.
 */
export function cifrar(valor: string): string {
  if (!valor) return valor;

  const k = claveActual();
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
 * Descifra un valor, probando la clave actual y después la anterior.
 *
 * @param valor Lo guardado en la base, o nada.
 * @returns El texto en claro, o `null` si no se puede leer con ninguna de las
 *   claves configuradas. No se devuelve una cadena vacía ni se lanza: quien
 *   llama tiene que poder distinguir «no hay IBAN» de «el IBAN no se puede
 *   leer», porque lo segundo es un incidente y lo primero es un martes.
 */
export function descifrar(valor: string | null): string | null {
  if (!valor) return null;

  // Valor antiguo, guardado antes de que existiera el cifrado.
  if (!estaCifrado(valor)) return valor;

  const [, ivB64, etiquetaB64, cifradoB64] = valor.split(":");
  if (!ivB64 || !etiquetaB64 || !cifradoB64) return null;

  const iv = Buffer.from(ivB64, "base64");
  const etiqueta = Buffer.from(etiquetaB64, "base64");
  const datos = Buffer.from(cifradoB64, "base64");

  for (const k of clavesDeLectura()) {
    try {
      const decipher = createDecipheriv(ALGORITMO, k, iv);
      decipher.setAuthTag(etiqueta);
      return Buffer.concat([decipher.update(datos), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      // Etiqueta de autenticación incorrecta: esta clave no es. Se prueba la
      // siguiente. Si no queda ninguna, o la fila está manipulada o se ha
      // rotado la clave sin conservar la anterior.
      continue;
    }
  }

  return null;
}

/**
 * ¿Con qué clave está cifrado este valor?
 *
 * Lo usa la rotación para saber qué falta por migrar sin tener que reescribirlo
 * todo a ciegas cada vez.
 *
 * @param valor Lo guardado en la base.
 * @returns `"actual"`, `"anterior"`, `"claro"` si nunca se cifró, o
 *   `"ilegible"` si no lo abre ninguna clave configurada.
 */
export function claveDe(
  valor: string | null,
): "actual" | "anterior" | "claro" | "ilegible" {
  if (!valor) return "claro";
  if (!estaCifrado(valor)) return "claro";

  const [, ivB64, etiquetaB64, cifradoB64] = valor.split(":");
  if (!ivB64 || !etiquetaB64 || !cifradoB64) return "ilegible";

  const claves = clavesDeLectura();
  const nombres = ["actual", "anterior"] as const;

  for (let i = 0; i < claves.length; i++) {
    try {
      const decipher = createDecipheriv(
        ALGORITMO,
        claves[i],
        Buffer.from(ivB64, "base64"),
      );
      decipher.setAuthTag(Buffer.from(etiquetaB64, "base64"));
      decipher.update(Buffer.from(cifradoB64, "base64"));
      decipher.final();
      return nombres[i] ?? "actual";
    } catch {
      continue;
    }
  }

  return "ilegible";
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
 *
 * @remarks Se calcula SIEMPRE con la clave actual. Es una limitación conocida y
 *   conviene tenerla escrita: si algún día se guardan huellas en la base, una
 *   rotación de clave las invalida todas y hay que recalcularlas en la misma
 *   pasada. Hoy no se guarda ninguna, así que no hay nada que migrar.
 */
export function huella(valor: string): string {
  const k = claveActual();
  const base = k
    ? Buffer.concat([k, Buffer.from(valor, "utf8")])
    : Buffer.from(valor, "utf8");
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

/** ¿Hay una rotación a medias? Lo usa la comprobación de despliegue. */
export function rotacionEnCurso(): boolean {
  return Boolean(env.FIELD_ENCRYPTION_KEY_ANTERIOR);
}
