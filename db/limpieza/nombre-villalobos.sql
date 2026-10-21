-- ============================================================
-- Apellido mal escrito: "Becerra Villalobo" -> "Becerra Villalobos" (revisar antes de ejecutar)
--   docker compose exec -T basedatos psql -U postgres -d asistenciaapp < db/limpieza/nombre-villalobos.sql
--
-- No es un recorte de la base: nombres y apellidos admiten 100 caracteres y
-- ninguna pantalla limita la longitud. El error estaba escrito así en los
-- datos de ejemplo (backend/src/scripts/sembrar.js), ya corregidos; su correo
-- (becerravillalobos08@gmail.com) confirma "Villalobos".
-- ============================================================

-- 1. Cómo está hoy
SELECT id_usuario, nombres, apellidos, correo FROM usuario WHERE apellidos ILIKE '%villalobo%';

-- 2. Corrección (solo esa cuenta: por apellido y correo)
BEGIN;
UPDATE usuario SET apellidos = 'Becerra Villalobos'
WHERE apellidos = 'Becerra Villalobo' AND correo = 'becerravillalobos08@gmail.com';
COMMIT;
