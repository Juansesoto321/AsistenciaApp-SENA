-- ============================================================
-- Limpieza de clases duplicadas en el horario (revisar antes de ejecutar)
-- Ejecutar con:
--   docker compose exec -T basedatos psql -U postgres -d asistenciaapp < db/limpieza/clases-duplicadas.sql
-- Después: docker compose exec backend npm run migrar   (crea el índice que impide nuevos duplicados)
-- ============================================================

-- 1. Ver las clases repetidas (misma ficha, día, horas y trimestre) y sus sesiones
SELECT h.id_horario, f.numero_ficha, h.dia_semana, h.hora_inicio, h.hora_fin, h.trimestre,
       u.nombres || ' ' || u.apellidos AS instructor,
       (SELECT COUNT(*) FROM sesion_clase s WHERE s.id_horario = h.id_horario) AS sesiones
FROM horario h
JOIN ficha f ON f.id_ficha = h.id_ficha
JOIN usuario u ON u.id_usuario = h.id_instructor
WHERE (h.id_ficha, h.dia_semana, h.hora_inicio, h.hora_fin, COALESCE(h.trimestre, 0)) IN (
  SELECT id_ficha, dia_semana, hora_inicio, hora_fin, COALESCE(trimestre, 0)
  FROM horario GROUP BY 1, 2, 3, 4, 5 HAVING COUNT(*) > 1
)
ORDER BY h.dia_semana, h.hora_inicio, h.id_horario;

-- 2. Lunes 08:00-13:00 (ficha 3311983): las clases 20 y 21 son idénticas y la 21
--    no tiene sesiones. Se borra la 21 (solo si sigue sin sesiones).
BEGIN;
DELETE FROM horario
WHERE id_horario = 21
  AND NOT EXISTS (SELECT 1 FROM sesion_clase WHERE id_horario = 21);
COMMIT;

-- 3. Viernes 08:00-13:00 (ficha 3311983): la clase 22 (Cristian Buitrago) y la 23
--    (Laura Andrea Gómez) son la misma ficha a la misma hora, y LAS DOS tienen la
--    sesión del 4 de septiembre con su asistencia y justificaciones. No se borra
--    nada aquí: decidan qué instructor dicta los viernes y, desde la aplicación
--    (queda en la auditoría):
--      a) Sesiones → abrir la sesión del 4 sep de la clase que sobra → "Eliminar sesión".
--      b) Horarios → abrir esa clase → "Eliminar".
--    Luego vuelvan a correr `npm run migrar`.
