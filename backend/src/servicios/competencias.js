/**
 * Estructura curricular: Competencia -> Resultado de Aprendizaje (RAP) -> Tematica.
 * Incluye la carga masiva desde CSV que pidio el instructor.
 */
const modelo = require("../modelos/competencias");
const { enTransaccion } = require("../modelos/transaccion");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");

// ---------- COMPETENCIAS ----------
async function listarCompetencias(buscar) {
  return modelo.listarCompetencias(buscar);
}

async function crearCompetencia({ codigo, nombre }, usuario) {
  if (!nombre?.trim()) throw error("El nombre de la competencia es obligatorio", "validacion");
  const competencia = await modelo.crearCompetencia({ codigo: codigo?.trim(), nombre: nombre.trim() });
  await auditar(usuario.id, "crear_competencia", "competencia", competencia.id_competencia);
  return competencia;
}

async function editarCompetencia(id, { codigo, nombre }, usuario) {
  if (!nombre?.trim()) throw error("El nombre de la competencia es obligatorio", "validacion");
  const competencia = await modelo.editarCompetencia(id, { codigo: codigo?.trim(), nombre: nombre.trim() });
  if (!competencia) throw error("Competencia no encontrada", "no_encontrado");
  await auditar(usuario.id, "editar_competencia", "competencia", Number(id));
  return competencia;
}

async function eliminarCompetencia(id, usuario) {
  const borrada = await modelo.eliminarCompetencia(id);
  if (!borrada) throw error("Competencia no encontrada", "no_encontrado");
  await auditar(usuario.id, "eliminar_competencia", "competencia", Number(id), { nombre: borrada.nombre });
}

// ---------- RESULTADOS DE APRENDIZAJE ----------
async function listarRaps(idCompetencia) {
  return modelo.listarRaps(idCompetencia);
}

async function crearRap({ id_competencia, codigo, nombre }, usuario) {
  if (!id_competencia) throw error("Selecciona la competencia a la que pertenece", "validacion");
  if (!codigo?.trim()) throw error("El código del resultado de aprendizaje es obligatorio", "validacion");
  if (!nombre?.trim()) throw error("El nombre del resultado de aprendizaje es obligatorio", "validacion");

  const rap = await modelo.crearRap({ idCompetencia: id_competencia, codigo: codigo.trim(), nombre: nombre.trim() });
  await auditar(usuario.id, "crear_rap", "resultado_aprendizaje", rap.id_rap);
  return rap;
}

async function editarRap(id, { id_competencia, codigo, nombre }, usuario) {
  if (!codigo?.trim() || !nombre?.trim())
    throw error("El código y el nombre del resultado de aprendizaje son obligatorios", "validacion");
  const rap = await modelo.editarRap(id, { idCompetencia: id_competencia, codigo: codigo.trim(), nombre: nombre.trim() });
  if (!rap) throw error("Resultado de aprendizaje no encontrado", "no_encontrado");
  await auditar(usuario.id, "editar_rap", "resultado_aprendizaje", Number(id));
  return rap;
}

async function eliminarRap(id, usuario) {
  const borrado = await modelo.eliminarRap(id);
  if (!borrado) throw error("Resultado de aprendizaje no encontrado", "no_encontrado");
  await auditar(usuario.id, "eliminar_rap", "resultado_aprendizaje", Number(id), { nombre: borrado.nombre });
}

// ---------- TEMATICAS ----------
async function crearTematica({ id_rap, nombre }, usuario) {
  if (!id_rap) throw error("Selecciona el resultado de aprendizaje", "validacion");
  if (!nombre?.trim()) throw error("El nombre de la temática es obligatorio", "validacion");
  const existente = await modelo.buscarTematica(id_rap, nombre.trim());
  if (existente) throw error("Ese resultado de aprendizaje ya tiene esa temática", "validacion");

  const tematica = await modelo.crearTematica({ idRap: id_rap, nombre: nombre.trim() });
  await auditar(usuario.id, "crear_tematica", "tematica", tematica.id_tematica);
  return tematica;
}

