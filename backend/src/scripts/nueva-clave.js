/**
 * Da una contraseña nueva y aleatoria a una cuenta existente y la muestra una
 * sola vez en esta terminal. Sirve para cambiar las contraseñas de las cuentas
 * de demostración (que son públicas) antes de usar una base con datos reales,
 * o para recuperar el acceso de un coordinador sin depender del correo.
 * Uso: npm run nueva-clave -- correo@sena.edu.co
 *      docker compose exec backend npm run nueva-clave -- correo@sena.edu.co
 */
require("../config/entorno");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { generarClaveSegura } = require("./cuentas");

async function main() {
  const correo = String(process.argv[2] || "").trim().toLowerCase();
  if (!correo) {
    console.error("Uso: npm run nueva-clave -- correo@dominio");
    process.exitCode = 1;
    return;
  }

  const clave = generarClaveSegura();
  // También quita un bloqueo por intentos fallidos; una cuenta pendiente o
  // desactivada sigue igual (eso lo decide la coordinación desde Usuarios)
  const r = await pool.query(
    `UPDATE usuario SET contrasena_hash = $1, intentos_fallidos = 0, bloqueado_hasta = NULL,
            estado = CASE WHEN estado = 'bloqueado' THEN 'activo' ELSE estado END,
            actualizado_en = NOW()
     WHERE LOWER(correo) = $2
     RETURNING id_usuario, estado`,
    [await bcrypt.hash(clave, 10), correo]
  );
  const cuenta = r.rows[0];
  if (!cuenta) {
    console.error(`No existe una cuenta con el correo ${correo}`);
    process.exitCode = 1;
    return;
  }
  await auditar(null, "nueva_clave_consola", "usuario", cuenta.id_usuario);

  console.log(`\nContraseña nueva para ${correo}: ${clave}`);
  console.log('Se muestra solo esta vez. Quien la reciba debe cambiarla en "Mi perfil".');
  if (cuenta.estado !== "activo")
    console.log(`Ojo: la cuenta está "${cuenta.estado}"; no podrá entrar hasta que la coordinación la active.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
