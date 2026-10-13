-- Horarios por trimestre de la ficha, con competencia.
-- En el SENA el horario cambia cada trimestre (cambian competencias e
-- instructores): un horario ahora pertenece a un trimestre de la ficha y solo
-- se repite entre las fechas de ese trimestre. Los horarios anteriores (sin
-- trimestre) siguen valiendo durante todo su periodo.
-- Idempotente: puede ejecutarse sobre una instalación existente.

ALTER TABLE horario ADD COLUMN IF NOT EXISTS trimestre INTEGER;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS id_competencia INTEGER REFERENCES competencia(id_competencia);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horario_trimestre_check') THEN
    ALTER TABLE horario ADD CONSTRAINT horario_trimestre_check CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 12);
  END IF;
END $$;

-- Horarios existentes: la competencia sale de su resultado de aprendizaje
UPDATE horario h SET id_competencia = r.id_competencia
FROM resultado_aprendizaje r
WHERE h.id_rap = r.id_rap AND h.id_competencia IS NULL;

-- Fechas entre las que se repite cada horario. El trimestre N de una ficha va
-- de inicio + 3(N-1) meses al día anterior a inicio + 3N meses: siempre tres
-- meses, aunque la ficha tenga registrada una fecha de fin más corta. Un único
-- lugar para esta regla: la usan el calendario, las clases de hoy y los cruces.
CREATE OR REPLACE VIEW horario_vigencia AS
SELECT h.id_horario,
       CASE WHEN h.trimestre IS NULL THEN p.fecha_inicio
            ELSE (f.fecha_inicio + make_interval(months => (h.trimestre - 1) * 3))::date
       END AS vigente_desde,
       CASE WHEN h.trimestre IS NULL THEN p.fecha_fin
            ELSE (f.fecha_inicio + make_interval(months => h.trimestre * 3))::date - 1
       END AS vigente_hasta
FROM horario h
JOIN ficha f ON f.id_ficha = h.id_ficha
JOIN periodo p ON p.id_periodo = h.id_periodo;
