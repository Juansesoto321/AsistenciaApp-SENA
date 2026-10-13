-- Una marca del lector que llega después de cerrar la clase (el equipo estuvo
-- sin red y reenvía lo pendiente) cambia "ausente" por "presente" o
-- "tardanza". Ese cambio también queda en el historial, pero no lo hizo una
-- persona: cambiado_por queda en NULL para indicar que fue el lector.
-- Es idempotente.
ALTER TABLE cambio_asistencia ALTER COLUMN cambiado_por DROP NOT NULL;
