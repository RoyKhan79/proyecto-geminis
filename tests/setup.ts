import path from "node:path";

// Las pruebas se ejecutan contra la base de datos de desarrollo local.
// Arráncala antes con `npm run db:start`.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En CI las variables vienen del entorno.
}
