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

  APP_URL: z.string().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuración de entorno inválida:\n${detalle}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
