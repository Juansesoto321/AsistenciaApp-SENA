# Modelo relacional — AsistenciaApp SENA

Generado el 2026-11-17 directamente de la base en uso (PostgreSQL 16, base `asistenciaapp` del entorno en el puerto 8090).
El esquema de esa base coincide línea por línea con una instalación limpia de `db/init.sql` + `db/migraciones/001…010`.

**24 tablas · 173 columnas · 36 llaves foráneas · 22 reglas CHECK · 3 índices únicos parciales**

Para verlo fuera de GitHub (WhatsApp, Drive, Word): [PDF](09-Modelo-Relacional.pdf) · [página web en un solo archivo](09-Modelo-Relacional.html) · [PNG](09-Modelo-Relacional.png) · [SVG](09-Modelo-Relacional.svg). Historial de cambios: [10-Cambios-en-la-Base-de-Datos.md](10-Cambios-en-la-Base-de-Datos.md).

## Diagrama entidad-relación

[![Diagrama entidad-relación de AsistenciaApp SENA](09-Modelo-Relacional.svg)](09-Modelo-Relacional.svg)

*Haz clic en la imagen para abrirla en grande y acercarla. También está en [PDF](09-Modelo-Relacional.pdf).*

Notación pata de gallo: `||` exactamente uno, `|o` cero o uno, `o{` cero o muchos. PK = llave primaria, FK = llave foránea, UK = valor único.

<details>
<summary>Código Mermaid del diagrama (para editarlo o regenerarlo)</summary>

