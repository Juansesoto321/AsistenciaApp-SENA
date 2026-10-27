import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Icono from "../../componentes/Iconos.jsx";
import { descargarPdf } from "../../utilidades/pdf";
import { fechaCorta, horaCorta } from "../../utilidades/formato";
import { SEDE } from "../../utilidades/sede";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ESTADOS = { presente: "Presente", tardanza: "Tardanza", ausente: "Ausente", justificada: "Justificada" };

/**
 * Documentos del aprendiz, armados en el momento con sus datos: la constancia
 * de asistencia y el horario de la semana en PDF. Los soportes de sus faltas
 * están en Mis justificaciones.
 */
export default function MisDocumentos() {
  const { usuario } = useAuth().sesion;
  const [historial, setHistorial] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [generando, setGenerando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api("/reportes/mi-historial").then(setHistorial).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
    api("/horarios").then(setHorarios).catch(() => setHorarios([]));
  }, []);

  const nombre = `${usuario.nombres} ${usuario.apellidos}`;
  const ficha = historial?.fichas?.find((f) => f.id_ficha === historial.id_ficha);

  async function generar(cual, armar) {
    setGenerando(cual);
    try {
      await descargarPdf(armar());
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo generar el PDF. Inténtalo de nuevo." });
    } finally {
      setGenerando(null);
    }
  }

  const constancia = () => {
    const r = historial.resumen;
    return {
      titulo: "Constancia de asistencia",
      subtitulo: `${nombre} · ${usuario.correo} · ficha ${ficha?.numero_ficha} (${ficha?.programa})`,
      institucion: SEDE.nombre,
      archivo: "constancia-asistencia.pdf",
      secciones: [
        {
          titulo: "Resumen",
          columnas: ["Clases", "Presentes", "Tardanzas", "Justificadas", "Ausencias", "Asistencia"],
          filas: [[r.total, r.presentes, r.tardanzas, r.justificadas, r.ausencias, `${r.porcentaje} % (mínimo ${r.minimo} %)`]],
        },
        {
          titulo: "Clases",
          columnas: ["Fecha", "Horario", "Estado", "Hora de marca", "Competencia"],
          filas: historial.detalle.map((d) => [
            fechaCorta(d.fecha), `${d.hora_inicio}–${d.hora_fin}`, ESTADOS[d.estado] || d.estado, d.hora || "—", d.competencia || "—",
          ]),
        },
      ],
    };
  };

  const horario = () => ({
    titulo: "Horario de la semana",
    subtitulo: `${nombre} · ficha ${ficha?.numero_ficha} (${ficha?.programa})`,
    institucion: SEDE.nombre,
    archivo: "mi-horario.pdf",
    secciones: [{
      titulo: "Clases",
      columnas: ["Día", "Hora", "Ambiente", "Instructor", "Competencia"],
      filas: [...horarios]
        .sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7) || String(a.hora_inicio).localeCompare(b.hora_inicio))
        .map((h) => [DIAS[h.dia_semana], `${horaCorta(h.hora_inicio)}–${horaCorta(h.hora_fin)}`, h.numero_ambiente, h.instructor, h.competencia || "—"]),
    }],
  });

  const sinFicha = historial && !historial.resumen;
  const documentos = [
    {
      clave: "constancia", icono: "asistencia", titulo: "Constancia de asistencia",
      texto: "Tu porcentaje y cada clase con su estado, en PDF.",
      listo: Boolean(historial?.resumen), accion: () => generar("constancia", constancia),
    },
    {
      clave: "horario", icono: "horarios", titulo: "Horario de la semana",
      texto: "Tus clases de cada día con ambiente e instructor, en PDF.",
      listo: Boolean(horarios?.length && ficha), accion: () => generar("horario", horario),
    },
  ];

  return (<>
    <div className="cabecera-pagina">
      <div>
        <h1>Mis documentos</h1>
        <p>Se arman en el momento con tus datos de hoy.</p>
      </div>
    </div>
    <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
    {sinFicha && <p className="mensaje error">Todavía no estás matriculado en una ficha: los documentos aparecen cuando te matriculen.</p>}

    <div className="lista-documentos">
      {documentos.map((d) => (
        <article key={d.clave} className="documento">
          <span className="documento-icono"><Icono nombre={d.icono} size="1.4em" /></span>
          <div>
            <h3>{d.titulo}</h3>
            <p>{d.texto}</p>
          </div>
          <button className="boton" disabled={!d.listo || generando !== null} onClick={d.accion}>
            <Icono nombre="descargar" /> {generando === d.clave ? "Generando…" : "Descargar PDF"}
          </button>
        </article>
      ))}
      <article className="documento">
        <span className="documento-icono"><Icono nombre="justificaciones" size="1.4em" /></span>
        <div>
          <h3>Soportes de mis justificaciones</h3>
          <p>Las excusas que cargaste y su respuesta.</p>
        </div>
        <Link className="boton suave" to="/mis-justificaciones">Ver mis justificaciones <Icono nombre="flecha" /></Link>
      </article>
    </div>
  </>);
}
