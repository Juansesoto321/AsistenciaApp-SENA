# AsistenciaApp 🫆

**Sistema de Control de Asistencia con Lector de Huella Digital**
SENA · Análisis y Desarrollo de Software · Bogotá D.C. · 2026

Plataforma web que automatiza el registro de asistencia de aprendices mediante lectores biométricos de huella (ZKTeco), con supervisión en tiempo real, gestión de justificaciones con ventana de 72 horas y cumplimiento de la Ley 1581/2012 (cifrado AES-256 de plantillas biométricas, consentimiento informado y derecho al borrado).

---

## Arquitectura

```
┌─────────────┐  PUSH (HTTP)   ┌──────────────┐  Socket.IO   ┌──────────────┐
│ Lector real │ ─────────────► │   Backend    │ ───────────► │  Frontend    │
│ SenseFace 2A│  marcaciones   │ Node/Express │  tiempo real │  React+Vite  │
└─────────────┘  + heartbeat   └──────┬───────┘              └──────────────┘
                                      │ pg
                               ┌──────▼───────┐
                               │ PostgreSQL 16│
                               └──────────────┘
```

### Backend en capas

**Todo** el backend sigue este flujo unidireccional:

`rutas -> controladores -> servicios -> modelos -> PostgreSQL`

- `rutas/`: define URLs, método HTTP, autenticación y autorización. Sin lógica.
- `controladores/`: leen la petición y arman la respuesta; los errores se
  delegan con `next(error)`.
- `servicios/`: reglas de negocio, validaciones y transacciones. No conocen
  `req` ni `res`.
- `modelos/`: único lugar donde se ejecuta SQL (la "capa de modelos" de la Guía 6).
- `utilidades/`: piezas compartidas sin estado (errores de negocio, formato de
  correos y CSV).
- `config/`: carga y valida el `.env` (`entorno.js`) y crea la conexión (`db.js`).

El manejo de errores está centralizado en `middleware/manejadorErrores.js`: los
servicios lanzan errores marcados con un `tipo` (`validacion`, `no_encontrado`,
`prohibido`…) y ese middleware los traduce a códigos HTTP en un solo sitio.
Todo error inesperado responde 500 y queda registrado en la tabla `log_error`,
consultable en `/api/logs`.

| Componente | Tecnología | Carpeta |
|---|---|---|
| Base de datos | PostgreSQL 16 (19 tablas) | `db/` |
| Backend / API REST | Node.js 20 + Express + Socket.IO + JWT + Nodemailer | `backend/` |
| Frontend | React 18 + Vite + React Router | `frontend/` |
| Simulador del lector | Node.js (CLI, emula protocolo PUSH de ZKTeco) | `simulador-lector/` |

---

## Opción A · Ejecución local (desarrollo y sustentación)

Requisitos: **Node.js 20+** y **PostgreSQL 14+**.

```bash
# 1. Crear la base de datos
psql -U postgres -c "CREATE DATABASE asistenciaapp;"

# 2. Backend
cd backend
cp .env.example .env        # revisar DATABASE_URL si tu contraseña no es "postgres"
npm install
npm run sembrar             # esquema + datos de demostración (muestra las cuentas al final)
npm run dev                 # http://localhost:4000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173

# 4. Simulador del lector (otra terminal)
cd simulador-lector
node simulador.js           # escribe el documento del aprendiz = poner el dedo
```

## Opción B · Docker (despliegue)

Requisito: Docker con el plugin Compose.

```bash
docker compose up -d --build
docker compose exec backend npm run sembrar   # solo la primera vez (datos de demostración)
# Aplicación: http://localhost:8080
# Simulador apuntando al despliegue:
node simulador-lector/simulador.js http://localhost:8080
```

### En un servidor real (producción)

Un servidor real **no lleva datos de demostración**: sus cuentas tienen contraseñas
públicas (están en el código). Crea un archivo `.env` junto al compose con
`NODE_ENV=production`, `JWT_SECRETO` y `CLAVE_CIFRADO` propios (64 hex), `URL_FRONTEND`
(dirección pública, usada en los correos) y las credenciales SMTP (`CORREO_HOST`,
`CORREO_USUARIO`, `CORREO_CONTRASENA`). Con `NODE_ENV=production` el backend no arranca
con las claves de ejemplo y `npm run sembrar` se niega a correr.

```bash
docker compose up -d --build
docker compose exec backend npm run migrar              # esquema y migraciones, sin datos
docker compose exec backend npm run crear-coordinador   # primera cuenta; la contraseña se muestra una vez
```

El coordinador crea después las demás cuentas desde **Usuarios**. Para dar una contraseña
nueva y aleatoria a una cuenta (por ejemplo, si el coordinador perdió el acceso):
`docker compose exec backend npm run nueva-clave -- correo@sena.edu.co`.

