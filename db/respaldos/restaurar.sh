#!/bin/sh
# Restaura una copia de seguridad SOBRE la base actual (reemplaza todos los datos).
#
#   docker compose exec respaldos /restaurar.sh asistenciaapp_2026-10-13_0300.sql.gz
#
# Conviene detener antes el backend para que nadie escriba mientras tanto:
#   docker compose stop backend
#   docker compose exec respaldos /restaurar.sh <archivo>
#   docker compose start backend
set -eu

if [ $# -ne 1 ]; then
  echo "Uso: /restaurar.sh <archivo .sql.gz de la carpeta respaldos>"
  echo "Copias disponibles:"
  ls -1t /respaldos/asistenciaapp_*.sql.gz 2>/dev/null | xargs -n1 basename || echo "  (ninguna)"
  exit 1
fi

archivo="$1"
[ -f "$archivo" ] || archivo="/respaldos/$1"
[ -f "$archivo" ] || { echo "No existe la copia: $1"; exit 1; }

echo "[respaldos] Restaurando $(basename "$archivo") en la base $PGDATABASE…"
gunzip -c "$archivo" | psql -q -v ON_ERROR_STOP=1 -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" > /dev/null
echo "[respaldos] Listo. Reinicia el backend si lo detuviste: docker compose start backend"
