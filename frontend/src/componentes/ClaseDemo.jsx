import { useEffect, useState } from "react";
import { api } from "../servicios/api";
import { useConfirmar } from "./Confirmar.jsx";
import Icono from "./Iconos.jsx";
import IconoHuella from "./IconoHuella.jsx";

/**
 * Clase de demostración (temporal, para mostrar la app en vivo). Explica los
 * pasos y trae el botón que borra la demostración anterior, con sus huellas,
 * ausencias y justificaciones, y crea otra clase de hoy que empieza ya.
 * Solo aparece si el servidor la tiene activa (CLASE_DEMO).
 * `alAviso` muestra el resultado y `alReiniciar` recarga las clases de hoy.
 */
export default function ClaseDemo({ alAviso, alReiniciar }) {
  const { confirmar } = useConfirmar();
  const [estado, setEstado] = useState(null);
  const [reiniciando, setReiniciando] = useState(false);

  useEffect(() => {
    api("/sesiones/demo").then(setEstado).catch(() => setEstado({ habilitada: false }));
  }, []);

  if (!estado?.habilitada) return null;
  const hayDemo = Boolean(estado.id_horario);

  async function reiniciar() {
    const seguro = await confirmar({
      titulo: hayDemo ? "¿Reiniciar la clase de demostración?" : "¿Crear la clase de demostración?",
      mensaje: hayDemo
        ? "Se borra la clase de demostración con sus huellas, ausencias y justificaciones, y se crea otra que empieza ahora. Las demás clases no se tocan."
        : "Se crea una clase de hoy que empieza ahora y dura dos horas, con los aprendices de la ficha, en el ambiente del lector.",
      textoConfirmar: hayDemo ? "Reiniciar" : "Crear clase",
      peligro: hayDemo,
    });
    if (!seguro) return;
    setReiniciando(true);
    try {
      const r = await api("/sesiones/demo/reiniciar", { method: "POST" });
      setEstado({ habilitada: true, id_horario: r.id_horario });
      alAviso({ tipo: "exito", texto: r.mensaje });
      alReiniciar();
    } catch (e) {
      alAviso({ tipo: "error", texto: e.message });
    } finally {
      setReiniciando(false);
    }
  }

  return (
    <section className="clase-demo" aria-labelledby="titulo-clase-demo">
      <div className="clase-demo-texto">
        <h2 id="titulo-clase-demo"><IconoHuella /> Clase de demostración</h2>
        <ol>
          <li>Inicia la clase marcada como <b>demostración</b>.</li>
          <li>Los aprendices ponen la huella en el lector.</li>
          <li>Ciérrala: los que no marcaron quedan ausentes y les llega el correo.</li>
        </ol>
      </div>
      <button className="boton" onClick={reiniciar} disabled={reiniciando}>
        <Icono nombre="reiniciar" /> {reiniciando ? "Preparando…" : hayDemo ? "Reiniciar clase de demostración" : "Crear clase de demostración"}
      </button>
    </section>
  );
}
