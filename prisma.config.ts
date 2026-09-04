import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee la URL desde el esquema: la conexión se define aquí.
// Cargamos .env para que `prisma migrate`/`db seed` funcionen sin envolturas.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En CI/producción las variables vienen del entorno, no de un fichero.
}

/**
 * La conexión con la que Prisma migra y siembra.
 *
 * Tiene que ser la del DUEÑO de las tablas. La aplicación se conecta con un rol
 * restringido —`catedria_app`, sin BYPASSRLS y sin poder tocar la estructura— y
 * eso no es una precaución sino la mitad del modelo de aislamiento: si el
 * servidor web se conectara con el dueño, PostgreSQL se saltaría las políticas
 * de Row Level Security y la segunda barrera dejaría de existir. Está contado
 * en la migración `rol_de_aplicacion_sin_bypass`, que existe justo porque eso
 * llegó a pasar.
 *
 * Antes había aquí un `DATABASE_URL_OWNER ?? DATABASE_URL`, y ese respaldo
 * silencioso deshacía la separación en el peor momento posible: en un entorno
 * donde faltara la variable, las migraciones se aplicarían con el rol de la
 * aplicación y fallarían con un error de permisos difícil de interpretar; y si
 * ese entorno tuviera —por lo que fuera— un `DATABASE_URL` con privilegios,
 * todo funcionaría sin que nadie se enterara de que la separación no existe.
 *
 * Así que si falta, se dice. En desarrollo se admite el respaldo porque
 * `scripts/dev-db.sh` levanta una base donde los dos roles son el mismo y
 * exigirlo solo daría trabajo sin ganar nada.
 */
function urlDeMigraciones(): string {
  const owner = process.env.DATABASE_URL_OWNER;
  if (owner) return owner;

  const esProduccion = process.env.NODE_ENV === "production";
  if (!esProduccion && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error(
    [
      "Falta DATABASE_URL_OWNER.",
      "",
      "  Las migraciones y las semillas necesitan el rol DUEÑO de las tablas.",
      "  La aplicación usa DATABASE_URL, que es un rol restringido sin permiso",
      "  para cambiar la estructura y sobre el que SÍ actúan las políticas de",
      "  Row Level Security.",
      "",
      "  Usar DATABASE_URL aquí no es un atajo: o falla con un error de permisos,",
      "  o funciona porque ese rol tiene de más, y entonces el aislamiento que",
      "  documenta docs/SECURITY_MODEL.md no es el que hay.",
    ].join("\n"),
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  datasource: {
    url: urlDeMigraciones(),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
