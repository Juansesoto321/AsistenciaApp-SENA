import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import EscenarioLector from "../../componentes/EscenarioLector.jsx";
import CampoContrasena from "../../componentes/CampoContrasena.jsx";
import ReglasContrasena, { contrasenaValida } from "../../componentes/ReglasContrasena.jsx";
import { TOTAL_CRESTAS } from "../../componentes/EscanerHuella.jsx";
import { esperaMinima } from "../../utilidades/movimiento";

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEXTO_ESTADO = {
  espera: "Completa tus datos",
  leyendo: "Enviando solicitud…",
  error: "Revisa los datos",
  exito: "Solicitud enviada",
};

export default function Registrarse() {
  const [f, setF] = useState({ nombres: "", apellidos: "", tipo_documento: "CC", documento: "", correo: "", telefono: "", contrasena: "", rol: "aprendiz" });
  const [mensaje, setMensaje] = useState(null);
  const [estado, setEstado] = useState("espera");
  const [intento, setIntento] = useState(0);
  const c = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    if (estado === "error") setEstado("espera");
  };

  async function enviar(e) {
    e.preventDefault();
    if (estado === "leyendo") return;
    setMensaje(null); setEstado("leyendo");
    const minimo = esperaMinima(650);
    try {
      const r = await api("/auth/registro", { method: "POST", body: f });
      await minimo;
      setEstado("exito");
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (error) {
      await minimo;
      setEstado("error");
      setIntento((n) => n + 1);
      setMensaje({ tipo: "error", texto: error.message });
    }
  }

  // Cada dato obligatorio completo enciende una parte de la huella
  const completos = [
    f.nombres.trim(), f.apellidos.trim(), f.documento.trim(),
    FORMATO_CORREO.test(f.correo.trim()), contrasenaValida(f.contrasena),
  ].filter(Boolean).length;
  const encendidas = estado === "leyendo" || estado === "exito" ? TOTAL_CRESTAS : Math.round((completos / 5) * TOTAL_CRESTAS);

  return (
    <div className="login">
      <EscenarioLector estado={estado} texto={TEXTO_ESTADO[estado]} encendidas={encendidas} intento={intento} />

      <main className="login-panel">
        {estado === "exito" ? (
          <div className="login-formulario" role="status">
            <h1>Solicitud enviada</h1>
            <p className="login-ayuda">
              La coordinación revisará tu solicitud. Cuando la apruebe, podrás entrar con tu correo y tu contraseña.
            </p>
            <Link className="boton ancho login-boton" to="/">Volver a iniciar sesión</Link>
          </div>
        ) : (
          <form className="login-formulario ancho" onSubmit={enviar} noValidate>
            <h1>Crea tu cuenta</h1>
            <p className="login-ayuda">Tu solicitud queda pendiente hasta que la coordinación la apruebe.</p>

            {mensaje && <div className={`login-aviso ${mensaje.tipo}`} role="alert">{mensaje.texto}</div>}

            <div className="rejilla-2">
              <div>
                <label htmlFor="reg-nombres">Nombres</label>
                <input id="reg-nombres" autoComplete="given-name" value={f.nombres} onChange={c("nombres")} autoFocus />
              </div>
              <div>
                <label htmlFor="reg-apellidos">Apellidos</label>
                <input id="reg-apellidos" autoComplete="family-name" value={f.apellidos} onChange={c("apellidos")} />
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label htmlFor="reg-tipo">Tipo de documento</label>
                <select id="reg-tipo" value={f.tipo_documento} onChange={c("tipo_documento")}>
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="TI">Tarjeta de identidad</option>
                  <option value="CE">Cédula de extranjería</option>
                </select>
              </div>
              <div>
                <label htmlFor="reg-documento">Número de documento</label>
                <input id="reg-documento" inputMode="numeric" value={f.documento} onChange={c("documento")} />
              </div>
            </div>
            <label htmlFor="reg-correo">Correo</label>
            <input id="reg-correo" type="email" autoComplete="email" inputMode="email" value={f.correo} onChange={c("correo")} placeholder="usuario@soy.sena.edu.co" />
            <div className="rejilla-2">
              <div>
                <label htmlFor="reg-telefono">Teléfono (opcional)</label>
                <input id="reg-telefono" type="tel" autoComplete="tel" value={f.telefono} onChange={c("telefono")} />
              </div>
              <div>
                <label htmlFor="reg-rol">Rol</label>
                <select id="reg-rol" value={f.rol} onChange={c("rol")}>
                  <option value="aprendiz">Aprendiz</option>
                  <option value="instructor">Instructor</option>
                  <option value="programador">Programador</option>
                </select>
              </div>
            </div>
            <label htmlFor="reg-contrasena">Contraseña</label>
            <CampoContrasena id="reg-contrasena" autoComplete="new-password" value={f.contrasena} onChange={c("contrasena")} />
            <ReglasContrasena contrasena={f.contrasena} />

            <button type="submit" className="boton ancho login-boton" disabled={estado === "leyendo"}>
              {estado === "leyendo" ? "Enviando…" : "Enviar solicitud"}
            </button>
            <div className="login-enlaces">
              <span>¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link></span>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
