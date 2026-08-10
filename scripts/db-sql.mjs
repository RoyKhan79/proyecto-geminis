#!/usr/bin/env node
/**
 * Geminis · cliente SQL mínimo para desarrollo.
 *
 * Los binarios de PostgreSQL que usamos en local (@embedded-postgres) incluyen
 * el servidor pero no `psql`/`createdb`, así que hacemos el equivalente con el
 * driver `pg`. Solo para desarrollo: en producción se usa un PostgreSQL real.
 *
 *   node scripts/db-sql.mjs ensure-db          → crea la base de datos si no existe
 *   node scripts/db-sql.mjs query "SELECT 1"   → ejecuta SQL contra la BD de la app
 */
import pg from "pg";

const PORT = Number(process.env.GEMINIS_DB_PORT ?? 55432);
const BASE = { host: "127.0.0.1", port: PORT, user: "geminis", password: "geminis" };
const DB_NAME = "geminis";

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
    console.error("Uso: node scripts/db-sql.mjs [ensure-db|query <SQL>]");
    process.exit(1);
  }
} catch (error) {
  console.error("✗", error.message);
  process.exit(1);
}
