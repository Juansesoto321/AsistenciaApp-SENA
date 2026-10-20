-- ============================================================
-- Nombres de programa y sede escritos de la misma forma (revisar antes de ejecutar)
--   docker compose exec -T basedatos psql -U postgres -d asistenciaapp < db/limpieza/nombres-consistentes.sql
-- ============================================================

-- 1. Cómo están hoy
SELECT 'ficha' AS tabla, id_ficha AS id, numero_ficha AS registro, programa AS valor FROM ficha
UNION ALL
SELECT 'ambiente', id_ambiente, numero_ambiente, sede_centro FROM ambiente
ORDER BY 1, 2;

-- 2. Programa con sigla -> nombre completo; sede abreviada -> nombre completo
BEGIN;
UPDATE ficha SET programa = 'Análisis y Desarrollo de Software' WHERE programa = 'ADSO';
UPDATE ambiente SET sede_centro = 'SENA - CGMLTI Bogotá' WHERE sede_centro = 'CGMLTI';
COMMIT;