```mermaid
erDiagram
  usuario {
    integer id_usuario PK
    varchar(100) nombres
    varchar(100) apellidos
    varchar(10) tipo_documento
    varchar(20) documento UK
    varchar(150) correo UK
    varchar(20) telefono
    varchar(255) contrasena_hash
    varchar(20) rol
    varchar(20) estado
    integer intentos_fallidos
    timestamptz bloqueado_hasta
    timestamptz creado_en
    timestamptz actualizado_en
  }
  token_recuperacion {
    integer id_token PK
    integer id_usuario FK
    varchar(100) token UK
    timestamptz expira_en
    boolean usado
    timestamptz creado_en
  }
  busqueda_guardada {
    integer id_busqueda PK
    integer id_usuario FK
    varchar(100) nombre
    jsonb filtros
    timestamptz creado_en
  }
  periodo {
    integer id_periodo PK
    varchar(50) nombre
    date fecha_inicio
    date fecha_fin
  }
  ficha {
    integer id_ficha PK
    varchar(20) numero_ficha UK
    varchar(150) programa
    varchar(20) jornada
    date fecha_inicio
    date fecha_fin
    integer id_periodo FK
    integer id_instructor FK
    varchar(20) estado
    integer trimestres
  }
  matricula {
    integer id_matricula PK
    integer id_aprendiz FK
    integer id_ficha FK
    varchar(20) estado
    timestamptz fecha_matricula
  }
  ambiente {
    integer id_ambiente PK
    varchar(20) numero_ambiente
    varchar(150) sede_centro
    integer id_periodo FK
    varchar(20) estado
  }
  dispositivo {
    integer id_dispositivo PK
    varchar(50) serial UK
    varchar(80) modelo
    integer id_ambiente FK
    varchar(100) clave_api
    varchar(20) estado
    timestamptz ultimo_heartbeat
  }
  competencia {
    integer id_competencia PK
    varchar(30) codigo
    varchar(300) nombre UK
    timestamptz creado_en
  }
  resultado_aprendizaje {
    integer id_rap PK
    integer id_competencia FK
    varchar(30) codigo UK
    text nombre
    timestamptz creado_en
  }
  tematica {
    integer id_tematica PK
    integer id_rap FK
    varchar(200) nombre
  }
  programacion_trimestre {
    integer id_programacion PK
    integer id_ficha FK
    integer trimestre
    integer id_competencia FK
    integer id_instructor FK
    timestamptz creado_en
  }
  horario {
    integer id_horario PK
    integer id_ficha FK
    integer id_ambiente FK
    integer id_instructor FK
    integer id_periodo FK
    integer dia_semana
    time hora_inicio
    time hora_fin
    integer id_rap FK
    integer id_tematica FK
    integer id_competencia FK
    integer trimestre
    date fecha_desde
    date fecha_hasta
    boolean excluir_festivos
  }
  sesion_clase {
    integer id_sesion PK
    integer id_horario FK
    date fecha
    varchar(20) estado
    timestamptz hora_apertura
    timestamptz hora_cierre
    integer cerrada_por FK
  }
  asistencia {
    integer id_asistencia PK
    integer id_sesion FK
    integer id_aprendiz FK
    varchar(20) estado
    timestamptz hora_marca
    varchar(20) metodo
    text observacion
    integer registrado_por FK
    timestamptz creado_en
  }
  cambio_asistencia {
    integer id_cambio PK
    integer id_asistencia FK
    varchar(20) estado_anterior
    varchar(20) estado_nuevo
    text motivo
    integer cambiado_por FK
    timestamptz fecha_cambio
  }
  justificacion {
    integer id_justificacion PK
    integer id_asistencia FK,UK
    varchar(100) token UK
    timestamptz expira_en
    varchar(40) tipo
    text descripcion
    varchar(255) nombre_archivo
    text archivo_datos
    varchar(20) estado
    timestamptz enviada_en
    integer validada_por FK
    timestamptz validada_en
    text observacion_validacion
    timestamptz creado_en
  }
  consentimiento {
    integer id_consentimiento PK
    integer id_aprendiz FK
    varchar(20) version_texto
    boolean aceptado
    timestamptz fecha_aceptacion
    timestamptz revocado_en
  }
  plantilla_biometrica {
    integer id_plantilla PK
    integer id_aprendiz FK,UK
    text plantilla_cifrada
    varchar(64) iv
    varchar(64) etiqueta_auth
    varchar(30) algoritmo
    integer id_consentimiento FK
    timestamptz creado_en
  }
  notificacion {
    integer id_notificacion PK
    integer id_usuario FK
    varchar(40) tipo
    varchar(150) titulo
    text mensaje
    boolean leida
    timestamptz creado_en
    varchar(200) enlace
  }
  auditoria {
    integer id_auditoria PK
    integer id_usuario FK
    varchar(60) accion
    varchar(40) entidad
    integer id_entidad
    jsonb detalle
    timestamptz creado_en
  }
  log_error {
    integer id_log PK
    varchar(10) nivel
    text mensaje
    varchar(10) metodo
    varchar(255) ruta
    integer id_usuario FK
    text traza
    timestamptz creado_en
  }
  ticket_soporte {
    integer id_ticket PK
    integer id_usuario FK
    varchar(40) tipo
    text descripcion
    varchar(20) estado
    varchar(255) nombre_archivo
    text archivo_datos
    timestamptz creado_en
  }
  configuracion {
    varchar(50) clave PK
    varchar(100) valor
  }
  usuario ||--o{ token_recuperacion : "id_usuario"
  periodo ||--o{ ficha : "id_periodo"
  usuario ||--o{ ficha : "id_instructor"
  usuario ||--o{ matricula : "id_aprendiz"
  ficha ||--o{ matricula : "id_ficha"
  periodo |o--o{ ambiente : "id_periodo"
  ambiente |o--o{ dispositivo : "id_ambiente"
  competencia ||--o{ resultado_aprendizaje : "id_competencia"
  resultado_aprendizaje ||--o{ tematica : "id_rap"
  ficha ||--o{ programacion_trimestre : "id_ficha"
  competencia ||--o{ programacion_trimestre : "id_competencia"
  usuario ||--o{ programacion_trimestre : "id_instructor"
  ficha ||--o{ horario : "id_ficha"
  ambiente ||--o{ horario : "id_ambiente"
  usuario ||--o{ horario : "id_instructor"
  periodo ||--o{ horario : "id_periodo"
  resultado_aprendizaje |o--o{ horario : "id_rap"
  tematica |o--o{ horario : "id_tematica"
  competencia |o--o{ horario : "id_competencia"
  horario ||--o{ sesion_clase : "id_horario"
  usuario |o--o{ sesion_clase : "cerrada_por"
  sesion_clase ||--o{ asistencia : "id_sesion"
  usuario ||--o{ asistencia : "id_aprendiz"
  usuario |o--o{ asistencia : "registrado_por"
  asistencia ||--o{ cambio_asistencia : "id_asistencia"
  usuario |o--o{ cambio_asistencia : "cambiado_por"
  usuario ||--o{ consentimiento : "id_aprendiz"
  usuario ||--o| plantilla_biometrica : "id_aprendiz"
  consentimiento ||--o{ plantilla_biometrica : "id_consentimiento"
  asistencia ||--o| justificacion : "id_asistencia"
  usuario |o--o{ justificacion : "validada_por"
  usuario ||--o{ notificacion : "id_usuario"
  usuario |o--o{ auditoria : "id_usuario"
  usuario ||--o{ ticket_soporte : "id_usuario"
  usuario ||--o{ busqueda_guardada : "id_usuario"
  usuario |o--o{ log_error : "id_usuario"
```

