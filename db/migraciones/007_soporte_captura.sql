-- Un ticket de soporte puede llevar una captura de pantalla del problema
-- (imagen JPG, PNG o WEBP en base64, igual que los soportes de justificación).
-- Es idempotente.
ALTER TABLE ticket_soporte ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);
ALTER TABLE ticket_soporte ADD COLUMN IF NOT EXISTS archivo_datos TEXT;
