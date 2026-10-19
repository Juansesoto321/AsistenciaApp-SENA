/**
 * Arma el entorno de las pruebas de integración: recrea la base
 * asistenciaapp_pruebas desde cero, aplica el esquema real (init.sql +
 * migraciones), carga datos mínimos y levanta la API en un puerto libre.
 *
 * Si no hay PostgreSQL disponible, `iniciar()` devuelve null y las pruebas
 * se marcan como omitidas en vez de fallar.
 */
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const NOMBRE_BD = new URL(process.env.DATABASE_URL).pathname.slice(1);
const CONTRASENA = "Prueba123*";

async function recrearBaseDeDatos() {
  const mantenimiento = new URL(process.env.DATABASE_URL);
  mantenimiento.pathname = "/postgres";
  const cliente = new Client({ connectionString: mantenimiento.toString() });
  await cliente.connect();
  try {
    await cliente.query(`DROP DATABASE IF EXISTS ${NOMBRE_BD} WITH (FORCE)`);
    await cliente.query(`CREATE DATABASE ${NOMBRE_BD}`);
  } finally {
    await cliente.end();
  }
}

async function crearUsuario(pool, { nombres, documento, correo, rol }) {
  const hash = await bcrypt.hash(CONTRASENA, 4); // costo bajo: solo pruebas
  const r = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ($1, 'Prueba', $2, $3, $4, $5) RETURNING id_usuario`,
    [nombres, documento, correo, hash, rol]
  );
  return r.rows[0].id_usuario;
}

async function cargarDatos(pool) {
  const ids = {};
  ids.coordinador = await crearUsuario(pool, { nombres: "Coordinador", documento: "900001", correo: "coordinador@prueba.co", rol: "coordinador" });
  ids.instructor = await crearUsuario(pool, { nombres: "Instructor", documento: "900002", correo: "instructor@prueba.co", rol: "instructor" });
  ids.otroInstructor = await crearUsuario(pool, { nombres: "Otro", documento: "900003", correo: "otro@prueba.co", rol: "instructor" });
  ids.aprendiz = await crearUsuario(pool, { nombres: "Ana", documento: "900010", correo: "ana@prueba.co", rol: "aprendiz" });
  ids.ausente = await crearUsuario(pool, { nombres: "Beto", documento: "900011", correo: "beto@prueba.co", rol: "aprendiz" });
  ids.ajeno = await crearUsuario(pool, { nombres: "Ciro", documento: "900012", correo: "ciro@prueba.co", rol: "aprendiz" });
  ids.bloqueable = await crearUsuario(pool, { nombres: "Dora", documento: "900013", correo: "dora@prueba.co", rol: "aprendiz" });

  const periodo = await pool.query(
    `INSERT INTO periodo (nombre, fecha_inicio, fecha_fin)
     VALUES ('Prueba', CURRENT_DATE - 30, CURRENT_DATE + 30) RETURNING id_periodo`
  );
  ids.periodo = periodo.rows[0].id_periodo;

  const ficha = await pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ('999999', 'ADSO', 'mañana', CURRENT_DATE - 30, CURRENT_DATE + 30, $1, $2) RETURNING id_ficha`,
    [ids.periodo, ids.instructor]
  );
  ids.ficha = ficha.rows[0].id_ficha;
  for (const aprendiz of [ids.aprendiz, ids.ausente]) {
    await pool.query("INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1, $2)", [aprendiz, ids.ficha]);
  }

  const ambiente = await pool.query(
    "INSERT INTO ambiente (numero_ambiente, sede_centro) VALUES ('P-1', 'Sede de pruebas') RETURNING id_ambiente"
  );
  ids.ambiente = ambiente.rows[0].id_ambiente;
  const otroAmbiente = await pool.query(
    "INSERT INTO ambiente (numero_ambiente, sede_centro) VALUES ('P-2', 'Sede de pruebas') RETURNING id_ambiente"
  );
  ids.otroAmbiente = otroAmbiente.rows[0].id_ambiente;

  // Estructura curricular mínima: dos competencias, cada una con un RAP
  for (const [clave, nombre, codigo] of [["competencia", "Competencia de prueba A", "RAP-A"], ["otraCompetencia", "Competencia de prueba B", "RAP-B"]]) {
    const c = await pool.query("INSERT INTO competencia (nombre) VALUES ($1) RETURNING id_competencia", [nombre]);
    ids[clave] = c.rows[0].id_competencia;
    const r = await pool.query(
      "INSERT INTO resultado_aprendizaje (id_competencia, codigo, nombre) VALUES ($1, $2, 'Resultado de prueba') RETURNING id_rap",
      [ids[clave], codigo]
    );
    ids[`rap_${clave}`] = r.rows[0].id_rap;
  }
  await pool.query(
    `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api)
     VALUES ('LECTOR-PRUEBA', 'Simulado', $1, 'clave-de-prueba')`,
    [ids.ambiente]
  );

  // Clase de hoy que cubre todo el día, para poder iniciar la sesión a cualquier hora
  const horario = await pool.query(
    `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, EXTRACT(DOW FROM CURRENT_DATE), '00:00', '23:59') RETURNING id_horario, dia_semana`,
    [ids.ficha, ids.ambiente, ids.instructor, ids.periodo]
  );
  ids.horario = horario.rows[0].id_horario;
  ids.diaDeHoy = horario.rows[0].dia_semana;
  return ids;
}

let servidorHttp = null;
let pool = null;

async function iniciar() {
  try {
    await recrearBaseDeDatos();
  } catch (e) {
    console.warn(`[pruebas] PostgreSQL no disponible (${e.message}): se omiten las pruebas de integración`);
    return null;
  }

  // Se importan después de crear la base: el pool apunta a asistenciaapp_pruebas
  const { aplicarEsquema } = require("../../src/scripts/migrar");
  pool = require("../../src/config/db");
  const originalLog = console.log;
  console.log = () => {}; // silencia "Creando esquema..." y las migraciones
  try {
    await aplicarEsquema();
  } finally {
    console.log = originalLog;
  }
  const ids = await cargarDatos(pool);

  const { servidor } = require("../../src/app");
  servidorHttp = servidor;
  await new Promise((listo) => servidor.listen(0, "127.0.0.1", listo));
  const url = `http://127.0.0.1:${servidor.address().port}`;

  async function peticion(metodo, ruta, { token, cuerpo, crudo, encabezados } = {}) {
    const r = await fetch(url + ruta, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...encabezados,
      },
      body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    });
    const texto = await r.text();
    let datos = texto;
    try { datos = JSON.parse(texto); } catch { /* respuesta de texto (CSV, ADMS) */ }
    return { estado: r.status, datos };
  }

  async function iniciarSesionComo(correo) {
    const r = await peticion("POST", "/api/auth/login", { cuerpo: { correo, contrasena: CONTRASENA } });
    if (r.estado !== 200) throw new Error(`No se pudo iniciar sesión como ${correo}: ${JSON.stringify(r.datos)}`);
    return r.datos.token;
  }

  return { url, pool, ids, peticion, iniciarSesionComo, CONTRASENA };
}

async function detener() {
  if (servidorHttp) await new Promise((listo) => servidorHttp.close(listo));
  if (pool) await pool.end();
}

module.exports = { iniciar, detener };