</details>

## Tablas por módulo

### Usuarios y seguridad

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `usuario` | 14 | id_usuario | — |
| `token_recuperacion` | 6 | id_token | id_usuario → usuario |
| `busqueda_guardada` | 5 | id_busqueda | id_usuario → usuario |

### Estructura académica

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `periodo` | 4 | id_periodo | — |
| `ficha` | 10 | id_ficha | id_periodo → periodo<br>id_instructor → usuario |
| `matricula` | 5 | id_matricula | id_aprendiz → usuario<br>id_ficha → ficha |
| `ambiente` | 5 | id_ambiente | id_periodo → periodo |
| `dispositivo` | 7 | id_dispositivo | id_ambiente → ambiente |

### Currículo (competencias)

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `competencia` | 4 | id_competencia | — |
| `resultado_aprendizaje` | 5 | id_rap | id_competencia → competencia |
| `tematica` | 3 | id_tematica | id_rap → resultado_aprendizaje |
| `programacion_trimestre` | 6 | id_programacion | id_ficha → ficha<br>id_competencia → competencia<br>id_instructor → usuario |

### Programación y asistencia

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `horario` | 15 | id_horario | id_ficha → ficha<br>id_ambiente → ambiente<br>id_instructor → usuario<br>id_periodo → periodo<br>id_rap → resultado_aprendizaje<br>id_tematica → tematica<br>id_competencia → competencia |
| `sesion_clase` | 7 | id_sesion | id_horario → horario<br>cerrada_por → usuario |
| `asistencia` | 9 | id_asistencia | id_sesion → sesion_clase<br>id_aprendiz → usuario<br>registrado_por → usuario |
| `cambio_asistencia` | 7 | id_cambio | id_asistencia → asistencia<br>cambiado_por → usuario |
| `justificacion` | 14 | id_justificacion | id_asistencia → asistencia<br>validada_por → usuario |

### Biometría (Ley 1581/2012)

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `consentimiento` | 6 | id_consentimiento | id_aprendiz → usuario |
| `plantilla_biometrica` | 8 | id_plantilla | id_aprendiz → usuario<br>id_consentimiento → consentimiento |

### Soporte, avisos y trazabilidad

| Tabla | Columnas | Llave primaria | Llaves foráneas |
|---|---|---|---|
| `notificacion` | 8 | id_notificacion | id_usuario → usuario |
| `auditoria` | 7 | id_auditoria | id_usuario → usuario |
| `log_error` | 8 | id_log | id_usuario → usuario |
| `ticket_soporte` | 8 | id_ticket | id_usuario → usuario |
| `configuracion` | 2 | clave | — |

## Relaciones (llaves foráneas)

