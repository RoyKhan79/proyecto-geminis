import { z } from "zod";

/**
 * El AUTH_SECRET que vale mientras se programa y que no puede llegar a un
 * servidor. Está escrito en el repositorio, así que en producción es un
 * secreto público; `exigirConfiguracionDeProduccion` no deja arrancar con él.
 */
const AUTH_SECRET_DE_DESARROLLO = "desarrollo-inseguro-cambiar-en-produccion-0000";

/**
 * Variables de entorno validadas.
 *
 * Si falta algo, la aplicación falla al arrancar con un mensaje claro en lugar
 * de romperse a mitad de una petición con un `undefined`.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),

  /// Conexión con el DUEÑO de las tablas. Solo la usan migraciones y semillas.
  /// La aplicación NUNCA debe usarla: con el rol dueño, PostgreSQL se salta las
  /// políticas de Row Level Security y la segunda barrera deja de existir.
  DATABASE_URL_OWNER: z.string().optional(),

  /// Secreto para firmar/derivar valores de sesión. Mínimo 32 caracteres.
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET debe tener al menos 32 caracteres")
    // El valor por defecto solo sirve en desarrollo: en producción se rechaza
    // más abajo, en `exigirConfiguracionDeProduccion`.
    .default(AUTH_SECRET_DE_DESARROLLO),

  /// Duración de la sesión en días.
  SESSION_DAYS: z.coerce.number().int().positive().default(30),

  /// Almacenamiento de archivos: local (disco) o s3 (S3-compatible).
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".dev/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  /// Proveedor de IA por defecto. La aplicación nunca llama a un SDK
  /// directamente: todo pasa por el Gateway de IA (docs/AI_ARCHITECTURE.md).
  AI_PROVIDER: z.enum(["anthropic", "openai", "none"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  /// Correo saliente. Sin configurar, en desarrollo se escribe en .dev/emails/.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  APP_URL: z.string().default("http://localhost:3000"),

  /// Clave para cifrar los campos sensibles en la base de datos: hoy, los
  /// números de cuenta del alumnado. Genérala con `openssl rand -base64 48`.
  ///
  /// En producción es obligatoria. Sin ella, un volcado de la base de datos
  /// enseñaría los IBAN de media academia en claro.
  ///
  /// Se puede rotar sin dejar nada ilegible: ver FIELD_ENCRYPTION_KEY_ANTERIOR
  /// y `npm run cifrar:rotar`.
  FIELD_ENCRYPTION_KEY: z.string().optional(),

  /// La clave ANTERIOR, solo mientras dura una rotación.
  ///
  /// Se descifra probando primero la actual y después esta; se cifra siempre
  /// con la actual. Así se puede cambiar la clave sin parar el servicio y sin
  /// que nada quede ilegible: se despliega con las dos, se pasa
  /// `npm run cifrar:rotar` para reescribir lo que quedaba, y después se quita
  /// esta variable.
  ///
  /// Dejarla puesta para siempre no rompe nada, pero mantiene viva una clave
  /// que a lo mejor se rotó justamente porque se había visto. La comprobación
  /// de despliegue avisa si sigue ahí.
  FIELD_ENCRYPTION_KEY_ANTERIOR: z.string().optional(),

  /// Segunda barrera de aislamiento: Row Level Security de PostgreSQL.
  ///
  /// Con `on`, cada consulta de una academia se envuelve en una transacción que
  /// fija `geminis.academy_id`, y la base de datos comprueba la academia por su
  /// cuenta además de la guardia de aplicación. Cuesta unos milisegundos por
  /// consulta y se explica en docs/SECURITY_MODEL.md.
  ///
  /// Se puede apagar para medir el coste o para depurar, pero en producción va
  /// encendida: es lo que protege de un fallo futuro en la guardia.
  DB_RLS: z.enum(["on", "off"]).default("on"),
});

/**
 * Lo que en desarrollo es cómodo y en producción es un agujero.
 *
 * Varias variables tienen un valor por defecto para que el proyecto arranque
 * recién clonado sin ceremonia. Eso está bien en un portátil y está mal en un
 * servidor: un `AUTH_SECRET` por defecto es un secreto publicado, y la única
 * diferencia entre las dos situaciones es una variable de entorno que nadie
 * comprueba.
 *
 * Se comprueba aquí, al arrancar, y el servidor no levanta si falta algo. Es a
 * propósito: más vale un despliegue que no arranca y dice por qué, que uno que
 * arranca y funciona con las claves de ejemplo.
 */
function exigirConfiguracionDeProduccion(valores: z.infer<typeof schema>): void {
  if (valores.NODE_ENV !== "production") return;

  // Compilar no es desplegar. `next build` fija NODE_ENV=production y recorre
  // las rutas para analizarlas, así que sin esta salida el proyecto no se
  // podría compilar en un portátil ni en un paso de integración continua que
  // no tenga —ni deba tener— las claves reales. Los secretos hacen falta
  // cuando el servidor atiende peticiones, y ahí es donde se comprueban.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const fallos: string[] = [];

  if (valores.AUTH_SECRET === AUTH_SECRET_DE_DESARROLLO) {
    fallos.push(
      "AUTH_SECRET sigue siendo el de desarrollo, que está escrito en el " +
        "repositorio. Genera uno con `openssl rand -base64 48`.",
    );
  }
  if (!valores.FIELD_ENCRYPTION_KEY) {
    fallos.push(
      "FIELD_ENCRYPTION_KEY no está puesta. Sin ella, los números de cuenta " +
        "del alumnado se guardarían en claro.",
    );
  }
  if (valores.DB_RLS !== "on") {
    fallos.push(
      "DB_RLS está apagada. Es la segunda barrera de aislamiento entre " +
        "academias y solo se apaga para medir o depurar en local.",
    );
  }
  if (valores.APP_URL.startsWith("http://")) {
    fallos.push(
      "APP_URL va por HTTP. Los enlaces de recuperación de contraseña salen " +
        "de ahí, y la cookie de sesión es `secure`: por HTTP no llegaría.",
    );
  }

  if (fallos.length === 0) return;

  throw new Error(
    [
      "",
      "Configuración insegura para producción:",
      "",
      ...fallos.map((f) => `  · ${f}`),
      "",
      "El servidor no arranca así.",
    ].join("\n"),
  );
}

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuración de entorno inválida:\n${detalle}`);
}

/**
 * La configuración del entorno, ya validada.
 *
 * Se comprueba al arrancar y **no al usarla**: una variable mal puesta tiene
 * que hacer que el servidor no levante, no que falle la remesa del día 1 a las
 * ocho de la mañana.
 */
export const env = parsed.data;

exigirConfiguracionDeProduccion(env);

/** En producción se aprietan cosas: cookies `secure`, sin trazas en pantalla. */
export const isProduction = env.NODE_ENV === "production";
/** En desarrollo se aflojan otras, como servir por HTTP sin cookie `secure`. */
export const isDevelopment = env.NODE_ENV === "development";
