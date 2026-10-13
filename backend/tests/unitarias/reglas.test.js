/**
 * Reglas de negocio que no necesitan base de datos.
 */
require("../preparar");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { calcularEstado, horaDeLaMarca } = require("../../src/servicios/marcacion");
const { validarContrasena, normalizarCorreo } = require("../../src/servicios/auth");
const { validarCambios } = require("../../src/servicios/configuracion");
const { parsearCsv } = require("../../src/servicios/competencias");
const { trimestreEnCurso } = require("../../src/servicios/programacion");

describe("calcularEstado (CU-13: presente o tardanza)", () => {
  const a = (hora, minuto) => new Date(2026, 8, 23, hora, minuto); // 23 sep 2026, hora local

  test("dentro de la tolerancia queda presente", () => {
    assert.equal(calcularEstado("07:00:00", 15, a(7, 10)), "presente");
    assert.equal(calcularEstado("07:00:00", 15, a(7, 15)), "presente");
  });

  test("pasada la tolerancia queda tardanza", () => {
    assert.equal(calcularEstado("07:00:00", 15, a(7, 16)), "tardanza");
  });

  test("antes de la hora de inicio queda presente", () => {
    assert.equal(calcularEstado("07:00:00", 15, a(6, 50)), "presente");
  });

  test("clase nocturna: después de las 7 p. m. sí cuenta la tardanza", () => {
    // Error corregido: se usaba la fecha en UTC, que a esta hora ya es "mañana"
    assert.equal(calcularEstado("18:00:00", 15, a(19, 30)), "tardanza");
    assert.equal(calcularEstado("18:00:00", 15, a(18, 5)), "presente");
  });

  test("acepta la hora sin segundos", () => {
    assert.equal(calcularEstado("07:00", 15, a(7, 30)), "tardanza");
  });
});

describe("hora de la marca que envía el lector (ADMS)", () => {
  const ahora = new Date(2026, 9, 13, 9, 0, 0); // 13 oct 2026, 9:00 a. m. hora local

  test("usa la hora local del equipo, aunque la marca llegue tarde", () => {
    assert.equal(horaDeLaMarca("2026-10-13 07:05:30", ahora).getTime(), new Date(2026, 9, 13, 7, 5, 30).getTime());
    assert.equal(horaDeLaMarca("2026-10-13 07:05", ahora).getTime(), new Date(2026, 9, 13, 7, 5, 0).getTime());
  });

  test("sin hora, con una hora ilegible o con el reloj del equipo adelantado usa la del servidor", () => {
    assert.equal(horaDeLaMarca(undefined, ahora), ahora);
    assert.equal(horaDeLaMarca("ayer temprano", ahora), ahora);
    assert.equal(horaDeLaMarca("2026-10-13 09:30:00", ahora), ahora); // 30 min en el futuro
    assert.equal(horaDeLaMarca("2026-10-13 09:03:00", ahora).getMinutes(), 3); // 3 min: dentro del margen
  });
});

describe("contraseñas y correos", () => {
  test("la política exige 8 caracteres, mayúscula, minúscula y número", () => {
    assert.equal(validarContrasena("Segura123"), true);
    assert.equal(validarContrasena("corta1A"), false);
    assert.equal(validarContrasena("sinmayuscula1"), false);
    assert.equal(validarContrasena("SINMINUSCULA1"), false);
    assert.equal(validarContrasena("SinNumeros"), false);
    assert.equal(validarContrasena(undefined), false);
  });

  test("el correo se guarda sin espacios y en minúsculas", () => {
    assert.equal(normalizarCorreo("  Ana.Perez@SENA.edu.co "), "ana.perez@sena.edu.co");
    assert.equal(normalizarCorreo(undefined), "");
  });
});

describe("configuración del sistema", () => {
  test("acepta valores dentro de los límites", () => {
    assert.deepEqual(
      validarCambios({ minutos_tolerancia: "10", porcentaje_minimo: 80, horas_justificacion: "72", nombre_institucion: " SENA " }),
      { minutos_tolerancia: 10, porcentaje_minimo: 80, horas_justificacion: 72, nombre_institucion: "SENA" }
    );
  });

  test("rechaza números inválidos o fuera de rango", () => {
    assert.throws(() => validarCambios({ minutos_tolerancia: "abc" }), { tipo: "validacion" });
    assert.throws(() => validarCambios({ minutos_tolerancia: -5 }), { tipo: "validacion" });
    assert.throws(() => validarCambios({ porcentaje_minimo: 500 }), { tipo: "validacion" });
    assert.throws(() => validarCambios({ horas_justificacion: 1.5 }), { tipo: "validacion" });
  });

  test("rechaza claves desconocidas", () => {
    assert.throws(() => validarCambios({ clave_inventada: "1" }), /desconocido/);
  });
});

describe("trimestre en curso de una ficha", () => {
  const inicio = "2026-07-01T00:00:00";

  test("los tres primeros meses son el trimestre 1", () => {
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2026, 6, 1)), 1);
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2026, 8, 30)), 1);
  });

  test("después avanza cada tres meses", () => {
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2026, 9, 13)), 2);
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2027, 0, 5)), 3);
  });

  test("antes de empezar es 0 y nunca pasa del total de trimestres", () => {
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2026, 5, 20)), 0);
    assert.equal(trimestreEnCurso(inicio, 7, new Date(2030, 0, 1)), 7);
  });
});

describe("carga masiva de competencias (CSV)", () => {
  test("detecta el separador y omite la fila de encabezados", () => {
    const filas = parsearCsv("competencia;codigo;resultado;tematica\nProgramar;RA1;Codificar;Bucles\nProgramar;RA2;Probar;");
    assert.equal(filas.length, 2);
    assert.deepEqual(filas[0], { fila: 2, competencia: "Programar", codigoRap: "RA1", resultado: "Codificar", tematica: "Bucles" });
    assert.equal(filas[1].tematica, null);
  });

  test("también acepta comas y tabulaciones", () => {
    assert.equal(parsearCsv("A,RA1,Resultado")[0].codigoRap, "RA1");
    assert.equal(parsearCsv("A\tRA1\tResultado")[0].resultado, "Resultado");
  });

  test("un archivo vacío es un error de validación", () => {
    assert.throws(() => parsearCsv("  \n "), { tipo: "validacion" });
  });
});
