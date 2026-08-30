import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // La referencia del código que genera TypeDoc: HTML y JavaScript ya
    // empaquetado que nadie ha escrito. Se rehace con `npm run docs`.
    "docs/api/**",
    // El manual en un solo archivo, que genera `npm run manual:local`.
    "Manual de Geminis.html",
    // Lo que genera Prisma a partir del esquema.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
