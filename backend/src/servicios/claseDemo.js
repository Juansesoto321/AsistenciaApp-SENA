/**
 * Clase de demostración (temporal, para mostrar la app en vivo): una clase de
 * hoy con los aprendices de la ficha, que el instructor inicia para que pongan
 * la huella y que al cerrarse avisa a los ausentes, como cualquier otra. El
 * botón "Reiniciar" la borra con todo lo que dejó y crea otra que empieza en
 * ese momento, para repetir la demostración las veces que haga falta.
 * Se activa con CLASE_DEMO (por defecto, en todo menos producción).
 */
const { claseDemo: habilitada } = require("../config/entorno");
const modelo = require("../modelos/claseDemo");
const { enTransaccion } = require("../modelos/transaccion");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");

const hhmm = (hora) => String(hora).slice(0, 5);
// Igual que el texto del aviso de inasistencia (servicios/sesiones.js)
const textoClase = (h, numeroFicha) => `(${hhmm(h.hora_inicio)}–${hhmm(h.hora_fin)}, ficha ${numeroFicha})`;

function verificarHabilitada() {
  if (!habilitada) throw error("La clase de demostración está apagada en este servidor (CLASE_DEMO)", "no_encontrado");
}

/** Si el botón se muestra y cuál es la clase de demostración de hoy. */
async function estado() {
  if (!habilitada) return { habilitada: false };
  const demo = await modelo.buscarDemo();
  return { habilitada: true, id_horario: demo?.id_horario ?? null };
}

async function reiniciar(usuario) {
  verificarHabilitada();
  const esInstructor = usuario.rol === "instructor";

  const resultado = await enTransaccion(async (cliente) => {
    // Bloquea la configuración de la demo: dos clics seguidos no crean dos clases
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext($1))", [modelo.CLAVE]);
    const anterior = await modelo.buscarDemo(cliente);
    if (anterior && esInstructor && anterior.id_instructor !== usuario.id)
      throw error(`La clase de demostración es de la ficha ${anterior.numero_ficha}, de otro instructor`, "prohibido");

    const ficha = await modelo.buscarFicha(cliente, {
      idInstructor: esInstructor ? usuario.id : null,
      idFichaPreferida: anterior?.id_ficha ?? null,
    });
    if (!ficha) throw error("No hay una ficha activa con aprendices matriculados para la demostración", "validacion");
    const ambiente = await modelo.buscarAmbiente(cliente, ficha.id_ficha);
    if (!ambiente) throw error("No hay ambientes activos para la demostración", "validacion");

    const borradas = anterior ? await modelo.borrarDemo(cliente, anterior, textoClase(anterior, anterior.numero_ficha)) : 0;
    const horario = await modelo.crearHorario(cliente, { ficha, idAmbiente: ambiente.id_ambiente });
    if (!(await modelo.esVigenteHoy(cliente, horario.id_horario)))
      throw error(`El periodo de la ficha ${ficha.numero_ficha} no incluye la fecha de hoy`, "validacion");
    await modelo.guardarDemo(cliente, horario.id_horario);
    return { horario, ficha, ambiente, borradas };
  });

  const { horario, ficha, ambiente, borradas } = resultado;
  await auditar(usuario.id, "reiniciar_clase_demo", "horario", horario.id_horario, {
    ficha: ficha.numero_ficha, ambiente: ambiente.numero_ambiente, clases_borradas: borradas,
  });
  return {
    id_horario: horario.id_horario,
    mensaje:
      `Clase de demostración lista: ficha ${ficha.numero_ficha}, ambiente ${ambiente.numero_ambiente}, ` +
      `de ${hhmm(horario.hora_inicio)} a ${hhmm(horario.hora_fin)}. Iníciala para que los aprendices marquen.`,
  };
}

module.exports = { estado, reiniciar };
