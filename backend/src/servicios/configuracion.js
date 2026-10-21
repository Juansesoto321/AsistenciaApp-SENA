const modelo = require("../modelos/configuracion");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");

/**
 * Parámetros editables y sus límites. Antes se guardaba cualquier clave con
 * cualquier valor: una tolerancia de "abc" o un porcentaje de 500 rompían el
 * cálculo de tardanzas y de la alerta de asistencia.
 */
const PARAMETROS = {
  minutos_tolerancia: { etiqueta: "Minutos de tolerancia", min: 0, max: 120 },
  // Ventana de marcación: el lector solo acepta huellas desde N minutos antes
  // del inicio hasta N minutos después del fin de la clase
  minutos_antes_marcar: { etiqueta: "Minutos antes del inicio para marcar", min: 0, max: 120, defecto: 15 },
  minutos_despues_marcar: { etiqueta: "Minutos después del fin para marcar", min: 0, max: 120, defecto: 10 },
  porcentaje_minimo: { etiqueta: "Porcentaje mínimo de asistencia", min: 1, max: 100 },
  horas_justificacion: { etiqueta: "Horas para justificar", min: 1, max: 720 },
  nombre_institucion: { etiqueta: "Nombre de la institución", texto: true, maxLargo: 150 },
};

function validarCambios(cambios) {
  const limpios = {};
  for (const [clave, valor] of Object.entries(cambios || {})) {
    const regla = PARAMETROS[clave];
    if (!regla) throw error(`Parámetro desconocido: ${clave}`, "validacion");

    if (regla.texto) {
      const texto = String(valor ?? "").trim();
      if (!texto || texto.length > regla.maxLargo)
        throw error(`${regla.etiqueta}: escribe un texto de 1 a ${regla.maxLargo} caracteres`, "validacion");
      limpios[clave] = texto;
      continue;
    }

    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < regla.min || numero > regla.max)
      throw error(`${regla.etiqueta}: debe ser un número entero entre ${regla.min} y ${regla.max}`, "validacion");
    limpios[clave] = numero;
  }
  return limpios;
}

// Lo que aún no se ha guardado nunca toma su valor por defecto
const POR_DEFECTO = Object.fromEntries(
  Object.entries(PARAMETROS).filter(([, regla]) => regla.defecto !== undefined).map(([clave, regla]) => [clave, String(regla.defecto)])
);

async function obtener() {
  return { ...POR_DEFECTO, ...(await modelo.obtenerTodo()) };
}

/** Minutos antes del inicio y después del fin en los que una huella cuenta para la clase. */
async function ventanaMarcacion() {
  const conf = await obtener();
  return { antes: Number(conf.minutos_antes_marcar), despues: Number(conf.minutos_despues_marcar) };
}

async function actualizar(cambios, idUsuario) {
  const limpios = validarCambios(cambios);
  for (const [clave, valor] of Object.entries(limpios)) {
    await modelo.guardar(clave, valor);
  }
  await auditar(idUsuario, "actualizar_configuracion", "configuracion", null, limpios);
}

module.exports = { obtener, actualizar, validarCambios, ventanaMarcacion };
