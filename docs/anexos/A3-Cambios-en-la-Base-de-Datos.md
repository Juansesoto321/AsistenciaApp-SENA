# Cambios en la base de datos — AsistenciaApp SENA

Estado actual del esquema: [A2-Modelo-Relacional.md](A2-Modelo-Relacional.md) (también en
[PDF](A2-Modelo-Relacional.pdf) y como [página web](A2-Modelo-Relacional.html)).

El esquema de la base en uso coincide línea por línea con una instalación limpia de
`db/init.sql` más las migraciones `001` a `010`: no tiene cambios hechos a mano.

## 1. Cambios en la estructura (migraciones)

Todas están en `db/migraciones/`, son idempotentes y se aplican en orden con
`npm run migrar` (con Docker: `docker compose exec backend npm run migrar`).

| Migración | Fecha | Cambio |
|---|---|---|
| `001_logs` | 2026-09-23 | Tabla `log_error` para el registro de errores del sistema |
| `002_roles` | 2026-09-23 | «Administrador» pasa a llamarse coordinador; se habilita el rol programador |
| `003_competencias` | 2026-09-23 | Estructura curricular competencia → RAP → temática; el horario indica qué se dicta |
| `004_programacion_trimestral` | 2026-10-13 | Plan de formación por trimestre (`programacion_trimestre`) |
| `005_horarios_por_trimestre` | 2026-10-13 | Cada horario pertenece a un trimestre de la ficha, con su competencia |
| `006_cambios_del_lector` | 2026-10-13 | Una marca que llega tarde puede corregir un «ausente»; queda en el historial con `cambiado_por` en NULL |
| `007_soporte_captura` | 2026-10-13 | Los tickets de soporte pueden llevar una captura de pantalla |
| `008_horario_sin_duplicados` | 2026-10-19 | Índice único para que una ficha no tenga dos clases idénticas |
| `009_rango_y_festivos` | 2026-10-20 | Rango de fechas por clase y exclusión de festivos |
| `010_enlace_notificacion` | 2026-10-20 | Cada notificación enlaza a lo que avisa (por ejemplo, la justificación por revisar) |

## 2. Scripts de datos

| Script | Para qué sirve |
|---|---|
| `db/datos/competencias_cf11.sql` | Carga las 7 competencias y los 27 resultados de aprendizaje de la ficha CF11 (el mismo contenido de `docs/competencias_cf11.csv`). Se puede correr varias veces sin duplicar nada y deja un registro en la auditoría. |
| `db/limpieza/*.sql` | Correcciones puntuales (avisos o clases duplicadas, nombres escritos distinto). Cada uno se revisa antes de ejecutarlo. |

Cómo correr el de competencias en la instalación con Docker:

```bash
docker exec -i asistenciaapp-sena-basedatos-1 psql -U postgres -d asistenciaapp -v ON_ERROR_STOP=1 < db/datos/competencias_cf11.sql
```

(El nombre del contenedor cambia según la carpeta del proyecto; `docker ps` lo muestra.)

## 3. Cambios de datos en la base de la feria

Resumen de la auditoría de la instalación usada para las pruebas de la feria. Los datos
personales de los aprendices no se incluyen aquí.

| Fecha | Quién | Cambio |
|---|---|---|
| 2026-10-20 | Programador | Borró un horario repetido de la ficha 3311983 (lunes 06:00) |
| 2026-10-27 | Sistema | Cierre automático de la primera clase: 5 ausentes |
| 2026-10-27 | Coordinador | Creó el ambiente 205 y un lector de prueba |
| 2026-10-28 | Mantenimiento | Borró el lector de prueba `PRUEBA-CONEXION` |
| 2026-10-28 | Programador | Registró el lector real ZKTeco SenseFace 2A; quedó además un ambiente «201» repetido y un lector con el serial mal escrito, pendientes de borrar |
| 2026-10-28 | Mantenimiento | Lector real asignado al ambiente 201 y simulador al 205 |
| 2026-10-28 | Instructor | Pruebas de la feria: 19 reinicios de la clase de demostración, 18 clases abiertas, 3 cerradas a mano, 8 asistencias manuales y 1 reporte PDF |
| 2026-10-30 y 31 | Sistema | 8 justificaciones vencieron sin enviarse |
| 2026-11-17 | Sistema | Al encender el equipo se cerró sola la clase de demostración del 28 de octubre: 4 ausentes, con su correo y enlace para justificar |
| 2026-11-17 | Mantenimiento | Carga de las 7 competencias y 27 RAP con `db/datos/competencias_cf11.sql` |
