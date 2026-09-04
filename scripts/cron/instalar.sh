#!/usr/bin/env bash
#
# Catedria · instalar las tareas programadas
# -----------------------------------------
# Deja el crontab de `catedria.crontab` en el usuario que lo ejecuta, con las
# rutas de ESTE servidor ya sustituidas.
#
#   ./scripts/cron/instalar.sh            → instala (pide confirmación)
#   ./scripts/cron/instalar.sh --ver      → enseña lo que instalaría y sale
#   ./scripts/cron/instalar.sh --quitar   → retira solo las líneas de Catedria
#
# Existe en lugar de dejarlo escrito en la documentación porque un cron que se
# copia a mano se copia mal: se pega sin la ruta buena, o con el npm que no
# está en el PATH de cron, y el fallo no se ve hasta que un día falta una
# convocatoria que nadie recibió.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANTILLA="$ROOT/scripts/cron/catedria.crontab"
MARCA_INICIO="# >>> catedria >>>"
MARCA_FIN="# <<< catedria <<<"

if [ ! -f "$PLANTILLA" ]; then
  echo "✗ No encuentro $PLANTILLA" >&2
  exit 1
fi

NPM="$(command -v npm || true)"
if [ -z "$NPM" ]; then
  echo "✗ No encuentro npm en el PATH." >&2
  exit 1
fi

# El crontab actual sin el bloque de Catedria, para poder reinstalar sin duplicar.
actual_sin_catedria() {
  crontab -l 2>/dev/null | sed "/$MARCA_INICIO/,/$MARCA_FIN/d" || true
}

bloque() {
  echo "$MARCA_INICIO"
  echo "# Generado por scripts/cron/instalar.sh · no editar a mano:"
  echo "# se pierde al reinstalar. Los cambios van en catedria.crontab."
  sed -e "s|RUTA_PROYECTO|$ROOT|g" -e "s|RUTA_NPM|$NPM|g" "$PLANTILLA"
  echo "$MARCA_FIN"
}

case "${1:-}" in
  --ver)
    bloque
    exit 0
    ;;
  --quitar)
    actual_sin_catedria | crontab -
    echo "✓ Tareas de Catedria retiradas. El resto de tu crontab sigue igual."
    exit 0
    ;;
  "")
    ;;
  *)
    echo "Uso: $0 [--ver|--quitar]" >&2
    exit 1
    ;;
esac

echo "Se va a instalar esto en el crontab de $(whoami):"
echo
bloque | sed 's/^/    /'
echo
read -r -p "¿Seguir? [s/N] " respuesta
case "$respuesta" in
  s | S | si | SI | sí | SÍ) ;;
  *)
    echo "· Cancelado. No se ha tocado nada."
    exit 0
    ;;
esac

{ actual_sin_catedria; bloque; } | crontab -

echo "✓ Instalado. Compruébalo con: crontab -l"
echo "· El radar deja su registro en /var/log/catedria-radar.log"
echo "· Si deja de correr, el panel de Plataforma → Salud lo avisa."
