# AsistenciaApp SENA 🫆

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

La base de datos queda disponible **solo en este computador** en `localhost:5433`
(variable `PUERTO_BD`), para conectarse con DBeaver o pgAdmin (usuario y clave
`postgres`, base `asistenciaapp`). No se abre a la red porque la clave es la de ejemplo.

### En un servidor real (producción)

Un servidor real **no lleva datos de demostración** y usa los ajustes de
`docker-compose.produccion.yml`: `NODE_ENV=production` (el backend no arranca con las
claves de ejemplo y `npm run sembrar` se niega a correr) y claves obligatorias.

1. Copia `.env.produccion.example` como `.env` y llénalo: `JWT_SECRETO` y `CLAVE_CIFRADO`
   propios, `URL_FRONTEND` (la dirección con la que se abre la aplicación), `IP_LECTORES`
   (IP de cada lector) y el correo SMTP. Si falta una clave, Docker se detiene con un
   mensaje en vez de usar las de ejemplo.
2. Levanta el sistema y crea la base y la primera cuenta:

```bash
docker compose -f docker-compose.yml -f docker-compose.produccion.yml up -d --build
docker compose exec backend npm run migrar              # esquema y migraciones, sin datos
docker compose exec backend npm run crear-coordinador   # primera cuenta; la contraseña se muestra una vez
```

El coordinador crea después las demás cuentas desde **Usuarios**. Para dar una contraseña
nueva y aleatoria a una cuenta (por ejemplo, si el coordinador perdió el acceso):
`docker compose exec backend npm run nueva-clave -- correo@sena.edu.co`.

Todos los servicios tienen `restart: unless-stopped`: si el servidor se reinicia o un
proceso se cae, vuelven a arrancar solos.

**HTTPS.** Hay dos casos:
- **El SENA publica el sistema detrás de su propio proxy con HTTPS:** no hay que hacer
  nada más; su proxy envía el tráfico al puerto web (8080) de este servidor.
- **Este servidor tiene el certificado:** pon `fullchain.pem` y `privkey.pem` en la
  carpeta `certificados/` (Git la ignora) y agrega el tercer archivo:
  `docker compose -f docker-compose.yml -f docker-compose.produccion.yml -f docker-compose.https.yml up -d --build`.
  Así nginx atiende por el 443 con TLS 1.2/1.3 y HSTS, y redirige el 80 a HTTPS
  (requiere Docker Compose 2.24 o superior).

**Puertos.** Hacia internet solo se publica el puerto web. El **4000** es solo para los
lectores: el protocolo del lector no tiene clave (se identifica con su serial), así que
el backend únicamente acepta marcas de las IP de `IP_LECTORES`, y conviene que el
firewall del servidor deje entrar al 4000 solo desde la red de los lectores. Si una marca
se rechaza, el registro del backend muestra la IP desde la que llegó.

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

La carga curricular CF11 de ADSO (7 competencias y 27 resultados de aprendizaje) está
en `docs/competencias_cf11.csv`: se pega tal cual en **Competencias → Carga masiva**.
Si se vuelve a cargar no duplica nada.

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
Quien todavía no ha elegido ve el tema claro; las pantallas de acceso (inicio de
sesión, registro, recuperar contraseña) son siempre oscuras.

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

## Demostración en vivo: clase de demostración

Para mostrar la app con el lector real y los aprendices que tienen la huella registrada en
él, el instructor (o la coordinación) tiene en **Mis clases de hoy** el bloque *Clase de
demostración* con un botón temporal:

1. **Crear / Reiniciar clase de demostración** → crea una clase de hoy que empieza en ese
   minuto y dura dos horas, con los aprendices de su ficha, en el ambiente del lector (el que
   está en línea). Sale en la lista con la etiqueta *demostración*.
2. **Iniciar sesión de hoy** en esa clase → queda la supervisión en vivo.
3. Los aprendices ponen la huella: su fila pasa a *presente* en tiempo real.
4. **Cerrar sesión de clase** → los que no marcaron quedan *ausentes* y les llega el correo
   con el enlace para justificar.
5. Para mostrarlo otra vez: **Reiniciar clase de demostración**. Borra esa clase con sus
   huellas, ausencias, justificaciones y avisos, y crea otra que empieza ya. Las demás clases
   no se tocan.

