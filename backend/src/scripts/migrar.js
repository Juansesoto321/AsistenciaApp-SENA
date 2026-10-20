/**
 * Aplica el esquema y todas las migraciones. Es lo único que se ejecuta en un
 * servidor real, tanto al instalar como al actualizar: no crea usuarios ni
 * datos de demostración (eso es `npm run sembrar`, solo para desarrollo).
 * Uso: npm run migrar
 */
require("../config/entorno");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const CARPETA_DB = path.join(__dirname, "../../../db");
const CARPETA_MIGRACIONES = path.join(CARPETA_DB, "migraciones");

/**
 * Aplica el esquema y despues TODAS las migraciones (db/migraciones/*.sql, en
 * orden de numeracion: 001_, 002_...). Todas son idempotentes, asi que sirve
 * igual para una base nueva que para una existente.
 */
async function aplicarEsquema() {
  // Una migración puede avisar algo sin fallar (RAISE NOTICE, código 00000).
  // Los avisos de "ya existe, se omite" de los IF NOT EXISTS no se muestran.
  pool.on("connect", (cliente) => cliente.on("notice", (aviso) => {
    if (aviso.code === "00000") console.warn(`  AVISO: ${aviso.message}`);
  }));
  console.log("Creando esquema...");
  await pool.query(fs.readFileSync(path.join(CARPETA_DB, "init.sql"), "utf8"));

  const migraciones = fs.readdirSync(CARPETA_MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  for (const archivo of migraciones) {
    console.log(`  migración: ${archivo}`);
    await pool.query(fs.readFileSync(path.join(CARPETA_MIGRACIONES, archivo), "utf8"));
  }
}

if (require.main === module) {
  aplicarEsquema()
    .then(() => console.log("Esquema y migraciones al día."))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { aplicarEsquema };
