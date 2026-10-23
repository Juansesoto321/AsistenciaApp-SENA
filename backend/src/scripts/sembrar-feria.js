/**
 * Datos FICTICIOS para el stand de la feria del SENA: una ficha con cuatro
 * semanas de clases ya cerradas, para que el panel, las gráficas y los
 * reportes tengan qué mostrar. Nombres, documentos y correos son inventados;
 * los correos usan example.com, un dominio reservado que no le llega a nadie.
 *
 * Inserta directo en la base, sin el flujo de cierre de clase, así que no se
 * envían correos ni avisos en vivo. Es para el entorno de la feria
 * (docker-compose.feria.yml), que lo corre al arrancar: se niega a tocar una
 * base que tenga alguna cuenta fuera de example.com (la de trabajo o la real).
 *
 * Uso (dentro del contenedor backend de la feria):
 *   npm run sembrar-feria                     base vacía: esquema + datos
 *   npm run sembrar-feria -- --reiniciar      borra todo y vuelve a sembrar con las fechas de hoy
 *   npm run sembrar-feria -- --clase-ahora    clase de demostración que empieza ahora
 */
const { produccion, urlFrontend } = require("../config/entorno");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { enTransaccion } = require("../modelos/transaccion");
const { cifrar, generarTemplateSimulado } = require("../servicios/cifrado");
const { festivoEn } = require("../utilidades/festivos");
const { fechaIso, fechaLarga, textoPlazo } = require("../utilidades/formato");
const { aplicarEsquema } = require("./migrar");

const DOMINIO = "@example.com";
const CLAVE = "Feria2026*"; // pública (está en este archivo y en el README): solo para la feria
const NUMERO_FICHA = "3141592";
const SEMANAS = 4;
const HORAS_PLAZO = 72; // igual que la configuración inicial (horas_justificacion)
const TEMATICA_EN_VIVO = "Demostración en vivo en la feria";
const MINUTOS_CLASE_EN_VIVO = 120;
const MOTIVO_MANUAL = "Aún no tiene la huella registrada: el instructor marca su asistencia";

const COORDINADOR = ["Gloria Patricia", "Ríos Cardona", "1090000001", "coordinacion"];
const INSTRUCTOR = ["Hernán Darío", "Montoya Salas", "1090000002", "instructor"];

// Cómo le fue a cada aprendiz en las cuatro semanas. `faltas` son sin
// justificar; quien tiene `bajoMinimo` falta a esa fracción de las clases, así
// queda bajo el 80 % sin importar cuántas clases salgan (festivos, día de la
// siembra). `faltoALaUltima`: su plazo para justificar puede seguir abierto.
const APRENDICES = [
  { nombres: "Valentina", apellidos: "Rojas Castaño", tardanzas: 1 },
  { nombres: "Andrés Felipe", apellidos: "Gómez Restrepo", justificadas: 1, tardanzas: 2 },
  { nombres: "María José", apellidos: "Herrera Patiño", faltas: 1 },
  { nombres: "Kevin Alexander", apellidos: "Morales Díaz", bajoMinimo: 0.3, justificadas: 1, tardanzas: 3, faltoALaUltima: true },
  { nombres: "Laura Sofía", apellidos: "Martínez Ospina", porRevisar: 1, tardanzas: 1 },
  { nombres: "Daniel Esteban", apellidos: "Vargas Quintero", faltas: 1, tardanzas: 5 },
  { nombres: "Sara Lucía", apellidos: "Cárdenas Mejía", justificadas: 2 },
  { nombres: "Juan David", apellidos: "Ramírez Londoño", bajoMinimo: 0.25, rechazadas: 1, tardanzas: 2 },
  { nombres: "Natalia Andrea", apellidos: "Suárez Pineda", tardanzas: 1 },
  { nombres: "Camilo Andrés", apellidos: "Torres Beltrán", porRevisar: 1, tardanzas: 2 },
  { nombres: "Isabella", apellidos: "Moreno Cifuentes" },
  { nombres: "Sebastián", apellidos: "Ortiz Guerrero", faltas: 1, tardanzas: 1, sinHuella: true },
  { nombres: "Paula Alejandra", apellidos: "Jiménez Rincón", justificadas: 1, rechazadas: 1 },
  { nombres: "Brayan Stiven", apellidos: "Castro Muñoz", bajoMinimo: 0.21, porRevisar: 1, tardanzas: 3 },
  { nombres: "Mariana", apellidos: "Salazar Arango", tardanzas: 2 },
  { nombres: "Nicolás", apellidos: "Rendón Valencia", faltas: 2, justificadas: 1 },
  { nombres: "Daniela", apellidos: "Gutiérrez Franco", justificadas: 1, tardanzas: 1 },
  { nombres: "Tomás", apellidos: "Aguilar Serna", faltas: 1, tardanzas: 3 },
];

