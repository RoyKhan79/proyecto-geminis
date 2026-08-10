import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Las pruebas de aislamiento comparten la base de datos de desarrollo:
    // en paralelo se pisarían entre ellas.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
