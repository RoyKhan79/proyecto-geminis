/**
 * ¿ESTÁ ESTO LISTO PARA PRODUCCIÓN?
 *
 *   npm run desplegar:comprobar
 *
 * El cifrado del disco y las copias programadas no se resuelven con código: se
 * configuran al desplegar. Lo que sí puede hacer el código es **negarse a dar
 * por bueno un despliegue** al que le falte algo, y decir exactamente qué.
 *
 * Es la diferencia entre una lista de buenas intenciones en un documento y una
 * comprobación que falla. Se ejecuta antes de poner el sistema en marcha con
 * datos reales, y también desde el arranque si se quiere.
 */
import { existsSync } from "node:fs";
import { prismaBase } from "@/lib/db/client";
import { env, isProduction } from "@/lib/env";

type Nivel = "obligatorio" | "recomendado";

type Punto = {
  nivel: Nivel;
  titulo: string;
  cumple: boolean;
  detalle: string;
  comoSeArregla?: string;
  /**
   * La comprobación no se ha hecho de verdad: solo tiene sentido en producción
   * y esto se está ejecutando en otro sitio.
   *
   * Hace falta porque tres puntos llevaban un `|| !isProduction` y por tanto
   * salían con un ✓ al lado de un detalle que decía lo contrario. El informe
   * llegó a leerse así:
   *
   *     ✓ La dirección pública usa HTTPS
   *         http://localhost:3000
   *     ✓ Sin datos de demostración
   *         24 cuentas de demostración con contraseña conocida
   *
   * Es una contradicción, y de las peligrosas: quien lo lea por encima ve dos
   * marcas verdes. La intención era buena —no exigir HTTPS en un portátil— pero
   * el resultado es que el script que decide si un despliegue es apto da luz
   * verde justo cuando NO se está ejecutando contra el despliegue.
   *
   * Ahora esos puntos salen con `~` y el resumen avisa de que el veredicto no
   * vale hasta pasarlo en el servidor de verdad.
   */
  sinComprobar?: boolean;
};

const puntos: Punto[] = [];

function comprobar(p: Punto) {
  puntos.push(p);
}

