-- Una ficha no puede tener dos clases idénticas (mismo día, mismas horas y
-- mismo trimestre). La aplicación ya revisa los cruces al guardar; este índice
-- es la última defensa de la base de datos.
-- Si ya hay clases duplicadas no se crea el índice (la migración no falla):
-- avisa, y se crea cuando se limpien (db/limpieza/clases-duplicadas.sql) y se
-- vuelva a correr `npm run migrar`. Es idempotente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_horario_sin_duplicados') THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM horario
    GROUP BY id_ficha, dia_semana, hora_inicio, hora_fin, COALESCE(trimestre, 0)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay clases duplicadas en el horario: no se creó idx_horario_sin_duplicados. Revisa db/limpieza/clases-duplicadas.sql y vuelve a correr npm run migrar.';
    RETURN;
  END IF;
  CREATE UNIQUE INDEX idx_horario_sin_duplicados
    ON horario (id_ficha, dia_semana, hora_inicio, hora_fin, (COALESCE(trimestre, 0)));
END $$;