const COMPETENCIAS = [
  {
    nombre: "Desarrollar la solución de software de acuerdo con el diseño y metodologías de desarrollo",
    rap: ["DS-RAP-03", "Codificar los módulos del software de acuerdo con el diseño y los estándares de la organización"],
    tematicas: ["Programación orientada a objetos con Java", "Pruebas unitarias", TEMATICA_EN_VIVO],
  },
  {
    nombre: "Construir la base de datos de la solución de software según el modelo de datos",
    rap: ["BD-RAP-02", "Implementar la base de datos con las consultas que necesita la solución"],
    tematicas: ["Consultas SQL y procedimientos almacenados"],
  },
  {
    nombre: "Desarrollar la interfaz web de la solución de software según el diseño",
    rap: ["WEB-RAP-01", "Construir componentes de interfaz web accesibles y adaptables"],
    tematicas: ["Componentes con React"],
  },
  {
    nombre: "Interactuar en lengua inglesa de forma oral y escrita en contextos sociales y laborales",
    rap: ["ING-RAP-04", "Comprender textos técnicos en inglés relacionados con el desarrollo de software"],
    tematicas: ["Inglés técnico: documentación de software"],
  },
];

// Jornada de la mañana, lunes a viernes (0 = domingo): qué se ve cada día
const SEMANA = [
  { dia: 1, inicio: "07:00", fin: "12:00", tematica: "Programación orientada a objetos con Java" },
  { dia: 2, inicio: "07:00", fin: "12:00", tematica: "Consultas SQL y procedimientos almacenados" },
  { dia: 3, inicio: "07:00", fin: "12:00", tematica: "Componentes con React" },
  { dia: 4, inicio: "07:00", fin: "12:00", tematica: "Pruebas unitarias" },
  { dia: 5, inicio: "07:00", fin: "11:00", tematica: "Inglés técnico: documentación de software" },
];

// Lo que cargaron los aprendices al justificar. `constancia`: lleva un PDF de soporte.
const SOPORTES = {
  justificada: [
    { tipo: "cita_medica", descripcion: "Cita de control con medicina general en la EPS.", constancia: "Cita de control con medicina general" },
    { tipo: "incapacidad_medica", descripcion: "Incapacidad de un día por virosis.", constancia: "Incapacidad médica por un día" },
    { tipo: "calamidad_domestica", descripcion: "Se inundó la casa con el aguacero y tuve que ayudar a mi familia a sacar el agua." },
    { tipo: "diligencia_legal", descripcion: "Citación en la Registraduría para el trámite de la cédula.", constancia: "Citación para trámite de documento de identidad" },
  ],
  rechazada: [
    { tipo: "cita_medica", descripcion: "Tenía cita médica.", constancia: "Consulta externa", diasAntes: 9,
      observacion: "La constancia es de otra fecha: no corresponde al día de la clase." },
    { tipo: "calamidad_domestica", descripcion: "Problemas en la casa.",
      observacion: "La descripción no explica qué pasó. Si necesitas apoyo, habla con tu instructor." },
  ],
  por_revisar: [
    { tipo: "cita_medica", descripcion: "Cita odontológica que tenía programada desde el mes pasado.", constancia: "Cita odontológica" },
    { tipo: "incapacidad_medica", descripcion: "Incapacidad por migraña; adjunto la constancia de la EPS.", constancia: "Incapacidad médica por un día" },
    { tipo: "duelo", descripcion: "Falleció mi abuela y estuve en el sepelio con mi familia." },
  ],
};

// ---------- Azar con semilla fija: cada siembra reparte las faltas igual ----------

