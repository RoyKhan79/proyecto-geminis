import path from "node:path";
import { explicarRechazo, motivosParaNoEjecutar } from "./base-de-pruebas";

/**
 * ARRANQUE DE LAS PRUEBAS · Y LA PUERTA QUE LAS SEPARA DE PRODUCCIÓN
 *
 * Las pruebas se ejecutan contra la base de datos de desarrollo local.
 * Arráncala antes con `npm run db:start`.
 *
 * ── POR QUÉ ESTE ARCHIVO HACE MÁS QUE CARGAR EL .env ────────────────────────
 *
 * Estas pruebas escriben. Crean academias, dan de alta usuarios y, al terminar,
 * ejecutan cosas como:
 *
 *     await prismaBase.academy.deleteMany({ where: { id: { in: [...] } } })
 *     await prismaBase.user.deleteMany({ where: { email: { endsWith: ... } } })
 *
 * Y el borrado de una academia va en cascada sobre todo lo que cuelga de ella.
 *
 * Antes, lo único que decidía sobre qué base se ejecutaba todo eso era el valor
 * de `DATABASE_URL` en el momento de escribir `npm test`. Basta una terminal en
 * la que se exportó la cadena de producción para depurar algo, un `.env` copiado
 * de un servidor, o un despliegue que ejecute las pruebas como paso previo, para
 * que la suite entera se lance contra datos reales. No hace falta mala fe: hace
 * falta un despiste, y los despistes ocurren.
 *
 * La comprobación en sí vive en `base-de-pruebas.ts`, porque este archivo se
 * ejecuta antes que ninguna prueba y por tanto no se puede probar desde dentro.
 * Allí es una función normal y tiene sus propias pruebas.
 *
 * Se lanza aquí, al cargar, así que **ninguna prueba llega a ejecutarse**: no
 * hay ventana entre la comprobación y el primer `deleteMany`.
 */

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En CI las variables vienen del entorno.
}

const motivos = motivosParaNoEjecutar(process.env.DATABASE_URL, {
  NODE_ENV: process.env.NODE_ENV,
  CATEDRIA_BASE_DE_PRUEBAS: process.env.CATEDRIA_BASE_DE_PRUEBAS,
});

if (motivos.length > 0) {
  throw new Error(explicarRechazo(process.env.DATABASE_URL ?? "", motivos));
}
