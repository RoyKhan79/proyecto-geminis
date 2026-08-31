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
  # Otras plataformas (arm64 mac, linux, windows) instalan un paquete distinto.
  PGBIN="$(find "$ROOT/node_modules/@embedded-postgres" -maxdepth 3 -type d -name bin 2>/dev/null | head -1 || true)"
fi

# En Windows esto corre bajo Git Bash: los binarios llevan .exe y PostgreSQL no
# tiene sockets de dominio unix, así que un par de cosas cambian. Se detecta
# aquí y se usa más abajo; el resto del script es el mismo en todas partes.
EXE=""
case "$(uname -s 2>/dev/null || echo desconocido)" in
  MINGW* | MSYS* | CYGWIN*) EXE=".exe" ;;
esac
PGDATA="$ROOT/.dev/pgdata"
PGLOG="$ROOT/.dev/postgres.log"
PGPORT="${GEMINIS_DB_PORT:-55432}"
PGUSER_NAME="geminis"
PGPASSWORD_VALUE="geminis"
PGDB="geminis"

if [ ! -x "$PGBIN/pg_ctl$EXE" ]; then
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
  "$PGBIN/initdb$EXE" -D "$PGDATA" -U "$PGUSER_NAME" --pwfile="$pwfile" \
    --auth-local=scram-sha-256 --auth-host=scram-sha-256 -E UTF8 --locale=C >/dev/null
  rm -f "$pwfile"
  # Solo loopback. Nunca exponer la BD de desarrollo a la red.
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PGPORT"
    # PostgreSQL 18 ya habla sockets unix en Windows, pero allí '/tmp' no
    # existe y el servidor no llega a arrancar. Se omite y se queda con TCP en
    # loopback, que es por donde entra la aplicación en las tres plataformas.
    if [ -z "$EXE" ]; then echo "unix_socket_directories = '/tmp'"; fi
  } >> "$PGDATA/postgresql.conf"
  echo "✓ Cluster PostgreSQL creado en .dev/pgdata"
}

cmd_start() {
  cmd_init
  if cmd_status >/dev/null 2>&1; then
    echo "· PostgreSQL ya estaba en marcha"
  else
    # El servidor queda en segundo plano y hereda los descriptores de quien lo
    # arrancó. Si se le dejan abiertos, cualquier tubería que envuelva a este
    # script —un `| tail`, la salida capturada por un CI— se queda esperando a
    # que cierren, que es hasta que se pare la base de datos. Se le cierran los
    # tres: el registro ya se lo lleva `-l`.
    "$PGBIN/pg_ctl$EXE" -D "$PGDATA" -l "$PGLOG" -w start </dev/null >/dev/null 2>&1
  fi
  GEMINIS_DB_PORT="$PGPORT" node "$ROOT/scripts/db-sql.mjs" ensure-db
  # El rol con el que entra la aplicación. Se crea aquí y no en la migración
  # que lo configura, porque allí habría que escribir la contraseña y en una
  # migración no van secretos. Al crearlo antes, aquella se limita a ajustarle
  # los privilegios y le respeta la contraseña.
  GEMINIS_DB_PORT="$PGPORT" node "$ROOT/scripts/db-sql.mjs" ensure-app-role
  echo "✓ PostgreSQL escuchando en 127.0.0.1:$PGPORT · base de datos '$PGDB'"
}

cmd_stop() {
  "$PGBIN/pg_ctl$EXE" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 && echo "✓ PostgreSQL detenido" || echo "· No estaba en marcha"
}

cmd_status() { "$PGBIN/pg_ctl$EXE" -D "$PGDATA" status; }
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