Sin SMTP, los correos se imprimen en la consola del backend (útil para la demo).

### Adjuntos de justificaciones

Los soportes se almacenan en la base de datos, en `justificacion.archivo_datos`, como
data URI en base64; no se crea una carpeta de imágenes en el backend. Se consultan
mediante `GET /api/justificaciones/:id/archivo` (requiere rol instructor, coordinador o programador).
Se aceptan `.jpg`, `.jpeg`, `.png`, `.webp` y `.pdf`, con un límite de 5 MB en la interfaz.
El límite HTTP del backend es de 10 MB para permitir la codificación base64.

### Actualizar una instalación existente

`npm run migrar` aplica el esquema y **todas** las migraciones de `db/migraciones/`
en orden (`001_`, `002_`…). Son idempotentes, así que sirve igual para una base nueva
que para una existente, y nunca crea cuentas ni datos.
Con Docker: `docker compose exec backend npm run migrar`.

Los roles son `coordinador`, `programador`, `instructor` y `aprendiz`. El programador
tiene las mismas atribuciones del coordinador **salvo administrar usuarios**. Las clases
y las justificaciones solo las **consulta**: no las inicia, no las cierra, no registra
asistencia a mano ni aprueba o rechaza justificaciones (eso es del instructor y la coordinación).

Las fichas pasan automáticamente a `finalizada` cuando termina su `fecha_fin`; sus
matrículas activas también se marcan como `finalizada`.

### Plan de formación por trimestres

Como en el SENA, cada ficha tiene sus trimestres (7 por defecto en un tecnólogo) y en
cada uno se programan competencias con su instructor; la misma competencia puede
repetirse en otro trimestre con el mismo o con otro instructor. Se arma en
**Fichas → (ficha) → Plan por trimestres**. El trimestre en curso se calcula desde la
fecha de inicio de la ficha (tres meses por trimestre).

Cada clase (horario) pertenece a un **trimestre de la ficha** y solo se repite entre
las fechas de ese trimestre; la competencia es obligatoria (el resultado de
aprendizaje y la temática, opcionales). El formulario sigue el orden ficha →
trimestre → qué se ve → quién y dónde → cuándo: las competencias del plan salen
primero y sugieren su instructor, las horas se proponen según la jornada de la ficha
y se pueden marcar varios días a la vez. Los cruces se revisan por instructor,
ambiente **y ficha**, solo entre clases cuyas fechas se traslapan (la vista
`horario_vigencia` calcula esas fechas). Los horarios creados antes de los
trimestres siguen valiendo durante todo su periodo.

### Copias de seguridad

El servicio `respaldos` de `docker-compose.yml` copia la base de datos al arrancar y
luego una vez al día, en la carpeta `respaldos/` del proyecto (no se sube a Git). Cada
copia es un archivo `asistenciaapp_AAAA-MM-DD_HHMM.sql.gz` y se guardan las de los
últimos 14 días. Se ajusta con `RESPALDO_CADA_HORAS` y `RESPALDO_DIAS` en el `.env`.

```bash
# Hacer una copia en este momento
docker compose exec respaldos /respaldar.sh ahora
# Ver las copias disponibles
docker compose exec respaldos /restaurar.sh
# Restaurar una copia (reemplaza TODOS los datos actuales)
docker compose stop backend
docker compose exec respaldos /restaurar.sh asistenciaapp_2026-10-13_0300.sql.gz
docker compose start backend
```

Para no perder las copias si se daña el equipo, conviene llevar la carpeta `respaldos/`
a otro disco o a la nube de vez en cuando.

### Registro del sistema y auditoría

Coordinación ve en **Administración → Registro del sistema** quién hizo qué y cuándo
(inicios de sesión, cambios de asistencia, aprobaciones, horarios, huellas,
configuración, exportaciones de reportes…) y los errores del servidor. Los reportes
en Excel y PDF se arman en el navegador y avisan al servidor
(`POST /api/reportes/exportaciones`) para que también queden registrados.

### Sesión y apariencia

La sesión dura 8 horas, pero se renueva sola mientras la persona sigue usando la app
(`POST /api/auth/renovar` cuando le quedan menos de 2 horas). Al renovarse se vuelve a
leer el usuario: si lo desactivaron, ya no entra. Cada persona elige en **Mi perfil**
el tema claro, oscuro o el de su equipo, y en el menú puede dejar solo los íconos.

## Opción C · Nube gratuita (Render / Railway)

