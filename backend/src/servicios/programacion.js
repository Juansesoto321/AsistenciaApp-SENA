/**
 * Plan de formación por trimestre de una ficha.
 * El SENA organiza la formación en trimestres: en cada uno la ficha ve ciertas
 * competencias con cierto instructor, y una misma competencia puede repetirse
 * en otro trimestre con el mismo o con otro instructor.
 */
const modelo = require("../modelos/programacion");
const academico = require("../modelos/academico");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");

const MESES_POR_TRIMESTRE = 3;
const ROLES_PLANEACION = ["coordinador", "programador"];

/**
 * Trimestre en curso de la ficha según su fecha de inicio (1 = los tres
 * primeros meses). Devuelve 0 si la ficha aún no empieza y no pasa del total.
 */
function trimestreEnCurso(fechaInicio, totalTrimestres, hoy = new Date()) {
  const inicio = new Date(fechaInicio);
  let meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  if (hoy.getDate() < inicio.getDate()) meses -= 1; // el mes aún no se completa
  if (meses < 0) return 0;
  return Math.min(totalTrimestres, Math.floor(meses / MESES_POR_TRIMESTRE) + 1);
}

async function fichaExistente(idFicha) {
  const ficha = await modelo.buscarFicha(idFicha);
  if (!ficha) throw error("Ficha no encontrada", "no_encontrado");
  return ficha;
}

async function verificarAcceso(idFicha, usuario) {
  if (ROLES_PLANEACION.includes(usuario.rol)) return;
  if (usuario.rol === "instructor" && (await academico.instructorDictaEnFicha(idFicha, usuario.id))) return;
  throw error("No tienes permisos para ver el plan de esta ficha", "prohibido");
}

async function obtenerPlan(idFicha, usuario) {
  const ficha = await fichaExistente(idFicha);
  await verificarAcceso(idFicha, usuario);
  return {
    ficha: {
      id_ficha: ficha.id_ficha,
      numero_ficha: ficha.numero_ficha,
      programa: ficha.programa,
      fecha_inicio: ficha.fecha_inicio,
      fecha_fin: ficha.fecha_fin,
      trimestres: ficha.trimestres,
    },
    trimestre_actual: trimestreEnCurso(ficha.fecha_inicio, ficha.trimestres),
    programacion: await modelo.listarPorFicha(idFicha),
  };
}

async function programar(idFicha, { trimestre, id_competencia, id_instructor }, usuario) {
  const ficha = await fichaExistente(idFicha);
  const numero = Number(trimestre);
  if (!Number.isInteger(numero) || numero < 1 || numero > ficha.trimestres)
    throw error(`El trimestre debe estar entre 1 y ${ficha.trimestres}`, "validacion");
  if (!id_competencia) throw error("Selecciona la competencia", "validacion");
  if (!id_instructor) throw error("Selecciona el instructor", "validacion");
  if (!(await modelo.esInstructor(id_instructor))) throw error("El usuario elegido no es instructor", "validacion");

  try {
    const id = await modelo.crear({ idFicha, trimestre: numero, idCompetencia: id_competencia, idInstructor: id_instructor });
    await auditar(usuario.id, "programar_competencia", "ficha", Number(idFicha), { trimestre: numero, id_competencia, id_instructor });
    return { id_programacion: id };
  } catch (e) {
    if (e.code === "23505") throw error("Esa competencia ya está asignada a ese instructor en ese trimestre", "validacion");
    if (e.code === "23503") throw error("La competencia no existe", "validacion");
    throw e;
  }
}

async function quitar(idProgramacion, usuario) {
  const borrada = await modelo.eliminar(idProgramacion);
  if (!borrada) throw error("Programación no encontrada", "no_encontrado");
  await auditar(usuario.id, "quitar_programacion", "ficha", borrada.id_ficha, { id_programacion: Number(idProgramacion) });
}

async function cambiarTrimestres(idFicha, trimestres, usuario) {
  await fichaExistente(idFicha);
  const total = Number(trimestres);
  if (!Number.isInteger(total) || total < 1 || total > 12)
    throw error("El número de trimestres debe estar entre 1 y 12", "validacion");
  const quedarianFuera = await modelo.contarDespuesDe(idFicha, total);
  if (quedarianFuera)
    throw error(`Hay ${quedarianFuera} competencia(s) programada(s) después del trimestre ${total}. Quítalas primero`, "validacion");
  await modelo.cambiarTrimestres(idFicha, total);
  await auditar(usuario.id, "cambiar_trimestres_ficha", "ficha", Number(idFicha), { trimestres: total });
}

module.exports = { obtenerPlan, programar, quitar, cambiarTrimestres, trimestreEnCurso };
