const modelo = require("../modelos/reportes");
const { error } = require("../utilidades/errores");
const { celdaCsv, fechaIso } = require("../utilidades/formato");
const { auditar } = require("./auditoria");

const BOM = String.fromCharCode(0xfeff); // Excel lo necesita para mostrar bien las tildes

// Regla CU-17: el instructor solo consulta sus fichas
function conAlcanceDeRol(filtros, usuario) {
  return usuario.rol === "instructor" ? { ...filtros, id_instructor: usuario.id } : filtros;
}

async function buscar(filtros, usuario) {
  return modelo.buscarAsistencias(conAlcanceDeRol(filtros, usuario));
}

// CU-18: exportar CSV (abre en Excel)
async function exportarCSV(filtros, usuario) {
  const filas = await modelo.buscarAsistencias(conAlcanceDeRol(filtros, usuario));
  const encabezado = "Fecha;Aprendiz;Documento;Ficha;Estado;Hora;Método;Observación";
  const cuerpo = filas.map((f) =>
    [fechaIso(f.fecha), f.aprendiz, f.documento, f.numero_ficha, f.estado, f.hora, f.metodo, f.observacion]
      .map(celdaCsv)
      .join(";")
  );
  await auditar(usuario.id, "exportar_reporte", "reporte", null, { formato: "csv", contenido: "busqueda", filas: filas.length, filtros });
  return BOM + [encabezado, ...cuerpo].join("\r\n");
}

const FORMATOS_EXPORTACION = ["excel", "pdf"];

/**
 * Excel y PDF se arman en el navegador con datos que ya se consultaron: el
 * navegador avisa aquí para que la exportación quede en la auditoría igual que
 * el CSV (quién sacó qué datos y cuándo).
 */
async function registrarExportacion(usuario, { formato, contenido, filas, filtros }) {
  if (!FORMATOS_EXPORTACION.includes(formato)) throw error("Formato de exportación inválido", "validacion");
  await auditar(usuario.id, "exportar_reporte", "reporte", null, {
    formato,
    contenido: contenido === "resumen" ? "resumen" : "busqueda",
    filas: Number(filas) || 0,
    filtros: filtros && typeof filtros === "object" ? filtros : {},
  });
}

async function listarBusquedasGuardadas(idUsuario) {
  return modelo.listarBusquedasGuardadas(idUsuario);
}

async function guardarBusqueda(idUsuario, nombre, filtros) {
  if (!nombre?.trim()) throw error("Ponle un nombre a la búsqueda", "validacion");
  return modelo.guardarBusqueda(idUsuario, nombre, filtros);
}

// CU-19: historial del aprendiz (solo sus datos)
async function historialAprendiz(idAprendiz, idFichaSolicitada) {
  const fichas = await modelo.fichasDelAprendiz(idAprendiz);
  const idFicha = idFichaSolicitada || fichas[0]?.id_ficha;
  let detalle = [];
  let resumen = null;
  if (idFicha) {
    detalle = await modelo.historialFicha(idAprendiz, idFicha);
    const total = detalle.length;
    const asistidas = detalle.filter((d) => ["presente", "tardanza", "justificada"].includes(d.estado)).length;
    resumen = {
      total,
      presentes: detalle.filter((d) => d.estado === "presente").length,
      tardanzas: detalle.filter((d) => d.estado === "tardanza").length,
      ausencias: detalle.filter((d) => d.estado === "ausente").length,
      justificadas: detalle.filter((d) => d.estado === "justificada").length,
      porcentaje: total ? Math.round((asistidas / total) * 100) : 100,
      minimo: await modelo.porcentajeMinimo(), // regla CU-19: resaltar bajo el minimo
    };
  }
  return { fichas, id_ficha: idFicha ? Number(idFicha) : null, detalle, resumen };
}

async function obtenerEstadisticas(usuario) {
  return modelo.estadisticas(usuario);
}

const MAX_EN_RANKING = 10;

/**
 * Lo que muestra Reportes al abrir, sin filtrar nada: cómo va cada ficha, los
 * aprendices con más faltas y los que están bajo el porcentaje mínimo. El
 * instructor solo ve las clases que dicta (regla CU-17).
 */
async function resumen(usuario) {
  const [porFicha, porAprendiz, minimo] = await Promise.all([
    modelo.resumenPorFicha(usuario),
    modelo.resumenPorAprendiz(usuario),
    modelo.porcentajeMinimo(),
  ]);
  const masFaltas = porAprendiz
    .filter((a) => a.ausencias > 0)
    .sort((a, b) => b.ausencias - a.ausencias || a.porcentaje - b.porcentaje)
    .slice(0, MAX_EN_RANKING);
  const bajoMinimo = porAprendiz.filter((a) => a.porcentaje < minimo); // ya vienen del más bajo al más alto
  return { minimo, por_ficha: porFicha, mas_faltas: masFaltas, bajo_minimo: bajoMinimo };
}

const DIAS_PERMITIDOS = [7, 14, 30, 90];

async function obtenerTendencia(usuario, dias = 30) {
  const numero = Number(dias);
  if (!DIAS_PERMITIDOS.includes(numero)) throw error(`Los días deben ser ${DIAS_PERMITIDOS.join(", ")}`, "validacion");
  return modelo.tendencia(usuario, numero);
}

module.exports = {
  buscar, exportarCSV, listarBusquedasGuardadas, guardarBusqueda, historialAprendiz, obtenerEstadisticas,
  resumen, obtenerTendencia, registrarExportacion,
};