1. Sube el repositorio a GitHub.
2. Crea un PostgreSQL gestionado y copia su `DATABASE_URL`.
3. Despliega `backend/` como Web Service (comando `npm start`) con las variables del `.env.example`.
4. Despliega `frontend/` como Static Site (build `npm run build`, carpeta `dist`) y configura el rewrite `/api/*` y `/socket.io/*` hacia la URL del backend.

---

## Cuentas de demostración

Las crea `npm run sembrar` (solo fuera de producción):

| Rol | Correo | Contraseña |
|---|---|---|
| Coordinador | admin@sena.edu.co | Admin123* |
| Programador | programador@sena.edu.co | Programador123* |
| Instructor | cristian.buitrago@sena.edu.co | Instructor123* |
| Aprendiz | camilap.m1230@gmail.com | Aprendiz123* |
| Aprendiz | becerravillalobos08@gmail.com | Aprendiz123* |
| Aprendiz | juansesoto321@gmail.com | Aprendiz123* |
| Aprendiz | santibermudez0656@gmail.com | Aprendiz123* |
| Aprendiz | hernandomendezlol@gmail.com | Aprendiz123* |

**Lector sembrado:** serial `LECTOR-001`, clave API `clave-simulador-demo`, ambiente 201, ficha 3311983.

En el servidor real no se siembran estas cuentas: la primera se crea con
`npm run crear-coordinador`. Para darle una contraseña nueva a cualquier cuenta:
`npm run nueva-clave -- <correo>`.

## Guion de demostración (5 minutos)

1. **Admin** → Fichas → ficha 3311983 → *Enrolar huella* de un aprendiz (consentimiento → 2 capturas → plantilla cifrada AES-256).
2. **Instructor** → Sesiones de hoy → *Iniciar sesión de hoy* → queda en la vista de supervisión en vivo.
3. En el **simulador**, escribe el documento del aprendiz (ej. `1016716963`): la fila se actualiza **en tiempo real** con presente/tardanza según los 15 min de tolerancia. Prueba `9999999999` para ver la alerta de huella no reconocida.
4. Registra a otro aprendiz con **Registro manual** (motivo obligatorio, queda en auditoría).
5. **Cerrar sesión de clase** (el diálogo avisa cuántos quedarán ausentes): los no marcados quedan ausentes y en la consola del backend aparece el **correo simulado** con el enlace de justificación (72 h).
6. Abre ese enlace `/justificar/<token>` en el navegador → envía la excusa con adjunto.
7. **Instructor** → Justificaciones → *Aprobar* → la ausencia pasa a **justificada**.
8. **Aprendiz** (Julieth Camila) → *Mi asistencia*: anillo de porcentaje y alerta si baja del 80 %.

## Del simulador al lector real

El backend expone dos contratos que puede consumir un dispositivo:

- **Simulado** (`/api/lector/heartbeat` y `/api/lector/marcacion`, autenticado con `x-serial` + `x-clave-api`) → lo implementa por consola `simulador-lector/simulador.js`, útil para demostrar el sistema sin hardware.
- **Real** (`/iclock/*`) → adaptador propio del protocolo propietario **PUSH/ADMS de ZKTeco**, en `backend/src/rutas/adms.js`. Ya integrado y probado con un **ZKTeco SenseFace 2A** (huella + rostro) real: el equipo hace el matching biométrico por sí mismo y solo envía el PIN del usuario ya identificado, que el backend hace corresponder con el número de documento (`usuario.documento`). El backend nunca recibe ni guarda una huella o rostro real, solo el evento ya identificado.

El aprendiz se matricula en el propio dispositivo usando como PIN su número de documento; el enrolamiento biométrico en sí (capturar el dedo o el rostro) se hace directamente en el equipo, no desde esta plataforma web.

**Hora de cada marca.** El lector envía con cada marca la hora en que se hizo (hora local del equipo, zona -5) y el backend usa esa hora, no la de llegada. Si el equipo pierde la red y reenvía las marcas después:

- cada marca se asigna a la clase que estaba abierta en ese ambiente **a esa hora**, y presente o tardanza se calcula con esa hora;
- si la clase ya se cerró y el aprendiz había quedado *ausente* por el cierre, pasa a presente o tardanza, se borra el enlace de justificación que aún no usó, se le avisa y el cambio queda en el historial (`cambio_asistencia`, con `cambiado_por` en NULL = el lector);
- si alguien ya corrigió esa asistencia a mano, la marca atrasada no la cambia;
- los reenvíos del mismo lote no duplican nada (una asistencia por aprendiz y clase).

Por eso conviene que el reloj del lector esté en hora. Si va adelantado más de 5 minutos, el backend usa su propia hora.

## Seguridad y Ley 1581/2012