| Tabla hija | Columna | Tabla padre | Cardinalidad (padre : hija) | Al borrar el padre |
|---|---|---|---|---|
| `token_recuperacion` | `id_usuario` | `usuario` | 1 : 0..N | CASCADE |
| `ficha` | `id_periodo` | `periodo` | 1 : 0..N | NO ACTION |
| `ficha` | `id_instructor` | `usuario` | 1 : 0..N | NO ACTION |
| `matricula` | `id_aprendiz` | `usuario` | 1 : 0..N | NO ACTION |
| `matricula` | `id_ficha` | `ficha` | 1 : 0..N | NO ACTION |
| `ambiente` | `id_periodo` | `periodo` | 0..1 : 0..N | NO ACTION |
| `dispositivo` | `id_ambiente` | `ambiente` | 0..1 : 0..N | NO ACTION |
| `resultado_aprendizaje` | `id_competencia` | `competencia` | 1 : 0..N | CASCADE |
| `tematica` | `id_rap` | `resultado_aprendizaje` | 1 : 0..N | CASCADE |
| `programacion_trimestre` | `id_ficha` | `ficha` | 1 : 0..N | CASCADE |
| `programacion_trimestre` | `id_competencia` | `competencia` | 1 : 0..N | CASCADE |
| `programacion_trimestre` | `id_instructor` | `usuario` | 1 : 0..N | NO ACTION |
| `horario` | `id_ficha` | `ficha` | 1 : 0..N | NO ACTION |
| `horario` | `id_ambiente` | `ambiente` | 1 : 0..N | NO ACTION |
| `horario` | `id_instructor` | `usuario` | 1 : 0..N | NO ACTION |
| `horario` | `id_periodo` | `periodo` | 1 : 0..N | NO ACTION |
| `horario` | `id_rap` | `resultado_aprendizaje` | 0..1 : 0..N | NO ACTION |
| `horario` | `id_tematica` | `tematica` | 0..1 : 0..N | NO ACTION |
| `horario` | `id_competencia` | `competencia` | 0..1 : 0..N | NO ACTION |
| `sesion_clase` | `id_horario` | `horario` | 1 : 0..N | NO ACTION |
| `sesion_clase` | `cerrada_por` | `usuario` | 0..1 : 0..N | NO ACTION |
| `asistencia` | `id_sesion` | `sesion_clase` | 1 : 0..N | NO ACTION |
| `asistencia` | `id_aprendiz` | `usuario` | 1 : 0..N | NO ACTION |
| `asistencia` | `registrado_por` | `usuario` | 0..1 : 0..N | NO ACTION |
| `cambio_asistencia` | `id_asistencia` | `asistencia` | 1 : 0..N | NO ACTION |
| `cambio_asistencia` | `cambiado_por` | `usuario` | 0..1 : 0..N | NO ACTION |
| `consentimiento` | `id_aprendiz` | `usuario` | 1 : 0..N | NO ACTION |
| `plantilla_biometrica` | `id_aprendiz` | `usuario` | 1 : 0..1 | NO ACTION |
| `plantilla_biometrica` | `id_consentimiento` | `consentimiento` | 1 : 0..N | NO ACTION |
| `justificacion` | `id_asistencia` | `asistencia` | 1 : 0..1 | NO ACTION |
| `justificacion` | `validada_por` | `usuario` | 0..1 : 0..N | NO ACTION |
| `notificacion` | `id_usuario` | `usuario` | 1 : 0..N | NO ACTION |
| `auditoria` | `id_usuario` | `usuario` | 0..1 : 0..N | NO ACTION |
| `ticket_soporte` | `id_usuario` | `usuario` | 1 : 0..N | NO ACTION |
| `busqueda_guardada` | `id_usuario` | `usuario` | 1 : 0..N | NO ACTION |
| `log_error` | `id_usuario` | `usuario` | 0..1 : 0..N | SET NULL |

## Reglas de integridad destacadas

- **Una huella por aprendiz:** `plantilla_biometrica.id_aprendiz` es único, y cada plantilla exige un `consentimiento` (Ley 1581/2012).
- **Una justificación por inasistencia:** `justificacion.id_asistencia` es único y su `token` también.
- **Una marca por aprendiz y clase:** `asistencia (id_sesion, id_aprendiz)` es único; la sesión es única por `(id_horario, fecha)`.
- **Un lector por ambiente:** índice único parcial `idx_dispositivo_ambiente_unico`; el `serial` del lector también es único.
- **Una matrícula activa por aprendiz:** índice único parcial `idx_matricula_activa_unica`.
- **Horarios sin duplicar:** `idx_horario_sin_duplicados` sobre ficha, día, horas y trimestre; además `hora_fin > hora_inicio`.
- **Estados controlados con CHECK:** asistencia (presente, tardanza, ausente, justificada), método (huella, manual, sistema), sesión (activa, cerrada), justificación, dispositivo, ficha, matrícula, usuario y rol.
- **Borrado en cascada solo en el currículo** (competencia → RAP → temática, programación) y en los tokens de recuperación; el resto de relaciones protege la historia de asistencia (NO ACTION).
