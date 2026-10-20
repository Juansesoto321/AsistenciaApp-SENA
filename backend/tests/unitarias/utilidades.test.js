/**
 * Utilidades compartidas y middleware (sin base de datos).
 */
require("../preparar");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { escaparHtml, celdaCsv, fechaIso, textoPlazo } = require("../../src/utilidades/formato");
const { error } = require("../../src/utilidades/errores");
const { manejadorErrores } = require("../../src/middleware/manejadorErrores");
const { limitarPeticiones } = require("../../src/middleware/seguridad");

/** Respuesta falsa de Express que guarda el código y el cuerpo. */
function respuestaFalsa() {
  return {
    estado: null, cuerpo: null, encabezados: {},
    status(c) { this.estado = c; return this; },
    json(c) { this.cuerpo = c; return this; },
    setHeader(k, v) { this.encabezados[k] = v; },
  };
}

describe("formato", () => {
  test("escaparHtml neutraliza etiquetas en los correos", () => {
    assert.equal(escaparHtml('<a href="x">Ana</a>'), "&lt;a href=&quot;x&quot;&gt;Ana&lt;/a&gt;");
    assert.equal(escaparHtml(null), "");
  });

  test("celdaCsv evita fórmulas y respeta el separador", () => {
    assert.equal(celdaCsv("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    assert.equal(celdaCsv("+57 300"), "'+57 300");
    assert.equal(celdaCsv("Pérez; Ana"), "\"Pérez; Ana\"");
    assert.equal(celdaCsv("normal"), "normal");
    assert.equal(celdaCsv(undefined), "");
  });

  test("fechaIso usa la fecha local, no la de UTC", () => {
    assert.equal(fechaIso(new Date(2026, 8, 9, 23, 30)), "2026-09-09");
  });

  test("textoPlazo habla en días cuando el plazo es exacto, con el plural correcto", () => {
    assert.equal(textoPlazo(72), "3 días");
    assert.equal(textoPlazo(24), "1 día");
    assert.equal(textoPlazo(18), "18 horas");
    assert.equal(textoPlazo(1), "1 hora");
  });
});

describe("manejador central de errores", () => {
  const peticion = { method: "GET", originalUrl: "/api/prueba" };

  test("traduce el tipo de error de negocio a su código HTTP", () => {
    const casos = { validacion: 400, credenciales: 401, prohibido: 403, no_encontrado: 404, vencida: 410, demasiadas_peticiones: 429 };
    for (const [tipo, codigo] of Object.entries(casos)) {
      const res = respuestaFalsa();
      manejadorErrores(error("mensaje", tipo), peticion, res);
      assert.equal(res.estado, codigo, tipo);
      assert.equal(res.cuerpo.mensaje, "mensaje");
    }
  });

  test("un id no numérico o un dato faltante es 400, no 500", () => {
    for (const code of ["22P02", "23502"]) {
      const res = respuestaFalsa();
      manejadorErrores(Object.assign(new Error("detalle interno de postgres"), { code }), peticion, res);
      assert.equal(res.estado, 400);
      assert.doesNotMatch(res.cuerpo.mensaje, /postgres/); // RNF-11: sin detalles técnicos
    }
  });

  test("un JSON mal formado es 400", () => {
    const res = respuestaFalsa();
    manejadorErrores(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed" }), peticion, res);
    assert.equal(res.estado, 400);
  });

  test("campos extra del contrato del lector y del enlace vencido", () => {
    const res = respuestaFalsa();
    manejadorErrores(error("vencida", "vencida", { vencida: true, resultado: "vencida" }), peticion, res);
    assert.equal(res.cuerpo.vencida, true);
    assert.equal(res.cuerpo.resultado, "vencida");
  });
});

describe("límite de peticiones por IP", () => {
  test("deja pasar hasta el máximo y luego responde 429", () => {
    const limite = limitarPeticiones({ maximo: 2, ventanaMinutos: 1, mensaje: "Espera" });
    const resultados = [];
    for (let i = 0; i < 3; i++) limite({ ip: "10.0.0.1" }, respuestaFalsa(), (e) => resultados.push(e?.tipo || "ok"));
    assert.deepEqual(resultados, ["ok", "ok", "demasiadas_peticiones"]);
  });

  test("cada IP lleva su propia cuenta", () => {
    const limite = limitarPeticiones({ maximo: 1, ventanaMinutos: 1, mensaje: "Espera" });
    let pasaron = 0;
    limite({ ip: "10.0.0.1" }, respuestaFalsa(), (e) => { if (!e) pasaron++; });
    limite({ ip: "10.0.0.2" }, respuestaFalsa(), (e) => { if (!e) pasaron++; });
    assert.equal(pasaron, 2);
  });
});

describe("festivos de Colombia", () => {
  const { festivosDelAnio, festivoEn, domingoDePascua } = require("../../src/utilidades/festivos");

  test("calcula la Pascua", () => {
    assert.equal(fechaIso(domingoDePascua(2026)), "2026-04-05");
    assert.equal(fechaIso(domingoDePascua(2027)), "2027-03-28");
  });

  test("2026 tiene los 18 festivos oficiales, con los de la Ley Emiliani en lunes", () => {
    const fechas = festivosDelAnio(2026).map((f) => f.fecha.slice(5));
    assert.deepEqual(fechas, [
      "01-01", "01-12", "03-23", "04-02", "04-03", "05-01", "05-18", "06-08", "06-15",
      "06-29", "07-20", "08-07", "08-17", "10-12", "11-02", "11-16", "12-08", "12-25",
    ]);
  });

  test("dice qué festivo es una fecha, o null en un día hábil", () => {
    assert.equal(festivoEn("2026-10-12"), "Día de la Raza");
    assert.equal(festivoEn(new Date(2027, 6, 5)), "San Pedro y San Pablo"); // 29 de junio de 2027 es martes
    assert.equal(festivoEn("2026-10-20"), null);
  });
});
