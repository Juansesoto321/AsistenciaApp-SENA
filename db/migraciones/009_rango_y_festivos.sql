-- Rango de fechas de la serie y festivos.
-- Una clase puede repetirse solo entre dos fechas dentro de su trimestre (por
-- ejemplo, una competencia que se ve las primeras seis semanas), y por defecto
-- no se dicta en festivos. Los horarios existentes no cambian: sin fechas
-- valen todo su trimestre, como antes, y dejan de aparecer los días festivos.
-- Idempotente: puede ejecutarse sobre una instalación existente.

ALTER TABLE horario ADD COLUMN IF NOT EXISTS fecha_desde DATE;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS fecha_hasta DATE;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS excluir_festivos BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horario_rango_fechas_check') THEN
    ALTER TABLE horario ADD CONSTRAINT horario_rango_fechas_check
      CHECK (fecha_desde IS NULL OR fecha_hasta IS NULL OR fecha_hasta >= fecha_desde);
  END IF;
END $$;

-- Misma regla de antes (trimestre o periodo), recortada por el rango de la
-- serie si lo tiene. GREATEST y LEAST ignoran los NULL.
CREATE OR REPLACE VIEW horario_vigencia AS
SELECT h.id_horario,
       GREATEST(
         CASE WHEN h.trimestre IS NULL THEN p.fecha_inicio
              ELSE (f.fecha_inicio + make_interval(months => (h.trimestre - 1) * 3))::date
         END,
         h.fecha_desde
       ) AS vigente_desde,
       LEAST(
         CASE WHEN h.trimestre IS NULL THEN p.fecha_fin
              ELSE (f.fecha_inicio + make_interval(months => h.trimestre * 3))::date - 1
         END,
         h.fecha_hasta
       ) AS vigente_hasta
FROM horario h
JOIN ficha f ON f.id_ficha = h.id_ficha
JOIN periodo p ON p.id_periodo = h.id_periodo;
