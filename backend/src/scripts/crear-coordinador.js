/**
 * Crea una cuenta de coordinador con una contraseña aleatoria que se muestra
 * una sola vez en esta terminal. Es la forma de crear la primera cuenta en un
 * servidor real, que no lleva datos de demostración.
 * Uso: npm run crear-coordinador
 *      docker compose exec backend npm run crear-coordinador
 */
require("../config/entorno");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { generarClaveSegura, crearPreguntador } = require("./cuentas");

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const preguntar = crearPreguntador(rl);
  try {
    console.log("Nueva cuenta de coordinador\n");
    const nombres = (await preguntar("Nombres: ")).trim();
    const apellidos = (await preguntar("Apellidos: ")).trim();
    const documento = (await preguntar("Número de documento: ")).trim();
    const correo = (await preguntar("Correo: ")).trim().toLowerCase();
    if (!nombres || !apellidos || !documento) throw new Error("Nombres, apellidos y documento son obligatorios");
    if (!FORMATO_CORREO.test(correo)) throw new Error("El correo no es válido");

    const clave = generarClaveSegura();
    const r = await pool.query(
      `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol, estado)
       VALUES ($1, $2, $3, $4, $5, 'coordinador', 'activo') RETURNING id_usuario`,
      [nombres, apellidos, documento, correo, await bcrypt.hash(clave, 10)]
    );
    await auditar(null, "crear_coordinador_consola", "usuario", r.rows[0].id_usuario);

    console.log(`\nCuenta creada: ${correo}`);
    console.log(`Contraseña: ${clave}`);
    console.log('\nSe muestra solo esta vez. Entra con ella y cámbiala en "Mi perfil".');
  } catch (e) {
    console.error(
      e.code === "23505"
        ? "\nYa existe una cuenta con ese correo o documento. Para darle una contraseña nueva usa: npm run nueva-clave -- <correo>"
        : `\nNo se creó la cuenta: ${e.message}`
    );
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
