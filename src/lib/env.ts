import { z } from "zod";

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
    .default("desarrollo-inseguro-cambiar-en-produccion-0000"),

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
  /// OJO al rotarla: los valores cifrados con la clave anterior dejan de poder
  /// leerse. Ver `npm run cifrar:rotar`.
  FIELD_ENCRYPTION_KEY: z.string().optional(),

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

/** En producción se aprietan cosas: cookies `secure`, sin trazas en pantalla. */
export const isProduction = env.NODE_ENV === "production";
/** En desarrollo se aflojan otras, como servir por HTTP sin cookie `secure`. */
export const isDevelopment = env.NODE_ENV === "development";
