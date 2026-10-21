const crypto = require("crypto");
const modelo = require("../modelos/academico");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");
const { enTransaccion } = require("../modelos/transaccion");
const { trimestreEnCurso } = require("./programacion");
const { fechaIso } = require("../utilidades/formato");

const ESTADOS_MATRICULA = ["activa", "retirada", "finalizada"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

async function obtenerPeriodos() {
  return modelo.listarPeriodos();
}

async function obtenerInstructores() {
  return modelo.listarInstructores();
}

async function obtenerFichas(usuario) {
  return modelo.listarFichas(usuario);
}

async function crearPeriodo(datos) {
  return modelo.crearPeriodo(datos);
}

async function crearFicha(datos, usuario) {
  const ficha = await modelo.crearFicha(datos);
  await auditar(usuario.id, "crear_ficha", "ficha", ficha.id_ficha);
  return ficha;
}

async function obtenerHorarios(usuario, filtros) {
  return modelo.listarHorarios(usuario, filtros);
}

/** Valida lo mínimo antes de ir a la base de datos, con mensajes claros. */
function validarHorario(h) {
  if (!h.id_ficha || !h.id_ambiente || !h.id_instructor || !h.id_periodo)
    throw error("Selecciona ficha, ambiente e instructor", "validacion");
  const dia = Number(h.dia_semana);
  if (h.dia_semana === "" || h.dia_semana === null || !Number.isInteger(dia) || dia < 0 || dia > 6)
    throw error("Selecciona un día de la semana válido", "validacion");
  if (!h.hora_inicio || !h.hora_fin) throw error("Indica la hora de inicio y la hora de fin", "validacion");
  // Formato HH:MM(:SS) con ceros a la izquierda: la comparación de texto sirve
  if (String(h.hora_fin) <= String(h.hora_inicio))
    throw error("La hora de fin debe ser posterior a la hora de inicio", "validacion");
}

function errorDeConflicto(conflicto, dia) {
  const cuando = dia === undefined ? "en ese horario" : `el ${DIAS[dia]} a esa hora`;
  return error(
    conflicto.tipo === "ficha"
      ? `Conflicto de ficha: la ficha ${conflicto.numero_ficha} ya tiene otra clase ${cuando}`
      : `Conflicto de ${conflicto.tipo}: se cruza con la ficha ${conflicto.numero_ficha} ${cuando}`,
    "conflicto_horario"
  );
}

/**
 * Completa y valida lo curricular y el trimestre:
 * - la competencia es obligatoria (si llega solo el resultado de aprendizaje,
 *   se toma su competencia) y el RAP y la temática deben pertenecerle;
 * - el trimestre debe existir en la ficha; al crear, por defecto es el que
 *   está en curso; el periodo se toma de la ficha.
 */
async function completarHorario(h, { esNuevo }) {
  const ficha = await modelo.buscarFichaParaHorario(h.id_ficha);
  if (!ficha) throw error("La ficha no existe", "validacion");

  const rap = h.id_rap ? await modelo.buscarRap(h.id_rap) : null;
  if (h.id_rap && !rap) throw error("El resultado de aprendizaje no existe", "validacion");
  const idCompetencia = Number(h.id_competencia) || rap?.id_competencia;
  if (!idCompetencia) throw error("Selecciona la competencia que se verá en esta clase", "validacion");
  if (rap && rap.id_competencia !== idCompetencia)
    throw error("El resultado de aprendizaje no pertenece a esa competencia", "validacion");
  if (h.id_tematica) {
    const tematica = await modelo.buscarTematica(h.id_tematica);
    if (!tematica || !rap || tematica.id_rap !== rap.id_rap)
      throw error("La temática no pertenece a ese resultado de aprendizaje", "validacion");
  }

  let trimestre = h.trimestre === "" || h.trimestre === undefined ? null : h.trimestre;
  if (trimestre === null && esNuevo) trimestre = Math.max(1, trimestreEnCurso(ficha.fecha_inicio, ficha.trimestres));
  if (trimestre !== null) {
    trimestre = Number(trimestre);
    if (!Number.isInteger(trimestre) || trimestre < 1 || trimestre > ficha.trimestres)
      throw error(`El trimestre debe estar entre 1 y ${ficha.trimestres}`, "validacion");
  }

  const fechaDesde = fechaOpcional(h.fecha_desde, "de inicio");
  const fechaHasta = fechaOpcional(h.fecha_hasta, "de fin");
  if (fechaDesde && fechaHasta && fechaHasta < fechaDesde)
    throw error("La fecha final de la serie debe ser igual o posterior a la inicial", "validacion");

  return {
    ...h, id_competencia: idCompetencia, trimestre, id_periodo: h.id_periodo || ficha.id_periodo,
    fecha_desde: fechaDesde, fecha_hasta: fechaHasta, excluir_festivos: h.excluir_festivos !== false,
  };
}

/** "AAAA-MM-DD" o null; vacío significa "todo el trimestre". */
function fechaOpcional(valor, cual) {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(new Date(`${texto}T00:00:00`).getTime()))
    throw error(`La fecha ${cual} de la serie no es válida`, "validacion");
  return texto;
}

