-- Plan de formación por trimestre (el SENA organiza la formación en trimestres).
-- Cada ficha tiene N trimestres (ADSO: 6 lectivos + 1 de etapa productiva) y en
-- cada uno se programan competencias con su instructor. La misma competencia
-- puede repetirse en otro trimestre, con el mismo o con otro instructor.
-- Idempotente: puede ejecutarse sobre una instalación existente.

ALTER TABLE ficha ADD COLUMN IF NOT EXISTS trimestres INTEGER NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ficha_trimestres_check') THEN
    ALTER TABLE ficha ADD CONSTRAINT ficha_trimestres_check CHECK (trimestres BETWEEN 1 AND 12);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS programacion_trimestre (
  id_programacion SERIAL PRIMARY KEY,
  id_ficha        INTEGER NOT NULL REFERENCES ficha(id_ficha) ON DELETE CASCADE,
  trimestre       INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 12),
  id_competencia  INTEGER NOT NULL REFERENCES competencia(id_competencia) ON DELETE CASCADE,
  id_instructor   INTEGER NOT NULL REFERENCES usuario(id_usuario),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_ficha, trimestre, id_competencia, id_instructor)
);

CREATE INDEX IF NOT EXISTS idx_programacion_ficha ON programacion_trimestre(id_ficha, trimestre);