let semilla = 2026;
function azar() { // mulberry32
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ---------- Fechas (hora local: entorno.js fija America/Bogota) ----------

const ahora = new Date();
const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
const sumarDias = (fecha, n) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + n);
const sumarHoras = (fecha, n) => new Date(fecha.getTime() + n * 3_600_000);
/** El día `dia` a la hora "HH:MM", corrida `minutos` (puede ser negativo). */
function aLas(dia, hhmm, minutos = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m + minutos);
}
/** La fecha, o un poco antes de ahora si cayera en el futuro. */
const antesDeAhora = (fecha, minutos) => new Date(Math.min(fecha.getTime(), ahora.getTime() - minutos * 60_000));
const hhmm = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const sinTildes = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
const correoDe = (nombres, apellidos) =>
  sinTildes(`${nombres.split(" ")[0]}.${apellidos.split(" ")[0]}`).toLowerCase() + DOMINIO;

/** Constancia en PDF de una página: el soporte (ficticio) de una justificación. */
function pdfConstancia(lineas) {
  const escapar = (texto) => texto.replace(/[\\()]/g, "\\$&");
  const contenido = lineas
    .map((linea, i) => `BT /F1 ${i ? 11 : 15} Tf 72 ${740 - i * 24} Td (${escapar(linea)}) Tj ET`)
    .join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  // Las tildes van en latin1, que es lo que espera WinAnsiEncoding
  let pdf = "%PDF-1.4\n";
  const posiciones = objetos.map((objeto, i) => {
    const posicion = Buffer.byteLength(pdf, "latin1");
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return posicion;
  });
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
    + posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")
    + `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return `data:application/pdf;base64,${Buffer.from(pdf, "latin1").toString("base64")}`;
}

// ---------- Guardas ----------

/** Cuántas cuentas hay y cuántas no son de example.com (si hay alguna, no es la base de la feria). */
async function cuentasExistentes() {
  const tabla = await pool.query("SELECT to_regclass('public.usuario') AS existe");
  if (!tabla.rows[0].existe) return { total: 0, ajenas: 0 };
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE correo NOT ILIKE $1)::int AS ajenas FROM usuario`,
    [`%${DOMINIO}`]
  );
  return r.rows[0];
}