- La huella **nunca** se guarda: solo una plantilla matemática cifrada con **AES-256-GCM** (clave fuera de la BD, en variable de entorno).
- **Consentimiento informado** versionado y auditable antes del enrolamiento; sin él, el aprendiz usa registro manual.
- **Derecho al borrado** (CU-11): elimina la plantilla de forma permanente conservando el historial académico.
- Contraseñas con **bcrypt**, sesiones **JWT** (8 h), bloqueo tras **5 intentos** fallidos, y **auditoría** de todas las acciones sensibles.
- **Límite de peticiones por IP** en inicio de sesión, registro y recuperación de contraseña (frena la fuerza bruta y el envío masivo de correos), y como máximo 3 correos de recuperación por hora por cuenta.
- El canal de **tiempo real** (Socket.IO) exige el mismo token de la API: el rol sale del token, y solo el instructor titular o la coordinación pueden seguir una clase en vivo.
- Pasadas **24 horas** del cierre de una sesión, solo la coordinación puede corregir la asistencia (RF-35).
- **CORS** limitado a `URL_FRONTEND` y encabezados HTTP de seguridad en el backend y en nginx.
- Con `NODE_ENV=production` el servidor **se niega a arrancar** si `JWT_SECRETO` o `CLAVE_CIFRADO` tienen los valores de ejemplo (son públicos: están en el repositorio), y no se pueden crear las cuentas de demostración.
- Las cuentas que se crean desde la consola (`crear-coordinador`, `nueva-clave`) reciben una contraseña **aleatoria** que se muestra una sola vez y queda en la auditoría.

## Pruebas automáticas

```bash
cd backend
npm test
```

- **Unitarias** (`tests/unitarias/`): reglas sin base de datos — tardanza (incluida la
  clase nocturna), política de contraseñas, configuración, lector de CSV, manejador de
  errores y límite de peticiones.
- **Integración** (`tests/integracion/`): levantan la API real contra una base aparte,
  `asistenciaapp_pruebas`, que se crea y se borra en cada corrida (nunca se toca la base
  de desarrollo). Recorren el ciclo completo de una clase: login y bloqueo, horarios,
  iniciar sesión, marcar con huella, registro manual, cierre con ausentes, justificación
  vencida, permisos por rol y exportación CSV.
- En pruebas **nunca se envían correos** (`NODE_ENV=test`).
- Si no hay PostgreSQL disponible, las de integración se omiten en vez de fallar. Para
  usar otro servidor define `DATABASE_URL_PRUEBAS`.

## Estructura del proyecto

```
asistenciaapp/
├── db/
│   ├── init.sql                 # Esquema completo + configuración inicial
│   ├── semilla.sql
│   ├── migraciones/             # 001_logs … 007_soporte_captura (idempotentes, se aplican en orden)
│   └── respaldos/               # respaldar.sh y restaurar.sh (servicio "respaldos" de Docker)
├── backend/
│   ├── src/
│   │   ├── app.js               # Punto de entrada: middlewares, rutas y servidor
│   │   ├── config/              # entorno.js (valida el .env, zona horaria) y db.js
│   │   ├── rutas/               # Solo URLs, método HTTP y autorización
│   │   ├── controladores/       # Leen la petición y responden; delegan con next(error)
│   │   ├── servicios/           # Reglas de negocio (no conocen req ni res)
│   │   ├── modelos/             # Único lugar que toca la base de datos
│   │   ├── middleware/          # autenticar, autenticarDispositivo, seguridad, manejadorErrores
│   │   ├── utilidades/          # errores de negocio, formato (HTML de correos, CSV, fechas)
│   │   └── scripts/             # migrar (esquema), sembrar (solo demo), crear-coordinador, nueva-clave
│   └── tests/                   # npm test: unitarias/ e integracion/
├── frontend/src/
│   ├── App.jsx                  # Rutas y permisos por rol
│   ├── paginas/
│   │   ├── acceso/              # Login, registro, restablecer, justificar (públicas)
│   │   ├── general/             # Panel, notificaciones, soporte, perfil
│   │   ├── academico/           # Fichas, ambientes, horarios, competencias
│   │   ├── asistencia/          # Sesiones, supervisión en vivo, justificaciones, reportes
│   │   └── administracion/      # Usuarios, configuración
│   ├── componentes/             # Diseño (menú adaptable al celular), iconos SVG, diálogos,
│   │                            # avisos flotantes, estados vacíos, anillo de asistencia
│   ├── contexto/                # Sesión del usuario (AuthContext)
│   ├── servicios/               # api.js (HTTP) y socket.js (tiempo real)
│   └── utilidades/              # fechas de los horarios (próxima clase) y formato de textos
├── simulador-lector/simulador.js
└── docker-compose.yml
```

El flujo es unidireccional, según la Guía 6 del programa:
`Cliente HTTP → rutas → controladores → servicios → modelos → BD`
