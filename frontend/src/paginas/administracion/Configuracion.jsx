import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { fechaCorta, textoPlazo } from "../../utilidades/formato";

const PERIODO_VACIO = { nombre: "", fecha_inicio: "", fecha_fin: "" };

/** "12:00" movida N minutos ("11:45"), para el ejemplo de la ventana de marcación */
function horaConMargen(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const total = (((h * 60 + m + (Number.isFinite(minutos) ? minutos : 0)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function Configuracion() {
  const [conf, setConf] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(PERIODO_VACIO);
  const [mensaje, setMensaje] = useState(null);

  const cargarPeriodos = () => api("/periodos").then(setPeriodos).catch(() => {});
  useEffect(() => {
    api("/configuracion").then(setConf).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
    cargarPeriodos();
  }, []);

  async function guardar() {
    try {
      const r = await api("/configuracion", { method: "PUT", body: conf });
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function crearPeriodo() {
    if (!nuevoPeriodo.nombre.trim() || !nuevoPeriodo.fecha_inicio || !nuevoPeriodo.fecha_fin)
      return setMensaje({ tipo: "error", texto: "Completa nombre, fecha de inicio y fecha de fin del periodo" });
    try {
      await api("/periodos", { method: "POST", body: nuevoPeriodo });
      setMensaje({ tipo: "exito", texto: "Periodo creado" });
      setNuevoPeriodo(PERIODO_VACIO);
      cargarPeriodos();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  if (!conf) return mensaje ? <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div> : <Cargando />;
  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Configuración del sistema</h1><p>Parámetros que gobiernan las reglas de negocio.</p></div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <label>Nombre de la institución</label>
        <input value={conf.nombre_institucion || ""} onChange={(e) => setConf({ ...conf, nombre_institucion: e.target.value })} />
        <label>Minutos de tolerancia antes de marcar tardanza</label>
        <input type="number" min="0" value={conf.minutos_tolerancia || 15}
               onChange={(e) => setConf({ ...conf, minutos_tolerancia: e.target.value })} />
        <div className="rejilla-2">
          <div>
            <label htmlFor="conf-antes">Minutos antes del inicio para marcar</label>
            <input id="conf-antes" type="number" min="0" max="120" value={conf.minutos_antes_marcar ?? 15}
                   onChange={(e) => setConf({ ...conf, minutos_antes_marcar: e.target.value })} />
          </div>
          <div>
            <label htmlFor="conf-despues">Minutos después del fin para marcar</label>
            <input id="conf-despues" type="number" min="0" max="120" value={conf.minutos_despues_marcar ?? 10}
                   onChange={(e) => setConf({ ...conf, minutos_despues_marcar: e.target.value })} />
          </div>
        </div>
        <p className="nota-estado">
          Una huella fuera de ese margen no cuenta para la clase, aunque la sesión esté abierta. En una clase de 12:00 a 14:00
          se aceptan desde las {horaConMargen("12:00", -Number(conf.minutos_antes_marcar ?? 15))} hasta
          las {horaConMargen("14:00", Number(conf.minutos_despues_marcar ?? 10))}.
        </p>
        <label>Porcentaje mínimo de asistencia (%)</label>
        <input type="number" min="0" max="100" value={conf.porcentaje_minimo || 80}
               onChange={(e) => setConf({ ...conf, porcentaje_minimo: e.target.value })} />
        <label>Horas de plazo para cargar justificaciones</label>
        <input type="number" min="1" value={conf.horas_justificacion || 72}
               onChange={(e) => setConf({ ...conf, horas_justificacion: e.target.value })} />
        {Number(conf.horas_justificacion) > 0 && (
          <p className="nota-estado">Los aprendices ven este plazo como {textoPlazo(Number(conf.horas_justificacion))}.</p>
        )}
        <button className="boton" style={{ marginTop: 18 }} onClick={guardar}>Guardar configuración</button>
      </div>

      <div className="cabecera-pagina" style={{ marginTop: 32 }}>
        <div><h1 style={{ fontSize: 20 }}>Periodos académicos</h1><p>Los periodos se usan al crear fichas, ambientes y horarios.</p></div>
      </div>
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <div className="tabla-desplazable">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th></tr></thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id_periodo}>
                <td>{p.nombre}</td>
                <td>{fechaCorta(p.fecha_inicio)}</td>
                <td>{fechaCorta(p.fecha_fin)}</td>
              </tr>
            ))}
            {!periodos.length && <tr><td colSpan={3}><Vacio icono="horarios" titulo="Aún no hay periodos creados" /></td></tr>}
          </tbody>
        </table>
        </div>
        <h3 style={{ fontSize: 15, marginTop: 20 }}>Nuevo periodo</h3>
        <label>Nombre *</label>
        <input required value={nuevoPeriodo.nombre} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, nombre: e.target.value })} placeholder="2026-2" />
        <div className="rejilla-2">
          <div><label>Fecha inicio *</label><input required type="date" value={nuevoPeriodo.fecha_inicio} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_inicio: e.target.value })} /></div>
          <div><label>Fecha fin *</label><input required type="date" value={nuevoPeriodo.fecha_fin} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_fin: e.target.value })} /></div>
        </div>
        <button className="boton" style={{ marginTop: 18 }} onClick={crearPeriodo}>Crear periodo</button>
      </div>
    </>
  );
}