async function eliminarTematica(id, usuario) {
  const borrada = await modelo.eliminarTematica(id);
  if (!borrada) throw error("Temática no encontrada", "no_encontrado");
  await auditar(usuario.id, "eliminar_tematica", "tematica", Number(id), { nombre: borrada.nombre });
}

// ---------- CARGA MASIVA ----------
const SEPARADORES = [";", "\t", ","];

function detectarSeparador(linea) {
  return SEPARADORES.reduce((mejor, sep) =>
    linea.split(sep).length > linea.split(mejor).length ? sep : mejor, SEPARADORES[0]);
}

const sinTildes = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * La primera fila es de títulos si sus columnas se llaman como el formato
 * ("competencia", "código..."). Antes bastaba con que la palabra apareciera
 * en cualquier parte, y se descartaban filas de datos como "Resultado final".
 */
function esFilaDeEncabezados(campos) {
  const [primera = "", segunda = ""] = campos.map(sinTildes);
  return primera.startsWith("competencia") || segunda.startsWith("codigo");
}

/**
 * Formato esperado (una fila por temática):
 *   competencia ; codigo_rap ; resultado_aprendizaje ; tematica
 * La temática es opcional. Acepta ; , o tabulación, y una fila de encabezados.
 */
function parsearCsv(contenido) {
  const lineas = String(contenido || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) throw error("El archivo está vacío", "validacion");

  const separador = detectarSeparador(lineas[0]);
  const partir = (linea) => linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, ""));
  const tieneEncabezado = esFilaDeEncabezados(partir(lineas[0]));

  return lineas.slice(tieneEncabezado ? 1 : 0).map((linea, i) => {
    const campos = partir(linea);
    return {
      fila: i + (tieneEncabezado ? 2 : 1),
      competencia: campos[0],
      codigoRap: campos[1],
      resultado: campos[2],
      tematica: campos[3] || null,
    };
  });
}

/**
 * Inserta lo que falte y reutiliza lo que ya existe (validando la competencia
 * por nombre y el RAP por codigo, como indico el instructor). Todo va en una
 * sola transaccion: o entra el archivo completo o no entra nada.
 */
async function cargaMasiva(contenido, usuario) {
  const filas = parsearCsv(contenido);
  const resumen = {
    competencias_nuevas: 0,
    raps_nuevos: 0,
    tematicas_nuevas: 0,
    filas_procesadas: 0,
    errores: [],
  };

  await enTransaccion(async (cliente) => {
    for (const f of filas) {
      if (!f.competencia || !f.codigoRap || !f.resultado) {
        resumen.errores.push({ fila: f.fila, error: "Faltan competencia, código o resultado de aprendizaje" });
        continue;
      }

      let competencia = await modelo.buscarCompetenciaPorNombre(f.competencia, cliente);
      if (!competencia) {
        competencia = await modelo.crearCompetencia({ nombre: f.competencia }, cliente);
        resumen.competencias_nuevas++;
      }

      let rap = await modelo.buscarRapPorCodigo(f.codigoRap, cliente);
      if (!rap) {
        rap = await modelo.crearRap(
          { idCompetencia: competencia.id_competencia, codigo: f.codigoRap, nombre: f.resultado },
          cliente
        );
        resumen.raps_nuevos++;
      }

      if (f.tematica) {
        const existente = await modelo.buscarTematica(rap.id_rap, f.tematica, cliente);
        if (!existente) {
          await modelo.crearTematica({ idRap: rap.id_rap, nombre: f.tematica }, cliente);
          resumen.tematicas_nuevas++;
        }
      }

      resumen.filas_procesadas++;
    }
  });

  await auditar(usuario.id, "carga_masiva_competencias", "competencia", null, resumen);
  return resumen;
}

module.exports = {
  parsearCsv,
  listarCompetencias,
  crearCompetencia,
  editarCompetencia,
  eliminarCompetencia,
  listarRaps,
  crearRap,
  editarRap,
  eliminarRap,
  crearTematica,
  eliminarTematica,
  cargaMasiva,
};
