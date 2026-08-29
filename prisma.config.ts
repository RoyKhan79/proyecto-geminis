import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee la URL desde el esquema: la conexión se define aquí.
// Cargamos .env para que `prisma migrate`/`db seed` funcionen sin envolturas.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En CI/producción las variables vienen del entorno, no de un fichero.
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  datasource: {
    // Las migraciones y las semillas necesitan al DUEÑO de las tablas: la
    // aplicación se conecta con un rol restringido que no puede alterar la
    // estructura, y eso es a propósito.
    url: (process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL) as string,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
