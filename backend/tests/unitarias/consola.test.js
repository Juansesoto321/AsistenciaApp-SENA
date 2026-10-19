/**
 * Tareas de consola que manejan cuentas (sin base de datos).
 */
require("../preparar");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawnSync } = require("child_process");

const { generarClaveSegura } = require("../../src/scripts/cuentas");
const { validarContrasena } = require("../../src/servicios/auth");

test("las contraseñas aleatorias cumplen la política y no se repiten", () => {
  const claves = Array.from({ length: 200 }, () => generarClaveSegura());
  for (const clave of claves) {
    assert.equal(clave.length, 14);
    assert.equal(validarContrasena(clave), true);
  }
  assert.equal(new Set(claves).size, claves.length);
});

test("sembrar se niega a crear las cuentas de demostración en producción", () => {
  // Corre antes de tocar la base: no necesita PostgreSQL
  const r = spawnSync(process.execPath, [path.join(__dirname, "../../src/scripts/sembrar.js")], {
    env: { ...process.env, NODE_ENV: "production" },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NODE_ENV=production/);
  assert.doesNotMatch(r.stdout, /CUENTAS DE DEMOSTRACIÓN/);
});
