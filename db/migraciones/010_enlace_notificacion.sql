-- Enlace de cada notificación a lo que avisa (p. ej. la justificación que hay
-- que revisar). Antes la notificación solo tenía texto y había que buscar a
-- mano. Las existentes quedan sin enlace: la pantalla les pone uno por tipo.
-- Idempotente: puede ejecutarse sobre una instalación existente.

ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS enlace VARCHAR(200);
