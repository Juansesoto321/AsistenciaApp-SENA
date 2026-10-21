-- ============================================================
-- Avisos repetidos de inasistencia (revisar antes de ejecutar)
--   docker compose exec -T basedatos psql -U postgres -d asistenciaapp < db/limpieza/avisos-duplicados.sql
--
-- Por qué hubo 6 avisos para 2 faltas: la ficha 3311983 tenía clases
-- repetidas en el horario (lunes y viernes, ver clases-duplicadas.sql), así que
-- el mismo día se abrieron y cerraron dos sesiones de la misma clase y cada
-- cierre avisó; además, la versión anterior del código avisaba con el texto
-- fijo "Faltaste a la clase de hoy". Hoy no se repiten: la clase repetida ya no
-- se puede crear ni iniciar (punto 1) y cada falta genera un solo enlace y un
-- solo aviso, con la fecha, la hora y la ficha.
--
-- Este script SOLO LISTA los repetidos. El borrado va comentado al final:
-- dos avisos iguales del mismo día pueden ser dos clases distintas (mañana y
-- tarde) si el texto no decía la hora, así que revisa la lista antes.
-- ============================================================

-- 1. Avisos con el mismo destinatario, título y texto, del mismo día
SELECT n.id_usuario, u.nombres || ' ' || u.apellidos AS aprendiz, n.titulo, left(n.mensaje, 80) AS mensaje,
       n.creado_en::date AS dia, COUNT(*) AS veces,
       array_agg(n.id_notificacion ORDER BY n.id_notificacion) AS ids
FROM notificacion n
JOIN usuario u ON u.id_usuario = n.id_usuario
WHERE n.tipo IN ('inasistencia', 'justificacion')
GROUP BY n.id_usuario, u.nombres, u.apellidos, n.titulo, n.mensaje, n.creado_en::date
HAVING COUNT(*) > 1
ORDER BY dia, aprendiz;

-- 2. (Comentado) Deja el más antiguo de cada grupo y borra los demás.
-- BEGIN;
-- DELETE FROM notificacion n
-- USING (
--   SELECT id_notificacion,
--          ROW_NUMBER() OVER (PARTITION BY id_usuario, titulo, mensaje, creado_en::date ORDER BY id_notificacion) AS orden
--   FROM notificacion
--   WHERE tipo IN ('inasistencia', 'justificacion')
-- ) d
-- WHERE n.id_notificacion = d.id_notificacion AND d.orden > 1;
-- COMMIT;
