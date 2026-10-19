/**
 * Datos de DEMOSTRACIÓN para un computador de desarrollo o la sustentación:
 * esquema + migraciones + cuentas, ficha, ambiente y lector de prueba.
 *
 * Las contraseñas de estas cuentas son públicas (están en este archivo), así
 * que nunca se ejecuta en producción: con NODE_ENV=production se niega. En un
 * servidor real se usa `npm run migrar` y `npm run crear-coordinador`.
 * Uso: npm run sembrar
 */
const { produccion } = require("../config/entorno");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { aplicarEsquema } = require("./migrar");

async function main() {
  if (produccion) {
    console.error(
      "NODE_ENV=production: no se crean datos de demostración (sus contraseñas son públicas).\n" +
      "En un servidor real usa:\n" +
      "  npm run migrar              esquema y migraciones\n" +
      "  npm run crear-coordinador   primera cuenta, con contraseña aleatoria"
    );
    process.exitCode = 1;
    return pool.end();
  }

  await aplicarEsquema();

  // Solo en una base vacía. Antes, sobre una base con datos, se volvía a crear
  // la cuenta de programador con su contraseña pública: una puerta trasera que
  // reaparecía cada vez que alguien aplicaba las migraciones.
  const hayUsuarios = await pool.query("SELECT 1 FROM usuario LIMIT 1");
  if (hayUsuarios.rows.length) {
    console.log("La base ya tiene datos: no se sembró nada (el esquema y las migraciones sí quedaron al día).");
    return pool.end();
  }

  console.log("Sembrando datos de demostración...");
  const hAdmin = await bcrypt.hash("Admin123*", 10);
  const hProgramador = await bcrypt.hash("Programador123*", 10);
  const hInstr = await bcrypt.hash("Instructor123*", 10);
  const hAprendiz = await bcrypt.hash("Aprendiz123*", 10);

  const admin = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ('Coordinador','Sistema','1000000001','admin@sena.edu.co',$1,'coordinador') RETURNING id_usuario`,
    [hAdmin]
  );
  await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ('Programador','Académico','1000000003','programador@sena.edu.co',$1,'programador')`,
    [hProgramador]
  );
  const instructor = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ('Cristian','Buitrago','1000000002','cristian.buitrago@sena.edu.co',$1,'instructor') RETURNING id_usuario`,
    [hInstr]
  );

  const aprendices = [
    ["Julieth Camila", "Peña Mahecha", "1016716963", "camilap.m1230@gmail.com"],
    ["Julian Felipe", "Becerra Villalobo", "1027524931", "becerravillalobos08@gmail.com"],
    ["Juan Sebastian", "Soto Moreno", "1192771015", "juansesoto321@gmail.com"],
    ["Santiago", "Bermudez Torres", "1019764503", "santibermudez0656@gmail.com"],
    ["Yordan Hernando", "Mendez Beltran", "1021675228", "hernandomendezlol@gmail.com"],
  ];
  const idsAprendices = [];
  for (const [n, a, d, c] of aprendices) {
    const r = await pool.query(
      `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
       VALUES ($1,$2,$3,$4,$5,'aprendiz') RETURNING id_usuario`,
      [n, a, d, c, hAprendiz]
    );
    idsAprendices.push(r.rows[0].id_usuario);
  }

  const periodo = await pool.query(
    `INSERT INTO periodo (nombre, fecha_inicio, fecha_fin)
     VALUES ('2026-2','2026-07-01','2026-12-20') RETURNING id_periodo`
  );
  const ficha = await pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ('3311983','Análisis y Desarrollo de Software','mañana','2026-07-01','2026-12-20',$1,$2)
     RETURNING id_ficha`,
    [periodo.rows[0].id_periodo, instructor.rows[0].id_usuario]
  );
  for (const id of idsAprendices) {
    await pool.query("INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1,$2)", [id, ficha.rows[0].id_ficha]);
  }

  const ambiente = await pool.query(
    `INSERT INTO ambiente (numero_ambiente, sede_centro, id_periodo)
     VALUES ('201','SENA - CGMLTI Bogotá',$1) RETURNING id_ambiente`,
    [periodo.rows[0].id_periodo]
  );
  await pool.query(
    `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api, estado)
     VALUES ('LECTOR-001','ZKTeco SenseFace 2A (simulado)',$1,'clave-simulador-demo','no_verificado')`,
    [ambiente.rows[0].id_ambiente]
  );

  // Horario todos los dias (permite demostrar la app cualquier dia de la semana)
  for (let dia = 0; dia <= 6; dia++) {
    await pool.query(
      `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
       VALUES ($1,$2,$3,$4,$5,'06:00','23:59')`,
      [ficha.rows[0].id_ficha, ambiente.rows[0].id_ambiente, instructor.rows[0].id_usuario, periodo.rows[0].id_periodo, dia]
    );
  }

  console.log(`
Datos sembrados correctamente.

CUENTAS DE DEMOSTRACIÓN (solo para este computador: sus contraseñas son públicas)
  Coordinador:  admin@sena.edu.co               / Admin123*
  Programador:    programador@sena.edu.co         / Programador123*
  Instructor:     cristian.buitrago@sena.edu.co   / Instructor123*
  Aprendices:     camilap.m1230@gmail.com           / Aprendiz123*
                  becerravillalobos08@gmail.com     / Aprendiz123*
                  juansesoto321@gmail.com           / Aprendiz123*
                  santibermudez0656@gmail.com       / Aprendiz123*
                  hernandomendezlol@gmail.com       / Aprendiz123*

LECTOR SIMULADO
  Serial: LECTOR-001 · Clave API: clave-simulador-demo · Ambiente: 201
`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
