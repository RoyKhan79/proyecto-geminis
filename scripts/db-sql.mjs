#!/usr/bin/env node
/**
 * Catedria · cliente SQL mínimo para desarrollo.
 *
 * Los binarios de PostgreSQL que usamos en local (@embedded-postgres) incluyen
 * el servidor pero no `psql`/`createdb`, así que hacemos el equivalente con el
 * driver `pg`. Solo para desarrollo: en producción se usa un PostgreSQL real.
 *
 *   node scripts/db-sql.mjs ensure-db          → crea la base de datos si no existe
 *   node scripts/db-sql.mjs ensure-app-role    → crea el rol de la app y le fija la contraseña
 *   node scripts/db-sql.mjs query "SELECT 1"   → ejecuta SQL contra la BD de la app
 */
import pg from "pg";

const PORT = Number(process.env.GEMINIS_DB_PORT ?? 55432);
const BASE = { host: "127.0.0.1", port: PORT, user: "geminis", password: "geminis" };
const DB_NAME = "geminis";

/*
 * El rol con el que entra la aplicación, que no es el dueño de las tablas: va
 * sin BYPASSRLS a propósito, para que el aislamiento por academia se pruebe en
 * desarrollo igual que en producción.
 *
 * La migración que lo crea no le pone contraseña —en una migración no se
 * escriben secretos— y deja dicho que en desarrollo la ponga `dev-db.sh`. Esto
 * es esa parte. La contraseña de local es la que ya está en `.env.example`; en
 * producción la pone quien despliega y esto no se ejecuta nunca.
 */
const APP_ROLE = "geminis_app";
const APP_PASSWORD = process.env.GEMINIS_APP_PASSWORD ?? "geminis_app";

async function withClient(database, fn) {
  const client = new pg.Client({ ...BASE, database });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const [, , command, ...rest] = process.argv;

try {
  if (command === "ensure-db") {
    await withClient("postgres", async (client) => {
      const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
      if (rowCount === 0) {
        await client.query(`CREATE DATABASE "${DB_NAME}"`);
        console.log(`✓ Base de datos '${DB_NAME}' creada`);
      } else {
        console.log(`✓ Base de datos '${DB_NAME}' ya existía`);
      }
    });
  } else if (command === "ensure-app-role") {
    await withClient(DB_NAME, async (client) => {
      // La contraseña no se puede pasar como parámetro en CREATE/ALTER ROLE:
      // hay que interpolarla, así que se escapa con el propio driver.
      const pass = client.escapeLiteral(APP_PASSWORD);
      const { rowCount } = await client.query(
        "SELECT 1 FROM pg_roles WHERE rolname = $1",
        [APP_ROLE],
      );
      if (rowCount === 0) {
        await client.query(
          `CREATE ROLE "${APP_ROLE}" WITH LOGIN NOSUPERUSER NOCREATEDB` +
            ` NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD ${pass}`,
        );
        console.log(`✓ Rol '${APP_ROLE}' creado`);
      } else {
        // Que exista no quiere decir que se pueda entrar con él: un cluster
        // creado antes de que esto existiera tiene el rol sin contraseña.
        await client.query(`ALTER ROLE "${APP_ROLE}" WITH LOGIN PASSWORD ${pass}`);
        console.log(`✓ Rol '${APP_ROLE}' ya existía · contraseña al día`);
      }
    });
  } else if (command === "query") {
    const sql = rest.join(" ");
    if (!sql.trim()) throw new Error("Falta la sentencia SQL");
    await withClient(DB_NAME, async (client) => {
      const result = await client.query(sql);
      if (Array.isArray(result)) {
        result.forEach((r) => r.rows?.length && console.table(r.rows));
      } else if (result.rows?.length) {
        console.table(result.rows);
      } else {
        console.log(`✓ OK (${result.rowCount ?? 0} filas afectadas)`);
      }
    });
  } else {
    console.error("Uso: node scripts/db-sql.mjs [ensure-db|ensure-app-role|query <SQL>]");
    process.exit(1);
  }
} catch (error) {
  console.error("✗", error.message);
  process.exit(1);
}
