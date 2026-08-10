#!/usr/bin/env bash
#
# Geminis · PostgreSQL local para desarrollo
# ------------------------------------------
# Arranca un PostgreSQL real (binarios de @embedded-postgres) sin Docker,
# sin sudo y sin instalar nada en el sistema. Los datos viven en .dev/pgdata,
# que está ignorado por git.
#
# Uso:  ./scripts/dev-db.sh [init|start|stop|status|psql|reset|logs]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-x64/native/bin"
if [ ! -d "$PGBIN" ]; then
  # Otras plataformas (arm64 mac, linux) instalan un paquete distinto.
  PGBIN="$(find "$ROOT/node_modules/@embedded-postgres" -maxdepth 3 -type d -name bin 2>/dev/null | head -1 || true)"
fi
PGDATA="$ROOT/.dev/pgdata"
PGLOG="$ROOT/.dev/postgres.log"
PGPORT="${GEMINIS_DB_PORT:-55432}"
PGUSER_NAME="geminis"
PGPASSWORD_VALUE="geminis"
PGDB="geminis"

if [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "✗ No encuentro los binarios de PostgreSQL. Ejecuta 'npm install' primero." >&2
  exit 1
fi

cmd_init() {
  if [ -f "$PGDATA/PG_VERSION" ]; then
    echo "✓ El cluster ya existe en .dev/pgdata"
    return
  fi
  mkdir -p "$ROOT/.dev"
  local pwfile
  pwfile="$(mktemp)"
  printf '%s' "$PGPASSWORD_VALUE" > "$pwfile"
  "$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER_NAME" --pwfile="$pwfile" \
    --auth-local=scram-sha-256 --auth-host=scram-sha-256 -E UTF8 --locale=C >/dev/null
  rm -f "$pwfile"
  # Solo loopback. Nunca exponer la BD de desarrollo a la red.
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PGPORT"
    echo "unix_socket_directories = '/tmp'"
  } >> "$PGDATA/postgresql.conf"
  echo "✓ Cluster PostgreSQL creado en .dev/pgdata"
}

cmd_start() {
  cmd_init
  if cmd_status >/dev/null 2>&1; then
    echo "· PostgreSQL ya estaba en marcha"
  else
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -w start >/dev/null
  fi
  GEMINIS_DB_PORT="$PGPORT" node "$ROOT/scripts/db-sql.mjs" ensure-db
  echo "✓ PostgreSQL escuchando en 127.0.0.1:$PGPORT · base de datos '$PGDB'"
}

cmd_stop() {
  "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 && echo "✓ PostgreSQL detenido" || echo "· No estaba en marcha"
}

cmd_status() { "$PGBIN/pg_ctl" -D "$PGDATA" status; }
cmd_psql() { GEMINIS_DB_PORT="$PGPORT" exec node "$ROOT/scripts/db-sql.mjs" query "$@"; }
cmd_logs() { tail -n 80 "$PGLOG"; }

cmd_reset() {
  cmd_stop || true
  rm -rf "$PGDATA"
  echo "✓ Datos eliminados. Ejecuta './scripts/dev-db.sh start' para recrear."
}

case "${1:-start}" in
  init) cmd_init ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  psql) shift; cmd_psql "$@" ;;
  logs) cmd_logs ;;
  reset) cmd_reset ;;
  *) echo "Uso: $0 [init|start|stop|status|psql|reset|logs]" >&2; exit 1 ;;
esac