async function vaciarBase() {
  const tablas = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  await pool.query(`TRUNCATE ${tablas.rows.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

// ---------- Clase de demostración ----------

async function hayClaseEnVivoHoy() {
  const r = await pool.query(
    `SELECT 1 FROM horario h
     JOIN horario_vigencia v ON v.id_horario = h.id_horario
     JOIN tematica t ON t.id_tematica = h.id_tematica
     WHERE t.nombre = $1 AND h.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)
       AND CURRENT_DATE BETWEEN v.vigente_desde AND v.vigente_hasta`,
    [TEMATICA_EN_VIVO]
  );
  return r.rows.length > 0;
}

/**
 * Clase de hoy que empieza ahora (redondeado a 5 min) y dura dos horas, en el
 * ambiente del lector: con el simulador, las primeras huellas quedan
 * "presente" y las que lleguen pasada la tolerancia, "tardanza". Reemplaza la
 * de demostración que hubiera hoy y borra lo que se marcó en ella (es solo
 * para mostrar). Devuelve el horario, o null si la ficha no está sembrada.
 */
async function claseEnVivo(cliente) {
  const r = await cliente.query(
    `SELECT f.id_ficha, f.id_instructor, f.id_periodo, t.id_tematica, t.id_rap, rap.id_competencia,
            (SELECT h.id_ambiente FROM horario h WHERE h.id_ficha = f.id_ficha ORDER BY h.id_horario LIMIT 1) AS id_ambiente
     FROM ficha f
     CROSS JOIN tematica t
     JOIN resultado_aprendizaje rap ON rap.id_rap = t.id_rap
     WHERE f.numero_ficha = $1 AND t.nombre = $2`,
    [NUMERO_FICHA, TEMATICA_EN_VIVO]
  );
  const ficha = r.rows[0];
  if (!ficha) return null;

  const deHoy = `SELECT s.id_sesion FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
                 WHERE h.id_tematica = $1 AND s.fecha = CURRENT_DATE`;
  const deSusAsistencias = `SELECT id_asistencia FROM asistencia WHERE id_sesion IN (${deHoy})`;
  await cliente.query(`DELETE FROM cambio_asistencia WHERE id_asistencia IN (${deSusAsistencias})`, [ficha.id_tematica]);
  await cliente.query(`DELETE FROM justificacion WHERE id_asistencia IN (${deSusAsistencias})`, [ficha.id_tematica]);
  await cliente.query(`DELETE FROM asistencia WHERE id_sesion IN (${deHoy})`, [ficha.id_tematica]);
  await cliente.query(`DELETE FROM sesion_clase WHERE id_sesion IN (${deHoy})`, [ficha.id_tematica]);
  // Las de días anteriores con clases dadas se quedan: ya salen en el historial
  await cliente.query(
    `DELETE FROM horario h WHERE h.id_tematica = $1
       AND NOT EXISTS (SELECT 1 FROM sesion_clase s WHERE s.id_horario = h.id_horario)`,
    [ficha.id_tematica]
  );

  const minutos = new Date().getHours() * 60 + new Date().getMinutes();
  const inicio = Math.floor(minutos / 5) * 5;
  const fin = Math.min(inicio + MINUTOS_CLASE_EN_VIVO, 23 * 60 + 59);
  const creada = await cliente.query(
    `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin,
                          id_rap, id_tematica, id_competencia, fecha_desde, fecha_hasta, excluir_festivos)
     VALUES ($1,$2,$3,$4,EXTRACT(DOW FROM CURRENT_DATE),$5,$6,$7,$8,$9,CURRENT_DATE,CURRENT_DATE,FALSE)
     ON CONFLICT DO NOTHING RETURNING id_horario`,
    [ficha.id_ficha, ficha.id_ambiente, ficha.id_instructor, ficha.id_periodo, hhmm(inicio), hhmm(fin),
     ficha.id_rap, ficha.id_tematica, ficha.id_competencia]
  );
  // Choca solo con una clase de demostración de otra semana a la misma hora exacta
  if (!creada.rows.length) throw new Error("Ya hay una clase de demostración a esta hora: vuelve a intentarlo en 5 minutos");
  return { inicio: hhmm(inicio), fin: hhmm(fin) };
}

// ---------- Siembra ----------

/** Qué le pasó al aprendiz en cada clase (índice = clase, de la más antigua a la más reciente). */
function planDeAsistencia(perfil, total) {
  const plan = new Array(total).fill("presente");
  const poner = (resultado, cantidad, desde, hasta) => {
    const libres = [];
    for (let i = Math.max(desde, 0); i <= Math.min(hasta, total - 1); i++) if (plan[i] === "presente") libres.push(i);
    barajar(libres).slice(0, cantidad || 0).forEach((i) => { plan[i] = resultado; });
  };
  const ultima = total - 1;
  if (perfil.faltoALaUltima) plan[ultima] = "falta";
  // Recientes, para que el instructor tenga qué revisar; las ya revisadas, con días de margen
  poner("por_revisar", perfil.porRevisar, total - 6, total - 2);
  poner("justificada", perfil.justificadas, 0, total - 3);
  poner("rechazada", perfil.rechazadas, 0, total - 3);
  const faltas = perfil.bajoMinimo
    ? Math.ceil(total * perfil.bajoMinimo) - (perfil.rechazadas || 0) - (perfil.porRevisar || 0) - (perfil.faltoALaUltima ? 1 : 0)
    : perfil.faltas;
  poner("falta", faltas, 0, total - 2);
  poner("tardanza", perfil.tardanzas, 0, ultima);
  return plan;
}

async function sembrar(cliente) {
  const hClave = await bcrypt.hash(CLAVE, 10);
  // La ficha va en su tercer trimestre; el periodo cubre las semanas sembradas y las que siguen
  const inicioFicha = new Date(hoy.getFullYear(), hoy.getMonth() - 7, 1);
  const finFicha = new Date(inicioFicha.getFullYear(), inicioFicha.getMonth() + 21, 0);
  const inicioPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
  const finPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 4, 0);
  const cuentasCreadas = sumarDias(inicioFicha, -7);

  const consulta = async (sql, valores) => (await cliente.query(sql, valores)).rows[0];
  const anotarAuditoria = (idUsuario, accion, entidad, idEntidad, detalle, cuando) => cliente.query(
    `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle, creado_en) VALUES ($1,$2,$3,$4,$5,$6)`,
    [idUsuario, accion, entidad, idEntidad, detalle ? JSON.stringify(detalle) : null, cuando]
  );
  // Las de hace más de dos días ya se leyeron
  const notificar = (idUsuario, tipo, titulo, mensaje, enlace, cuando) => cliente.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje, enlace, leida, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [idUsuario, tipo, titulo, mensaje, enlace, cuando < sumarHoras(ahora, -48), cuando]
  );
  const crearUsuario = async (nombres, apellidos, documento, correo, rol) => (await consulta(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol, creado_en, actualizado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id_usuario`,
    [nombres, apellidos, documento, correo, hClave, rol, cuentasCreadas]
  )).id_usuario;

  // ---- Personas ----
  const [nc, ac, dc, cc] = COORDINADOR;
  const idCoordinador = await crearUsuario(nc, ac, dc, cc + DOMINIO, "coordinador");
  const [ni, ai, di, ci] = INSTRUCTOR;
  const idInstructor = await crearUsuario(ni, ai, di, ci + DOMINIO, "instructor");
  const aprendices = [];
  for (const [i, perfil] of APRENDICES.entries()) {
    const documento = String(1090000101 + i);
    const correo = correoDe(perfil.nombres, perfil.apellidos);
    const id = await crearUsuario(perfil.nombres, perfil.apellidos, documento, correo, "aprendiz");
    aprendices.push({ ...perfil, id, documento, correo });
  }

  // ---- Ficha, ambiente y lector ----
  const idPeriodo = (await consulta(
    "INSERT INTO periodo (nombre, fecha_inicio, fecha_fin) VALUES ($1,$2,$3) RETURNING id_periodo",
    [`${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 1 : 2}`, fechaIso(inicioPeriodo), fechaIso(finPeriodo)]
  )).id_periodo;
  const idFicha = (await consulta(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ($1,'Análisis y Desarrollo de Software','mañana',$2,$3,$4,$5) RETURNING id_ficha`,
    [NUMERO_FICHA, fechaIso(inicioFicha), fechaIso(finFicha), idPeriodo, idInstructor]
  )).id_ficha;
  for (const a of aprendices) {
    await cliente.query("INSERT INTO matricula (id_aprendiz, id_ficha, fecha_matricula) VALUES ($1,$2,$3)", [a.id, idFicha, inicioFicha]);
  }
  const idAmbiente = (await consulta(
    "INSERT INTO ambiente (numero_ambiente, sede_centro, id_periodo) VALUES ('305','SENA - CGMLTI Bogotá',$1) RETURNING id_ambiente",
    [idPeriodo]
  )).id_ambiente;
  // Serial y clave por defecto del simulador: funciona sin configurarlo
  await cliente.query(
    `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api, estado)
     VALUES ('LECTOR-001','ZKTeco SenseFace 2A (simulado)',$1,'clave-simulador-demo','no_verificado')`,
    [idAmbiente]
  );

  // ---- Competencias, plan del trimestre y horario ----
  const tematicas = {}; // nombre -> { id_tematica, id_rap, id_competencia }
  for (const c of COMPETENCIAS) {
    const idCompetencia = (await consulta("INSERT INTO competencia (nombre) VALUES ($1) RETURNING id_competencia", [c.nombre])).id_competencia;
    const idRap = (await consulta(
      "INSERT INTO resultado_aprendizaje (id_competencia, codigo, nombre) VALUES ($1,$2,$3) RETURNING id_rap",
      [idCompetencia, ...c.rap]
    )).id_rap;
    for (const nombre of c.tematicas) {
      const t = await consulta("INSERT INTO tematica (id_rap, nombre) VALUES ($1,$2) RETURNING id_tematica", [idRap, nombre]);
      tematicas[nombre] = { id_tematica: t.id_tematica, id_rap: idRap, id_competencia: idCompetencia };
    }
    await cliente.query(
      "INSERT INTO programacion_trimestre (id_ficha, trimestre, id_competencia, id_instructor) VALUES ($1,3,$2,$3)",
      [idFicha, idCompetencia, idInstructor]
    );
  }
  const horarios = [];
  for (const clase of SEMANA) {
    const t = tematicas[clase.tematica];
    const h = await consulta(
      `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin, id_rap, id_tematica, id_competencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_horario`,
      [idFicha, idAmbiente, idInstructor, idPeriodo, clase.dia, clase.inicio, clase.fin, t.id_rap, t.id_tematica, t.id_competencia]
    );
    horarios.push({ ...clase, id: h.id_horario });
  }

  // ---- Huellas: todos menos el aprendiz nuevo, enroladas la segunda semana ----
  for (const [i, a] of aprendices.entries()) {
    if (a.sinHuella) continue;
    const cuando = aLas(sumarDias(inicioFicha, 10), "09:00", i * 4);
    const idConsentimiento = (await consulta(
      `INSERT INTO consentimiento (id_aprendiz, version_texto, aceptado, fecha_aceptacion)
       VALUES ($1,'v1.0',TRUE,$2) RETURNING id_consentimiento`,
      [a.id, cuando]
    )).id_consentimiento;
    const cifrado = cifrar(generarTemplateSimulado(a.documento)); // el simulador lee el documento como huella
    await cliente.query(
      `INSERT INTO plantilla_biometrica (id_aprendiz, plantilla_cifrada, iv, etiqueta_auth, id_consentimiento, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.id, cifrado.plantilla_cifrada, cifrado.iv, cifrado.etiqueta_auth, idConsentimiento, cuando]
    );
    await anotarAuditoria(idCoordinador, "enrollment_biometrico", "usuario", a.id, null, cuando);
  }

  // ---- Clases de las últimas semanas, ya cerradas ----
  const sesiones = [];
  for (let dia = sumarDias(hoy, -SEMANAS * 7); dia <= hoy; dia = sumarDias(dia, 1)) {
    const clase = horarios.find((h) => h.dia === dia.getDay());
    if (!clase || festivoEn(dia)) continue;
    const apertura = aLas(dia, clase.inicio, -entre(4, 12));
    const cierre = aLas(dia, clase.fin, entre(2, 12));
    if (cierre >= ahora) continue; // la de hoy, solo si ya terminó
    sesiones.push({ dia, clase, apertura, cierre });
  }
  for (const a of aprendices) a.plan = planDeAsistencia(a, sesiones.length);

  const vueltas = { justificada: 0, rechazada: 0, por_revisar: 0 }; // para turnar los soportes
  for (const [i, s] of sesiones.entries()) {
    const idSesion = (await consulta(
      `INSERT INTO sesion_clase (id_horario, fecha, estado, hora_apertura, hora_cierre, cerrada_por)
       VALUES ($1,$2,'cerrada',$3,$4,$5) RETURNING id_sesion`,
      [s.clase.id, fechaIso(s.dia), s.apertura, s.cierre, idInstructor]
    )).id_sesion;
    const rango = `${s.clase.inicio}–${s.clase.fin}`;
    let ausentes = 0;

    for (const a of aprendices) {
      const resultado = a.plan[i];

      if (resultado === "presente" || resultado === "tardanza") {
        // Presente: desde que se abre la clase hasta los 15 min de tolerancia
        const desde = s.apertura.getTime() + 30_000;
        const hasta = aLas(s.dia, s.clase.inicio, 15).getTime() - 1000;
        const marca = resultado === "presente"
          ? new Date(desde + azar() * (hasta - desde))
          : new Date(aLas(s.dia, s.clase.inicio, 16).getTime() + azar() * 40 * 60_000);
        const idAsistencia = (await consulta(
          `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo, observacion, registrado_por, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$4) RETURNING id_asistencia`,
          [idSesion, a.id, resultado, marca, a.sinHuella ? "manual" : "huella",
           a.sinHuella ? MOTIVO_MANUAL : null, a.sinHuella ? idInstructor : null]
        )).id_asistencia;
        if (a.sinHuella) {
          await cliente.query(
            `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por, fecha_cambio)
             VALUES ($1,NULL,$2,$3,$4,$5)`,
            [idAsistencia, resultado, MOTIVO_MANUAL, idInstructor, marca]
          );
          await anotarAuditoria(idInstructor, "asistencia_manual", "asistencia", idAsistencia,
            { estado: resultado, motivo: MOTIVO_MANUAL, sesion_cerrada: false }, marca);
        }
        continue;
      }

      // Faltó: el cierre lo dejó ausente y le abrió el enlace para justificar
      ausentes++;
      const idAsistencia = (await consulta(
        `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, metodo, creado_en)
         VALUES ($1,$2,$3,'sistema',$4) RETURNING id_asistencia`,
        [idSesion, a.id, resultado === "justificada" ? "justificada" : "ausente", s.cierre]
      )).id_asistencia;
      await notificar(a.id, "inasistencia", "Inasistencia registrada",
        `Se registró tu inasistencia a la clase del ${fechaLarga(s.dia)} (${rango}, ficha ${NUMERO_FICHA}). ` +
        `Tienes ${textoPlazo(HORAS_PLAZO)} para cargar una justificación desde "Mis justificaciones" o con el enlace de tu correo.`,
        "/mis-justificaciones", s.cierre);

      const expira = sumarHoras(s.cierre, HORAS_PLAZO);
      const j = { estado: expira > ahora ? "pendiente" : "vencida" };
      if (resultado !== "falta") {
        const lista = SOPORTES[resultado];
        const soporte = lista[vueltas[resultado]++ % lista.length];
        j.estado = { justificada: "aprobada", rechazada: "rechazada", por_revisar: "enviada" }[resultado];
        j.tipo = soporte.tipo;
        j.descripcion = soporte.descripcion;
        j.enviada = antesDeAhora(sumarHoras(s.cierre, entre(4, 40)), 180);
        if (soporte.constancia) {
          j.archivo = `constancia-${a.documento}.pdf`;
          j.datos = pdfConstancia([
            "CONSTANCIA DE ATENCIÓN",
            "IPS Salud Ejemplo (entidad ficticia)",
            `Paciente: ${a.nombres} ${a.apellidos}`,
            `Documento: CC ${a.documento}`,
            `Fecha: ${fechaLarga(sumarDias(s.dia, -(soporte.diasAntes || 0)))}`,
            `Motivo: ${soporte.constancia}`,
            "",
            "Documento de demostración para la feria del SENA. No es un soporte real.",
          ]);
        }
        if (resultado !== "por_revisar") {
          j.validada = antesDeAhora(sumarHoras(j.enviada, entre(2, 20)), 30);
          j.observacion = soporte.observacion || null;
        }
      }
      const idJustificacion = (await consulta(
        `INSERT INTO justificacion (id_asistencia, token, expira_en, tipo, descripcion, nombre_archivo, archivo_datos, estado,
                                    enviada_en, validada_por, validada_en, observacion_validacion, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_justificacion`,
        [idAsistencia, crypto.randomBytes(24).toString("hex"), expira, j.tipo || null, j.descripcion || null,
         j.archivo || null, j.datos || null, j.estado, j.enviada || null,
         j.validada ? idInstructor : null, j.validada || null, j.observacion || null, s.cierre]
      )).id_justificacion;

      if (resultado === "justificada") {
        await cliente.query(
          `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por, fecha_cambio)
           VALUES ($1,'ausente','justificada','Justificación aprobada',$2,$3)`,
          [idAsistencia, idInstructor, j.validada]
        );
        await notificar(a.id, "justificacion", "Justificación aprobada",
          "Tu inasistencia quedó marcada como justificada.", "/mis-justificaciones", j.validada);
        await anotarAuditoria(idInstructor, "justificacion_aprobada", "justificacion", idJustificacion, null, j.validada);
      } else if (resultado === "rechazada") {
        await notificar(a.id, "justificacion", "Justificación rechazada",
          `Tu justificación fue rechazada. Motivo: ${j.observacion}`, "/mis-justificaciones", j.validada);
        await anotarAuditoria(idInstructor, "justificacion_rechazada", "justificacion", idJustificacion, null, j.validada);
      } else if (resultado === "por_revisar") {
        await notificar(idInstructor, "justificacion", "Nueva justificación por revisar",
          `${a.nombres} ${a.apellidos} cargó una justificación de la clase del ${fechaLarga(s.dia)} (ficha ${NUMERO_FICHA}).`,
          `/justificaciones?id=${idJustificacion}`, j.enviada);
      }
    }

    await anotarAuditoria(idInstructor, "iniciar_sesion_clase", "sesion_clase", idSesion, null, s.apertura);
    await anotarAuditoria(idInstructor, "cerrar_sesion_clase", "sesion_clase", idSesion, { ausentes }, s.cierre);
  }

  const clase = await claseEnVivo(cliente);
  return { sesiones, aprendices, clase };
}

