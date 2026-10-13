#!/bin/sh
# Copias de seguridad de la base de datos de AsistenciaApp.
#
# Lo ejecuta el servicio "respaldos" de docker-compose.yml:
#   - sin argumentos: hace una copia al arrancar y luego una cada RESPALDO_CADA_HORAS
#   - con "ahora":    hace una sola copia y termina
#       docker compose exec respaldos /respaldar.sh ahora
#
# Cada copia es un archivo asistenciaapp_AAAA-MM-DD_HHMM.sql.gz en la carpeta
# respaldos/ del proyecto. Se borran las que tengan más de RESPALDO_DIAS días.
set -eu

CARPETA=/respaldos
DIAS="${RESPALDO_DIAS:-14}"
CADA_HORAS="${RESPALDO_CADA_HORAS:-24}"

respaldar() {
  archivo="$CARPETA/asistenciaapp_$(date +%Y-%m-%d_%H%M).sql.gz"
  # Se escribe primero a un temporal: si pg_dump falla no queda una copia a medias
  if pg_dump --clean --if-exists --no-owner -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" | gzip > "$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
    echo "[respaldos] $(date '+%Y-%m-%d %H:%M') copia creada: $(basename "$archivo") ($(du -h "$archivo" | cut -f1))"
  else
    rm -f "$archivo.tmp"
    echo "[respaldos] $(date '+%Y-%m-%d %H:%M') ERROR: no se pudo crear la copia" >&2
    return 1
  fi
  find "$CARPETA" -name 'asistenciaapp_*.sql.gz' -mtime +"$DIAS" -print -delete | sed 's/^/[respaldos] borrada por antigua: /'
}

mkdir -p "$CARPETA"
if [ "${1:-}" = "ahora" ]; then
  respaldar
  exit $?
fi

while true; do
  respaldar || true
  sleep $((CADA_HORAS * 3600))
done
