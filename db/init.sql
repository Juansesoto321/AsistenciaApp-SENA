-- ============================================================
-- AsistenciaApp · Esquema de Base de Datos PostgreSQL
-- Sistema de Control de Asistencia con Lector de Huella Digital
-- SENA · Análisis y Desarrollo de Software · 2026
-- ============================================================

-- ---------- USUARIOS Y AUTENTICACIÓN ----------

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario        SERIAL PRIMARY KEY,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  tipo_documento    VARCHAR(10)  NOT NULL DEFAULT 'CC',
  documento         VARCHAR(20)  NOT NULL UNIQUE,
  correo            VARCHAR(150) NOT NULL UNIQUE,
  telefono          VARCHAR(20),
  contrasena_hash   VARCHAR(255) NOT NULL,
  rol               VARCHAR(20)  NOT NULL CHECK (rol IN ('coordinador','programador','instructor','aprendiz')),
  estado            VARCHAR(20)  NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','pendiente','inactivo','bloqueado')),
  intentos_fallidos INTEGER      NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_recuperacion (
  id_token    SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  token       VARCHAR(100) NOT NULL UNIQUE,
  expira_en   TIMESTAMPTZ NOT NULL,          -- 1 hora (regla CU-02)
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- ESTRUCTURA ACADÉMICA ----------

CREATE TABLE IF NOT EXISTS periodo (
  id_periodo   SERIAL PRIMARY KEY,
  nombre       VARCHAR(50) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE IF NOT EXISTS ficha (
  id_ficha      SERIAL PRIMARY KEY,
  numero_ficha  VARCHAR(20) NOT NULL UNIQUE,
  programa      VARCHAR(150) NOT NULL,
  jornada       VARCHAR(20) NOT NULL CHECK (jornada IN ('mañana','tarde','noche','mixta')),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  id_periodo    INTEGER NOT NULL REFERENCES periodo(id_periodo),
  id_instructor INTEGER NOT NULL REFERENCES usuario(id_usuario), -- instructor titular (regla CU-05)
  estado        VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','finalizada')),
  trimestres    INTEGER NOT NULL DEFAULT 7 CHECK (trimestres BETWEEN 1 AND 12), -- ADSO: 6 lectivos + productiva
  CHECK (fecha_fin > fecha_inicio)
);

-- Matrícula: relación aprendiz-ficha con historial (corrige el modelo anterior
-- donde APRENDIZ tenía id_ficha directo)
CREATE TABLE IF NOT EXISTS matricula (
  id_matricula    SERIAL PRIMARY KEY,
  id_aprendiz     INTEGER NOT NULL REFERENCES usuario(id_usuario),
  id_ficha        INTEGER NOT NULL REFERENCES ficha(id_ficha),
  estado          VARCHAR(20) NOT NULL DEFAULT 'activa'
                  CHECK (estado IN ('activa','retirada','finalizada')),
  fecha_matricula TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_aprendiz, id_ficha)
);
-- Regla de negocio CU-06: un aprendiz solo puede tener UNA matrícula activa
CREATE UNIQUE INDEX IF NOT EXISTS idx_matricula_activa_unica
  ON matricula (id_aprendiz) WHERE estado = 'activa';

-- ---------- AMBIENTES Y DISPOSITIVOS (CU-07, CU-09) ----------

CREATE TABLE IF NOT EXISTS ambiente (
  id_ambiente     SERIAL PRIMARY KEY,
  numero_ambiente VARCHAR(20) NOT NULL,
  sede_centro     VARCHAR(150) NOT NULL,
  id_periodo      INTEGER REFERENCES periodo(id_periodo),
  estado          VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo'))
);

CREATE TABLE IF NOT EXISTS dispositivo (
  id_dispositivo   SERIAL PRIMARY KEY,
  serial           VARCHAR(50) NOT NULL UNIQUE,
  modelo           VARCHAR(80) NOT NULL DEFAULT 'ZKTeco SenseFace 2A (simulado)',
  id_ambiente      INTEGER REFERENCES ambiente(id_ambiente),
  clave_api        VARCHAR(100) NOT NULL,   -- autentica al dispositivo ante el backend
  estado           VARCHAR(20) NOT NULL DEFAULT 'no_verificado'
                   CHECK (estado IN ('en_linea','fuera_de_linea','no_verificado')),
  ultimo_heartbeat TIMESTAMPTZ
);
-- Regla CU-07: un lector solo puede estar en un ambiente activo a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispositivo_ambiente_unico
  ON dispositivo (id_ambiente) WHERE id_ambiente IS NOT NULL;

-- ---------- ESTRUCTURA CURRICULAR ----------
-- Competencia -> Resultados de Aprendizaje (RAP) -> Temáticas.
-- Un mismo RAP se dicta en varios trimestres con temáticas distintas.

CREATE TABLE IF NOT EXISTS competencia (
  id_competencia SERIAL PRIMARY KEY,
  codigo         VARCHAR(30),
  nombre         VARCHAR(300) NOT NULL UNIQUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resultado_aprendizaje (
  id_rap         SERIAL PRIMARY KEY,
  id_competencia INTEGER NOT NULL REFERENCES competencia(id_competencia) ON DELETE CASCADE,
  codigo         VARCHAR(30) NOT NULL UNIQUE,
  nombre         TEXT NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tematica (
  id_tematica SERIAL PRIMARY KEY,
  id_rap      INTEGER NOT NULL REFERENCES resultado_aprendizaje(id_rap) ON DELETE CASCADE,
  nombre      VARCHAR(200) NOT NULL,
  UNIQUE (id_rap, nombre)
);

-- Plan de formación por trimestre: qué competencias ve cada ficha en cada uno
-- de sus trimestres y con qué instructor. La misma competencia puede repetirse
-- en otro trimestre, con el mismo o con otro instructor.
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

-- ---------- HORARIOS Y SESIONES (CU-08, CU-12) ----------

CREATE TABLE IF NOT EXISTS horario (
  id_horario    SERIAL PRIMARY KEY,
  id_ficha      INTEGER NOT NULL REFERENCES ficha(id_ficha),
  id_ambiente   INTEGER NOT NULL REFERENCES ambiente(id_ambiente),
  id_instructor INTEGER NOT NULL REFERENCES usuario(id_usuario),
  id_periodo    INTEGER NOT NULL REFERENCES periodo(id_periodo),
  dia_semana    INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  hora_inicio   TIME NOT NULL,
  hora_fin      TIME NOT NULL,
  id_rap        INTEGER REFERENCES resultado_aprendizaje(id_rap),   -- qué se dicta en este bloque
  id_tematica   INTEGER REFERENCES tematica(id_tematica),
  id_competencia INTEGER REFERENCES competencia(id_competencia),
  trimestre     INTEGER CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 12), -- NULL: vale todo el periodo
  CHECK (hora_fin > hora_inicio)
);
-- La vista horario_vigencia (fechas en que se repite cada horario) se crea en
-- db/migraciones/005_horarios_por_trimestre.sql.

CREATE TABLE IF NOT EXISTS sesion_clase (
  id_sesion     SERIAL PRIMARY KEY,
  id_horario    INTEGER NOT NULL REFERENCES horario(id_horario),
  fecha         DATE NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cerrada')),
  hora_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_cierre   TIMESTAMPTZ,
  cerrada_por   INTEGER REFERENCES usuario(id_usuario),
  UNIQUE (id_horario, fecha)
);

-- ---------- ASISTENCIA (CU-13, CU-15) ----------

CREATE TABLE IF NOT EXISTS asistencia (
  id_asistencia  SERIAL PRIMARY KEY,
  id_sesion      INTEGER NOT NULL REFERENCES sesion_clase(id_sesion),
  id_aprendiz    INTEGER NOT NULL REFERENCES usuario(id_usuario),
  estado         VARCHAR(20) NOT NULL
                 CHECK (estado IN ('presente','tardanza','ausente','justificada')),
  hora_marca     TIMESTAMPTZ,
  metodo         VARCHAR(20) NOT NULL DEFAULT 'huella' CHECK (metodo IN ('huella','manual','sistema')),
  observacion    TEXT,
  registrado_por INTEGER REFERENCES usuario(id_usuario), -- NULL si fue el lector
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_sesion, id_aprendiz)  -- regla CU-13: una asistencia por sesión y aprendiz
);

-- Historial inmutable de cambios (regla CU-15)
CREATE TABLE IF NOT EXISTS cambio_asistencia (
  id_cambio       SERIAL PRIMARY KEY,
  id_asistencia   INTEGER NOT NULL REFERENCES asistencia(id_asistencia),
  estado_anterior VARCHAR(20),
  estado_nuevo    VARCHAR(20) NOT NULL,
  motivo          TEXT NOT NULL,           -- todo registro manual requiere justificación
  cambiado_por    INTEGER NOT NULL REFERENCES usuario(id_usuario),
  fecha_cambio    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- BIOMETRÍA (CU-10, CU-11) · Ley 1581/2012 ----------

CREATE TABLE IF NOT EXISTS consentimiento (
  id_consentimiento SERIAL PRIMARY KEY,
  id_aprendiz       INTEGER NOT NULL REFERENCES usuario(id_usuario),
  version_texto     VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  aceptado          BOOLEAN NOT NULL,
  fecha_aceptacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revocado_en       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plantilla_biometrica (
  id_plantilla       SERIAL PRIMARY KEY,
  id_aprendiz        INTEGER NOT NULL UNIQUE REFERENCES usuario(id_usuario),
  plantilla_cifrada  TEXT NOT NULL,     -- template cifrado AES-256-GCM (nunca la huella original)
  iv                 VARCHAR(64) NOT NULL,
  etiqueta_auth      VARCHAR(64) NOT NULL,
  algoritmo          VARCHAR(30) NOT NULL DEFAULT 'aes-256-gcm',
  id_consentimiento  INTEGER NOT NULL REFERENCES consentimiento(id_consentimiento),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- JUSTIFICACIONES (CU-23, CU-24) · ventana de 72 horas ----------

CREATE TABLE IF NOT EXISTS justificacion (
  id_justificacion SERIAL PRIMARY KEY,
  id_asistencia    INTEGER NOT NULL UNIQUE REFERENCES asistencia(id_asistencia),
  token            VARCHAR(100) NOT NULL UNIQUE,  -- enlace enviado por correo
  expira_en        TIMESTAMPTZ NOT NULL,           -- 72 horas después de la ausencia
  tipo             VARCHAR(40) CHECK (tipo IN ('cita_medica','incapacidad_medica','calamidad_domestica','diligencia_legal','duelo','otro')),
  descripcion      TEXT,
  nombre_archivo   VARCHAR(255),
  archivo_datos    TEXT,                           -- adjunto en base64 (demo)
  estado           VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','enviada','aprobada','rechazada','vencida')),
  enviada_en       TIMESTAMPTZ,
  validada_por     INTEGER REFERENCES usuario(id_usuario),
  validada_en      TIMESTAMPTZ,
  observacion_validacion TEXT, -- motivo que da el instructor/admin, obligatorio al rechazar
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- NOTIFICACIONES, AUDITORÍA, SOPORTE ----------

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion SERIAL PRIMARY KEY,
  id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario),
  tipo            VARCHAR(40) NOT NULL,
  titulo          VARCHAR(150) NOT NULL,
  mensaje         TEXT NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria SERIAL PRIMARY KEY,
  id_usuario   INTEGER REFERENCES usuario(id_usuario),
  accion       VARCHAR(60) NOT NULL,
  entidad      VARCHAR(40),
  id_entidad   INTEGER,
  detalle      JSONB,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_soporte (
  id_ticket   SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario),
  tipo        VARCHAR(40) NOT NULL,
  descripcion TEXT NOT NULL,
  estado      VARCHAR(20) NOT NULL DEFAULT 'abierto'
              CHECK (estado IN ('abierto','en_proceso','resuelto')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS busqueda_guardada (
  id_busqueda SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario),
  nombre      VARCHAR(100) NOT NULL,
  filtros     JSONB NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(50) PRIMARY KEY,
  valor VARCHAR(100) NOT NULL
);

-- Registro de errores del backend: permite saber que fallo, cuando y en que ruta
CREATE TABLE IF NOT EXISTS log_error (
  id_log     SERIAL PRIMARY KEY,
  nivel      VARCHAR(10)  NOT NULL DEFAULT 'error'
             CHECK (nivel IN ('error','advertencia')),
  mensaje    TEXT         NOT NULL,
  metodo     VARCHAR(10),
  ruta       VARCHAR(255),
  id_usuario INTEGER      REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  traza      TEXT,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_asistencia_aprendiz ON asistencia(id_aprendiz);
CREATE INDEX IF NOT EXISTS idx_asistencia_sesion   ON asistencia(id_sesion);
CREATE INDEX IF NOT EXISTS idx_sesion_fecha        ON sesion_clase(fecha);
CREATE INDEX IF NOT EXISTS idx_notificacion_user   ON notificacion(id_usuario, leida);
CREATE INDEX IF NOT EXISTS idx_log_error_fecha     ON log_error(creado_en DESC);

-- ---------- CONFIGURACIÓN INICIAL ----------
INSERT INTO configuracion (clave, valor) VALUES
  ('minutos_tolerancia', '15'),
  ('porcentaje_minimo', '80'),
  ('horas_justificacion', '72'),
  ('nombre_institucion', 'SENA - CGMLTI')
ON CONFLICT (clave) DO NOTHING;