// ---------- Mensajes ----------

function imprimirCuentas(aprendices) {
  console.log(`
CUENTAS DE LA FERIA (datos ficticios; contraseña de todas: ${CLAVE})
  Coordinación:  ${COORDINADOR[3] + DOMINIO}
  Instructor:    ${INSTRUCTOR[3] + DOMINIO}
  Aprendices (correo y documento, que en el simulador hace de huella):`);
  for (const a of aprendices) console.log(`    ${a.correo.padEnd(34)}${a.documento}`);
  console.log(`
LECTOR SIMULADO (serial LECTOR-001, ambiente 305): en otra terminal, desde la carpeta del proyecto
  node simulador-lector/simulador.js ${urlFrontend}
  y escribe el documento de un aprendiz. Sebastián Ortiz no tiene huella: enrólala en vivo.
`);
}

async function main() {
  if (produccion) {
    console.error("NODE_ENV=production: los datos de la feria son solo para demostración (sus contraseñas son públicas).");
    process.exitCode = 1;
    return pool.end();
  }
  const opciones = process.argv.slice(2);
  const reiniciar = opciones.includes("--reiniciar");

  // Nunca sobre una base con cuentas reales: la de trabajo, la del servidor o la de otro equipo
  const cuentas = await cuentasExistentes();
  if (cuentas.ajenas > 0) {
    console.error(
      `Esta base tiene ${cuentas.ajenas} cuenta(s) que no son ${DOMINIO}: no es la de la feria y no se tocó.\n` +
      "Los datos de la feria van en su propio entorno: docker compose -f docker-compose.feria.yml up -d --build"
    );
    process.exitCode = 1;
    return pool.end();
  }

  if (cuentas.total > 0 && reiniciar) {
    console.log("Borrando los datos anteriores de la feria...");
    await vaciarBase();
  }
  await aplicarEsquema(); // también al arrancar: deja la base al día con las migraciones nuevas

  if (opciones.includes("--clase-ahora")) {
    const clase = await enTransaccion(claseEnVivo);
    if (!clase) {
      console.error("No está la ficha de la feria: siembra primero con npm run sembrar-feria.");
      process.exitCode = 1;
    } else {
      console.log(`Clase de demostración lista: hoy de ${clase.inicio} a ${clase.fin}. Iníciala desde el panel del instructor.`);
    }
    return pool.end();
  }

  if (cuentas.total > 0 && !reiniciar) {
    const ultima = await pool.query("SELECT MAX(fecha) AS fecha FROM sesion_clase WHERE estado = 'cerrada'");
    console.log(
      `La base ya tiene los datos de la feria (última clase cerrada: ${ultima.rows[0].fecha ? fechaLarga(ultima.rows[0].fecha) : "ninguna"}).\n` +
      "Para traer las clases a la fecha de hoy: npm run sembrar-feria -- --reiniciar"
    );
    // Al arrancar otro día, que haya una clase de demostración para hoy
    if (!(await hayClaseEnVivoHoy())) {
      const clase = await enTransaccion(claseEnVivo);
      if (clase) console.log(`Clase de demostración de hoy: ${clase.inicio} a ${clase.fin}.`);
    }
    return pool.end();
  }

  console.log("Sembrando los datos de la feria (ficticios)...");
  const { sesiones, aprendices, clase } = await enTransaccion(sembrar);

  const porAprendiz = await pool.query(
    `SELECT u.nombres || ' ' || u.apellidos AS aprendiz,
            ROUND(100.0 * COUNT(*) FILTER (WHERE a.estado IN ('presente','tardanza','justificada')) / COUNT(*))::int AS porcentaje
     FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion JOIN usuario u ON u.id_usuario = a.id_aprendiz
     WHERE s.estado = 'cerrada' GROUP BY u.id_usuario ORDER BY porcentaje`
  );
  const promedio = await pool.query(
    `SELECT ROUND(AVG(CASE WHEN a.estado IN ('presente','tardanza','justificada') THEN 100 ELSE 0 END))::int AS valor
     FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion WHERE s.estado = 'cerrada'`
  );
  const bajo = porAprendiz.rows.filter((r) => r.porcentaje < 80).map((r) => `${r.aprendiz} (${r.porcentaje} %)`);
  const corta = (fecha) => fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  console.log(`
Datos de la feria sembrados.
  Ficha ${NUMERO_FICHA}: ${sesiones.length} clases cerradas, del ${corta(sesiones[0].dia)} al ${corta(sesiones.at(-1).dia)}
  Asistencia promedio: ${promedio.rows[0].valor} %
  Bajo el mínimo: ${bajo.join(", ")}
  Clase de demostración de hoy: ${clase.inicio} a ${clase.fin} (para otra hora: npm run sembrar-feria -- --clase-ahora)`);
  imprimirCuentas(aprendices);
  await pool.end();
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
