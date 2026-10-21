import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../servicios/api";
import EscenarioLector from "../../componentes/EscenarioLector.jsx";
import CampoContrasena from "../../componentes/CampoContrasena.jsx";
import ReglasContrasena, { REGLAS_CONTRASENA, reglasCumplidas } from "../../componentes/ReglasContrasena.jsx";
import { TOTAL_CRESTAS } from "../../componentes/EscanerHuella.jsx";
import { esperaMinima } from "../../utilidades/movimiento";

const TEXTO_ESTADO = {
  espera: "Crea tu nueva contraseña",
  leyendo: "Guardando…",
  error: "No se pudo guardar",
  exito: "Contraseña actualizada",
};

export default function Restablecer() {
  const { token } = useParams();
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [estado, setEstado] = useState("espera");
  const [intento, setIntento] = useState(0);

  const escribir = (cambiar) => (e) => {
    cambiar(e.target.value);
    if (estado === "error") setEstado("espera");
  };

  function fallar(texto) {
    setEstado("error");
    setIntento((n) => n + 1);
    setMensaje({ tipo: "error", texto });
  }

  async function enviar(e) {
    e.preventDefault();
    if (estado === "leyendo") return;
    setMensaje(null);
    if (contrasena !== confirmar) return fallar("Las contraseñas no coinciden");
    setEstado("leyendo");
    const minimo = esperaMinima(650);
    try {
      const r = await api("/auth/restablecer", { method: "POST", body: { token, contrasena } });
      await minimo;
      setEstado("exito");
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (error) {
      await minimo;
      fallar(error.message);
    }
  }

  // Cada requisito cumplido (y que las dos coincidan) enciende una parte de la huella
  const cumplidos = reglasCumplidas(contrasena) + (confirmar && confirmar === contrasena ? 1 : 0);
  const total = REGLAS_CONTRASENA.length + 1;
  const encendidas = estado === "leyendo" || estado === "exito" ? TOTAL_CRESTAS : Math.round((cumplidos / total) * TOTAL_CRESTAS);

  return (
    <div className="login tema-oscuro">
      <EscenarioLector estado={estado} texto={TEXTO_ESTADO[estado]} encendidas={encendidas} intento={intento} />

      <main className="login-panel">
        {estado === "exito" ? (
          <div className="login-formulario" role="status">
            <h1>Contraseña actualizada</h1>
            <p className="login-ayuda">Ya puedes entrar con tu nueva contraseña.</p>
            <Link className="boton ancho login-boton" to="/">Iniciar sesión</Link>
          </div>
        ) : (
          <form className="login-formulario" onSubmit={enviar} noValidate>
            <h1>Nueva contraseña</h1>
            <p className="login-ayuda">El enlace sirve durante 1 hora desde que lo pediste.</p>

            {mensaje && <div className={`login-aviso ${mensaje.tipo}`} role="alert">{mensaje.texto}</div>}

            <label htmlFor="nueva-contrasena">Nueva contraseña</label>
            <CampoContrasena id="nueva-contrasena" autoComplete="new-password" value={contrasena} onChange={escribir(setContrasena)} autoFocus />
            <ReglasContrasena contrasena={contrasena} />

            <label htmlFor="confirmar-contrasena">Confirma la contraseña</label>
            <CampoContrasena id="confirmar-contrasena" autoComplete="new-password" value={confirmar} onChange={escribir(setConfirmar)} />

            <button type="submit" className="boton ancho login-boton" disabled={estado === "leyendo"}>
              {estado === "leyendo" ? "Guardando…" : "Guardar contraseña"}
            </button>
            <div className="login-enlaces">
              <Link to="/">Volver a iniciar sesión</Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