async function main() {
  console.log(`\nCOMPROBACIÓN DE DESPLIEGUE\n${"=".repeat(70)}`);
  console.log(`  Entorno: ${env.NODE_ENV}\n`);

  // ── Secretos y claves ──────────────────────────────────────────────────────
  comprobar({
    nivel: "obligatorio",
    titulo: "Clave de cifrado de campos",
    cumple: Boolean(env.FIELD_ENCRYPTION_KEY),
    detalle: env.FIELD_ENCRYPTION_KEY
      ? "configurada"
      : "sin configurar: los números de cuenta se guardarían en claro",
    comoSeArregla: 'openssl rand -base64 48  →  FIELD_ENCRYPTION_KEY="…"',
  });

  const claveDebil =
    Boolean(env.FIELD_ENCRYPTION_KEY) && env.FIELD_ENCRYPTION_KEY!.length < 48;
  comprobar({
    nivel: "recomendado",
    titulo: "La clave de cifrado es suficientemente larga",
    cumple: !claveDebil,
    detalle: claveDebil
      ? `${env.FIELD_ENCRYPTION_KEY!.length} caracteres: corta para lo que protege`
      : "de longitud adecuada",
  });

  // ── Aislamiento ────────────────────────────────────────────────────────────
  comprobar({
    nivel: "obligatorio",
    titulo: "Segunda barrera de aislamiento activada",
    cumple: env.DB_RLS === "on",
    detalle:
      env.DB_RLS === "on"
        ? "DB_RLS=on"
        : "DB_RLS=off: el aislamiento entre academias queda en una sola barrera",
  });

  const rol = await prismaBase.$queryRaw<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  const seSalta = rol[0]?.rolsuper || rol[0]?.rolbypassrls;

  comprobar({
    nivel: "obligatorio",
    titulo: "La aplicación NO se conecta con un rol privilegiado",
    cumple: !seSalta,
    detalle: seSalta
      ? `«${rol[0]?.rolname}» se salta las políticas: la segunda barrera no protege nada`
      : `«${rol[0]?.rolname}», sin superusuario ni BYPASSRLS`,
    comoSeArregla:
      "DATABASE_URL debe apuntar a geminis_app, no al dueño de las tablas",
  });

  const politicas = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = current_schema()`;
  comprobar({
    nivel: "obligatorio",
    titulo: "Las políticas de la base están creadas",
    cumple: (politicas[0]?.n ?? 0) >= 50,
    detalle: `${politicas[0]?.n ?? 0} políticas`,
    comoSeArregla: "npm run db:deploy",
  });

  comprobar({
    nivel: "recomendado",
    titulo: "Conexión a la base de datos cifrada",
    cumple: /sslmode=(require|verify-ca|verify-full)/.test(env.DATABASE_URL),
    sinComprobar: !isProduction,
    detalle: /sslmode=/.test(env.DATABASE_URL)
      ? "sslmode indicado en la conexión"
      : "sin sslmode: en producción la conexión debería ir cifrada",
    comoSeArregla: "Añade ?sslmode=require a DATABASE_URL",
  });

  // ── Cifrado en reposo · lo que NO puede hacer el código ────────────────────
  //
  // Se comprueba lo que se puede comprobar desde aquí: si el gestor dice tener
  // cifrado de datos. Con PostgreSQL gestionado (RDS, Cloud SQL, Supabase,
  // Neon…) viene activado; en una máquina propia hay que cifrar el volumen.
  let cifradoDisco = "no se puede determinar desde aquí";
  try {
    const extensiones = await prismaBase.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`;
    cifradoDisco =
      extensiones.length > 0
        ? "pgcrypto disponible en la base"
        : "no se puede determinar desde aquí";
  } catch {
    /* da igual: es informativo */
  }

  comprobar({
    nivel: "obligatorio",
    titulo: "Cifrado del disco donde vive la base de datos",
    // No se puede comprobar desde la aplicación. Se marca como no cumplido a
    // propósito: obliga a confirmarlo a mano en lugar de darlo por hecho.
    cumple: process.env.DISK_ENCRYPTION_CONFIRMED === "1",
    detalle:
      process.env.DISK_ENCRYPTION_CONFIRMED === "1"
        ? "confirmado por quien despliega"
        : `sin confirmar · ${cifradoDisco}`,
    comoSeArregla:
      "Actívalo en tu proveedor (RDS/Cloud SQL/Supabase lo traen) o cifra el volumen (LUKS, FileVault, BitLocker). Después: DISK_ENCRYPTION_CONFIRMED=1",
  });

  comprobar({
    nivel: "obligatorio",
    titulo: "Cifrado del almacén de archivos (los PDF del temario)",
    cumple: process.env.STORAGE_ENCRYPTION_CONFIRMED === "1",
    detalle:
      process.env.STORAGE_ENCRYPTION_CONFIRMED === "1"
        ? "confirmado por quien despliega"
        : "sin confirmar",
    comoSeArregla:
      "En S3, activa SSE-S3 o SSE-KMS en el bucket. Después: STORAGE_ENCRYPTION_CONFIRMED=1",
  });

  // ── Copias de seguridad ────────────────────────────────────────────────────
  const carpetaCopias = process.env.BACKUP_DIR ?? ".dev/copias";
  comprobar({
    nivel: "obligatorio",
    titulo: "Copias de seguridad programadas",
    cumple: process.env.BACKUP_CRON_CONFIRMED === "1",
    detalle:
      process.env.BACKUP_CRON_CONFIRMED === "1"
        ? "confirmado por quien despliega"
        : `sin confirmar · carpeta: ${carpetaCopias}${existsSync(carpetaCopias) ? " (existe)" : " (no existe)"}`,
    comoSeArregla:
      "Copia despliegue/catedria.cron al cron del servidor (ver despliegue/README.md). Después: BACKUP_CRON_CONFIRMED=1",
  });

  comprobar({
    nivel: "obligatorio",
    titulo: "Restauración probada al menos una vez",
    cumple: process.env.RESTORE_TESTED_CONFIRMED === "1",
    detalle:
      process.env.RESTORE_TESTED_CONFIRMED === "1"
        ? "confirmado por quien despliega"
        : "sin confirmar: una copia que no se ha restaurado nunca no es una copia",
    comoSeArregla:
      "npm run copia:probar -- <archivo>  (la restaura de verdad en una base desechable). Después: RESTORE_TESTED_CONFIRMED=1",
  });

  // ── Tareas programadas ─────────────────────────────────────────────────────
  const radar = await prismaBase.radarRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const radarReciente =
    radar !== null && Date.now() - radar.startedAt.getTime() < 36 * 60 * 60 * 1000;

  comprobar({
    nivel: "recomendado",
    titulo: "El radar del BOE se está ejecutando",
    cumple: radarReciente,
    detalle: radar
      ? `última vez: ${radar.startedAt.toLocaleString("es-ES")}`
      : "no se ha ejecutado nunca",
    comoSeArregla: "Está en despliegue/catedria.cron: 30 8 * * * npm run radar",
  });

  comprobar({
    nivel: "recomendado",
    titulo: "El mantenimiento diario está programado",
    cumple: process.env.MAINTENANCE_CRON_CONFIRMED === "1",
    detalle:
      process.env.MAINTENANCE_CRON_CONFIRMED === "1"
        ? "confirmado"
        : "sin confirmar: se acumulan sesiones y enlaces caducados",
    comoSeArregla: "Está en despliegue/catedria.cron: 0 4 * * * npm run mantenimiento",
  });

  // ── Correo y direcciones ───────────────────────────────────────────────────
  comprobar({
    nivel: "obligatorio",
    titulo: "Correo saliente configurado",
    cumple: Boolean(env.SMTP_HOST && env.SMTP_USER),
    detalle: env.SMTP_HOST
      ? `${env.SMTP_HOST}`
      : "sin SMTP: nadie puede recuperar su contraseña",
  });

  comprobar({
    nivel: "obligatorio",
    titulo: "La dirección pública usa HTTPS",
    cumple: env.APP_URL.startsWith("https://"),
    sinComprobar: !isProduction,
    detalle: env.APP_URL,
    comoSeArregla: "APP_URL=https://…  · sin HTTPS, la cookie de sesión viaja en claro",
  });

  // ── Datos de demostración ──────────────────────────────────────────────────
  const demo = await prismaBase.academy.count({ where: { slug: "catedria-demo" } });
  const cuentasDemo = await prismaBase.user.count({
    where: { email: { endsWith: "@academiademo.test" } },
  });

  comprobar({
    nivel: "obligatorio",
    titulo: "Sin datos de demostración",
    cumple: demo === 0 && cuentasDemo === 0,
    sinComprobar: !isProduction,
    detalle:
      demo > 0 || cuentasDemo > 0
        ? `${cuentasDemo} cuentas de demostración con contraseña conocida`
        : "ninguno",
    comoSeArregla: "Borra la academia demo antes de abrir al público",
  });

  const sinCifrar = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM billing_profiles
    WHERE iban IS NOT NULL AND iban NOT LIKE 'v1:%'`;
  comprobar({
    nivel: "obligatorio",
    titulo: "Ningún dato bancario en claro",
    cumple: (sinCifrar[0]?.n ?? 0) === 0,
    detalle: `${sinCifrar[0]?.n ?? 0} sin cifrar`,
    comoSeArregla: "npm run cifrar:migrar",
  });

  // ── Informe ────────────────────────────────────────────────────────────────
  const obligatorios = puntos.filter((p) => p.nivel === "obligatorio");
  const recomendados = puntos.filter((p) => p.nivel === "recomendado");
  // Los que faltan de verdad, y aparte los que no se han podido mirar desde
  // aquí. Meterlos en el mismo saco sería volver al problema de antes por el
  // otro lado: un despliegue local no puede fallar por no tener HTTPS.
  const faltan = obligatorios.filter((p) => !p.cumple && !p.sinComprobar);
  const pendientes = puntos.filter((p) => p.sinComprobar);

  for (const grupo of [
    { titulo: "OBLIGATORIO", lista: obligatorios },
    { titulo: "RECOMENDADO", lista: recomendados },
  ]) {
    console.log(`\n${grupo.titulo}`);
    for (const p of grupo.lista) {
      // `~` cuando no se ha comprobado de verdad. Ni ✓ ni ✗: las dos marcas
      // afirmarían algo que este entorno no puede saber.
      const marca = p.sinComprobar ? "~" : p.cumple ? "✓" : "✗";
      console.log(`  ${marca} ${p.titulo}`);
      console.log(
        `      ${p.detalle}${p.sinComprobar ? " · solo se comprueba en producción" : ""}`,
      );
      if (!p.cumple && !p.sinComprobar && p.comoSeArregla) {
        console.log(`      → ${p.comoSeArregla}`);
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`);

  if (faltan.length > 0) {
    console.log(
      `✗ Faltan ${faltan.length} de ${obligatorios.length} requisitos obligatorios.`,
    );
    console.log("  NO pongas datos reales de alumnos hasta resolverlos.\n");
    process.exit(1);
  }

  /*
   * Y aquí va lo que hace honesto a este script.
   *
   * Si se ha pasado fuera de producción, hay comprobaciones que no se han hecho
   * —HTTPS, datos de demostración, cifrado de la conexión— y decir «listo para
   * producción» sería justo lo contrario de lo que este archivo existe para
   * hacer. Se dice lo que se ha comprobado y lo que no, y no se da el visto
   * bueno hasta pasarlo donde toca.
   */
  if (pendientes.length > 0) {
    console.log(
      `~ ${obligatorios.length - faltan.length} de ${obligatorios.length} requisitos comprobados, ` +
        `pero ${pendientes.length} solo se pueden mirar en producción:`,
    );
    for (const p of pendientes) console.log(`    · ${p.titulo}`);
    console.log("");
    console.log(`  Este entorno es ${env.NODE_ENV}, así que esto NO es un visto bueno.`);
    console.log("  Vuelve a pasarlo en el servidor, con NODE_ENV=production.\n");
    return;
  }

  console.log("✓ Listo para producción.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