/** El rango de la serie debe quedar dentro del trimestre (o del periodo). */
async function validarVigencia(h, cliente) {
  const vigencia = await modelo.calcularVigencia(h, cliente);
  if (vigencia && vigencia.desde > vigencia.hasta)
    throw error("Las fechas de la serie quedan fuera del trimestre elegido", "validacion");
}

/** Acepta `dias_semana` (varios días a la vez) o `dia_semana` (uno). */
function diasSolicitados(datos) {
  const dias = Array.isArray(datos.dias_semana) ? datos.dias_semana : [datos.dia_semana];
  const unicos = [...new Set(dias.filter((d) => d !== "" && d !== null && d !== undefined).map(Number))];
  if (!unicos.length) throw error("Selecciona al menos un día de la semana", "validacion");
  return unicos.sort((a, b) => a - b);
}

/**
 * Crea la clase en uno o varios días. Se valida todo antes de guardar y se
 * guarda en una sola transacción: o se crean todos los días o ninguno.
 */
async function crearHorario(datos, usuario) {
  const dias = diasSolicitados(datos);
  const base = await completarHorario(datos, { esNuevo: true });
  const porDia = dias.map((dia) => ({ ...base, dia_semana: dia }));
  porDia.forEach(validarHorario);

  // Los cruces se revisan dentro de la misma transacción que guarda, y con los
  // horarios bloqueados: antes se revisaban afuera y dos guardados casi
  // simultáneos dejaban la misma clase dos veces (pasó con la ficha 3311983).
  const creados = await enTransaccion(async (cliente) => {
    await modelo.bloquearHorarios(cliente);
    await validarVigencia(base, cliente);
    const lista = [];
    for (const h of porDia) {
      const conflicto = await modelo.buscarConflictoHorario(h, null, cliente);
      if (conflicto) throw errorDeConflicto(conflicto, dias.length > 1 ? h.dia_semana : undefined);
      lista.push(await modelo.crearHorario(h, cliente));
    }
    return lista;
  });
  for (const h of creados) await auditar(usuario.id, "crear_horario", "horario", h.id_horario);
  // Compatibilidad: con un solo día se devuelve el horario; con varios, la lista
  return creados.length === 1 ? creados[0] : { horarios: creados };
}

async function editarHorario(id, datos, usuario) {
  const actual = await modelo.buscarHorario(id);
  if (!actual) throw error("Horario no encontrado", "no_encontrado");

  // Campos no enviados conservan su valor actual
  const combinado = {
    id_ficha: datos.id_ficha ?? actual.id_ficha,
    id_ambiente: datos.id_ambiente ?? actual.id_ambiente,
    id_instructor: datos.id_instructor ?? actual.id_instructor,
    id_periodo: datos.id_periodo ?? actual.id_periodo,
    dia_semana: datos.dia_semana ?? actual.dia_semana,
    hora_inicio: datos.hora_inicio ?? actual.hora_inicio,
    hora_fin: datos.hora_fin ?? actual.hora_fin,
    id_rap: datos.id_rap !== undefined ? datos.id_rap : actual.id_rap,
    id_tematica: datos.id_tematica !== undefined ? datos.id_tematica : actual.id_tematica,
    id_competencia: datos.id_competencia !== undefined ? datos.id_competencia : actual.id_competencia,
    trimestre: datos.trimestre !== undefined ? datos.trimestre : actual.trimestre,
    fecha_desde: datos.fecha_desde !== undefined ? datos.fecha_desde : actual.fecha_desde && fechaIso(actual.fecha_desde),
    fecha_hasta: datos.fecha_hasta !== undefined ? datos.fecha_hasta : actual.fecha_hasta && fechaIso(actual.fecha_hasta),
    excluir_festivos: datos.excluir_festivos !== undefined ? datos.excluir_festivos : actual.excluir_festivos,
  };
  // Si cambia de ficha, el periodo pasa a ser el de la nueva ficha
  if (datos.id_ficha && Number(datos.id_ficha) !== actual.id_ficha && datos.id_periodo === undefined)
    combinado.id_periodo = null;

  const nuevo = await completarHorario(combinado, { esNuevo: false });
  validarHorario(nuevo);

  const horario = await enTransaccion(async (cliente) => {
    await modelo.bloquearHorarios(cliente);
    await validarVigencia(nuevo, cliente);
    const conflicto = await modelo.buscarConflictoHorario(nuevo, Number(id), cliente);
    if (conflicto) throw errorDeConflicto(conflicto);
    return modelo.editarHorario(id, nuevo, cliente);
  });
  await auditar(usuario.id, "editar_horario", "horario", Number(id), nuevo);
  return horario;
}