Los correos llegan de verdad solo si el `.env` tiene `CORREO_HOST` (y usuario y contraseña
del SMTP); sin él, se imprimen en la consola del backend (`docker compose logs backend`).
El botón está activo en todo menos en producción; se apaga con `CLASE_DEMO=false` en el
`.env`.

**Sin lector a mano:** el simulador (`node simulador-lector/simulador.js`) marca con el
documento del aprendiz si antes se le enroló la huella (Fichas → *Enrolar huella*).

## Cierre automático de clases

Si nadie cierra la clase, el backend la cierra solo cuando termina: al pasar la hora de fin del horario más los *minutos después del fin para marcar* (Configuración, 10 por defecto), que es cuando el lector deja de aceptar huellas para esa clase. Lo revisa cada minuto y hace lo mismo que el cierre manual:

- los aprendices que no marcaron quedan ausentes y reciben por correo el enlace para justificar (sin `CORREO_HOST`, el correo solo se imprime en la consola del backend);
- la clase empieza a contar en reportes y porcentajes, que solo tienen en cuenta clases cerradas;
- queda en la auditoría como `cerrar_sesion_clase` sin usuario y con `automatico: true`, y en la sesión `cerrada_por` queda en NULL;
- si el instructor tiene abierta la clase en vivo, la pantalla se actualiza sola.

Una clase que se abre cuando ya terminó, por ejemplo para registrar a mano una clase que nadie inició, no se cierra en el acto: espera hasta el día siguiente.

## Del simulador al lector real

El backend expone dos contratos que puede consumir un dispositivo:

- **Simulado** (`/api/lector/heartbeat` y `/api/lector/marcacion`, autenticado con `x-serial` + `x-clave-api`) → lo implementa por consola `simulador-lector/simulador.js`, útil para demostrar el sistema sin hardware.
- **Real** (`/iclock/*`) → adaptador propio del protocolo propietario **PUSH/ADMS de ZKTeco**, en `backend/src/rutas/adms.js`. Ya integrado y probado con un **ZKTeco SenseFace 2A** (huella + rostro) real: el equipo hace el matching biométrico por sí mismo y solo envía el PIN del usuario ya identificado, que el backend hace corresponder con el número de documento (`usuario.documento`). El backend nunca recibe ni guarda una huella o rostro real, solo el evento ya identificado.

El aprendiz se matricula en el propio dispositivo usando como PIN su número de documento; el enrolamiento biométrico en sí (capturar el dedo o el rostro) se hace directamente en el equipo, no desde esta plataforma web.

### Conectar el lector por WiFi, paso a paso

En la app: **Ambientes y lectores → Conectar un lector** (coordinación o programación). El
asistente muestra la IP y el puerto que hay que escribir en el lector, la lista de
aprendices con el documento que va como *User ID* y, en vivo, cuándo llama el lector: si es
nuevo, se asocia a un ambiente ahí mismo, sin escribir el serial. En resumen:

1. El lector y el computador en la **misma red WiFi** (mejor el hotspot de un celular o la
   *Zona con cobertura inalámbrica móvil* del computador: las redes públicas suelen aislar
   los equipos). En el lector: `M/OK › COMM. › Wi-Fi Settings`.
2. Doble clic en **`herramientas\preparar-lector.bat`**: abre el puerto del backend en el
   firewall de Windows (pide permiso de administrador) y muestra la IP del computador.
3. En el lector: `COMM. › PC Connection` → *HTTPS* apagado, y `COMM. › Cloud Server
   Settings` → *Enable Domain Name* apagado, *Server Address* = la IP, *Server Port* = el
   puerto (`PUERTO_API`: 4000, o 4100 en la copia) y *Enable Proxy Server* apagado. La hora en
   `System › Date Time` (GMT-05:00).
4. Cuando aparezca en el asistente, asociarlo al ambiente; registrar a cada aprendiz en
   `User Mgt. › New User` con su documento como *User ID* y su huella.
5. Probar con la clase de demostración.

Si `IP_LECTORES` tiene valores y el lector llama desde otra IP, el asistente lo muestra
para agregarla al `.env`.

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
├── docker-compose.yml
```

El flujo es unidireccional, según la Guía 6 del programa:
`Cliente HTTP → rutas → controladores → servicios → modelos → BD`