async function eliminarHorario(id, usuario) {
  const eliminado = await modelo.eliminarHorario(id);
  if (!eliminado) throw error("Horario no encontrado", "no_encontrado");
  await auditar(usuario.id, "eliminar_horario", "horario", Number(id), { nombre: eliminado.nombre });
}

// ---------- MATRICULAS (CU-06) ----------
// La lista trae documento y correo de cada aprendiz: el instructor solo ve
// las fichas donde es titular o dicta alguna clase (RNF-06).
async function obtenerMatriculasDeFicha(idFicha, usuario) {
  if (usuario.rol === "instructor" && !(await modelo.instructorDictaEnFicha(idFicha, usuario.id)))
    throw error("Solo puedes ver las fichas donde eres instructor", "prohibido");
  return modelo.listarMatriculasDeFicha(idFicha);
}

function motivoMatriculaFallida(e) {
  if (e.constraint === "idx_matricula_activa_unica") return "El aprendiz ya tiene una matrícula activa en otra ficha";
  if (e.code === "23505") return "Ya está matriculado en esta ficha";
  if (e.code === "23503") return "La ficha no existe";
  return null;
}

async function matricularAprendices(idFicha, idsAprendices, usuario) {
  if (!Array.isArray(idsAprendices) || !idsAprendices.length)
    throw error("Selecciona al menos un aprendiz", "validacion");
  const resultados = { matriculados: 0, errores: [] };
  for (const id of idsAprendices) {
    try {
      const matriculado = await modelo.matricularAprendiz(id, idFicha);
      if (!matriculado) {
        resultados.errores.push({ id_aprendiz: id, error: "El usuario no existe o no es aprendiz" });
        continue;
      }
      resultados.matriculados++;
    } catch (e) {
      const motivo = motivoMatriculaFallida(e);
      if (!motivo) throw e; // error inesperado: que lo registre el manejador central
      resultados.errores.push({ id_aprendiz: id, error: motivo });
    }
  }
  await auditar(usuario.id, "matricular_aprendices", "ficha", Number(idFicha), resultados);
  return resultados;
}

async function cambiarEstadoMatricula(id, estado, usuario) {
  if (!ESTADOS_MATRICULA.includes(estado)) throw error("Estado inválido", "validacion");
  const actualizada = await modelo.cambiarEstadoMatricula(id, estado);
  if (!actualizada) throw error("Matrícula no encontrada", "no_encontrado");
  await auditar(usuario.id, "cambiar_matricula", "matricula", Number(id), { estado });
}

// ---------- AMBIENTES Y DISPOSITIVOS (CU-07, CU-09) ----------
async function obtenerAmbientes() {
  return modelo.listarAmbientes();
}

async function crearAmbiente(datos, usuario) {
  const ambiente = await modelo.crearAmbiente(datos);
  await auditar(usuario.id, "crear_ambiente", "ambiente", ambiente.id_ambiente);
  return ambiente;
}

// Asociar lector al ambiente: genera la clave API que usara el dispositivo
async function asociarDispositivo(idAmbiente, { serial, modelo: modeloLector }, usuario) {
  const claveApi = crypto.randomBytes(16).toString("hex");
  const dispositivo = await modelo.crearDispositivo({ idAmbiente, serial, modelo: modeloLector, claveApi });
  await auditar(usuario.id, "registrar_dispositivo", "dispositivo", dispositivo.id_dispositivo);
  // La clave se muestra UNA sola vez, para configurar el lector/simulador
  return { ...dispositivo, clave_api: claveApi };
}

async function obtenerDispositivos() {
  return modelo.listarDispositivos();
}

module.exports = {
  obtenerPeriodos,
  obtenerInstructores,
  obtenerFichas,
  crearPeriodo,
  crearFicha,
  obtenerHorarios,
  crearHorario,
  editarHorario,
  eliminarHorario,
  obtenerMatriculasDeFicha,
  matricularAprendices,
  cambiarEstadoMatricula,
  obtenerAmbientes,
  crearAmbiente,
  asociarDispositivo,
  obtenerDispositivos,
};
