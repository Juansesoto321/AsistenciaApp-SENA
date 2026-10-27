import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import EscenarioLector from "../../componentes/EscenarioLector.jsx";
import CampoContrasena from "../../componentes/CampoContrasena.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Logo from "../../componentes/Logo.jsx";
import { TOTAL_CRESTAS } from "../../componentes/EscanerHuella.jsx";
import { esperaMinima, reducirMovimiento } from "../../utilidades/movimiento";
import { useTitulo } from "../../utilidades/titulo";

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LECTURA_MINIMA_MS = 650;
const CELEBRACION_MS = 1000;

/** Qué tanto ha escrito la persona (0 a 1): enciende las crestas de la huella. */
function avance(correo, contrasena, recuperando) {
  const texto = correo.trim();
  const deCorreo = FORMATO_CORREO.test(texto) ? 1 : Math.min(texto.length / 14, 0.85);
  return recuperando ? deCorreo : (deCorreo + Math.min(contrasena.length / 8, 1)) / 2;
}

// "Recordar mi correo": solo el correo, en este navegador (la sesión ya dura 8 horas)
const CLAVE_CORREO = "asistenciaapp.correo-recordado";
function leerCorreoRecordado() {
  try { return localStorage.getItem(CLAVE_CORREO) || ""; } catch { return ""; }
}
function recordarCorreo(correo, recordar) {
  try {
    if (recordar) localStorage.setItem(CLAVE_CORREO, correo.trim());
    else localStorage.removeItem(CLAVE_CORREO);
  } catch { /* sin almacenamiento: no se recuerda */ }
}

const TEXTO_ESTADO = {
  espera: "Listo para identificarte",
  leyendo: "Verificando…",
  error: "No se pudo iniciar sesión",
  enviado: "Revisa tu correo",
};

export default function IniciarSesion() {
  const navegar = useNavigate();
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState(leerCorreoRecordado);
  const [recordar, setRecordar] = useState(() => Boolean(leerCorreoRecordado()));
  const [contrasena, setContrasena] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState("espera");
  const [intento, setIntento] = useState(0);
  const [nombre, setNombre] = useState("");
  const temporizador = useRef(null);
  useTitulo(recuperando ? "Recupera tu contraseña" : "Inicia sesión");

  useEffect(() => () => clearTimeout(temporizador.current), []);

  // Al volver a escribir después de un error, la huella vuelve a esperar
  function escribir(cambiar) {
    return (e) => {
      cambiar(e.target.value);
      if (estado === "error" || estado === "enviado") setEstado("espera");
    };
  }

  function alternarModo() {
    setRecuperando(!recuperando);
    setMensaje(null);
    setEstado("espera");
  }

  async function enviar(e) {
    e.preventDefault();
    if (cargando) return;
    setMensaje(null); setCargando(true); setEstado("leyendo");
    const minimo = esperaMinima(LECTURA_MINIMA_MS);
    try {
      if (recuperando) {
        const r = await api("/auth/recuperar", { method: "POST", body: { correo } });
        await minimo;
        setEstado("enviado");
        setMensaje({ tipo: "exito", texto: r.mensaje });
        setCargando(false);
      } else {
        const r = await api("/auth/login", { method: "POST", body: { correo, contrasena } });
        recordarCorreo(correo, recordar);
        await minimo;
        setNombre(r.usuario.nombres.split(" ")[0]);
        setEstado("exito");
        // La sesión se guarda cuando termina la animación de entrada
        temporizador.current = setTimeout(() => {
          iniciarSesion(r);
          navegar("/panel", { state: { recienLlegado: true } });
        }, reducirMovimiento() ? 0 : CELEBRACION_MS);
      }
    } catch (error) {
      await minimo;
      setEstado("error");
      setIntento((n) => n + 1);
      setMensaje({ tipo: "error", texto: error.message });
      setCargando(false);
    }
  }

  const encendidas = estado === "leyendo" || estado === "exito"
    ? TOTAL_CRESTAS
    : Math.round(avance(correo, contrasena, recuperando) * TOTAL_CRESTAS);

  return (
    <div className="login tema-oscuro">
      <EscenarioLector
        estado={estado}
        huella={estado === "enviado" ? "espera" : estado}
        texto={estado === "exito" ? `¡Presente, ${nombre}!` : TEXTO_ESTADO[estado]}
        encendidas={encendidas}
        intento={intento}
      />

      <main className="login-panel">
        <form className="login-formulario" onSubmit={enviar} noValidate>
          <div className="login-cabeza">
            <span className="logo-acceso" aria-hidden="true"><Logo size="1.1em" /></span>
            <h1>{recuperando ? "Recupera tu contraseña" : "Inicia sesión"}</h1>
          </div>
          <p className="login-ayuda">
            {recuperando
              ? "Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva."
              : "Ingresa con tu correo y tu contraseña para entrar a tu cuenta de AsistenciaApp SENA."}
          </p>

          {mensaje && (
            <div className={`login-aviso ${mensaje.tipo}`} role={mensaje.tipo === "error" ? "alert" : "status"}>
              {mensaje.texto}
            </div>
          )}

          <label htmlFor="login-correo"><Icono nombre="correo" /> Correo electrónico</label>
          <div className="login-campo">
            <input
              id="login-correo" type="email" autoComplete="username" inputMode="email" autoFocus={!correo}
              value={correo} onChange={escribir(setCorreo)} placeholder="tu.correo@sena.edu.co"
            />
            <Icono nombre="correo" className="login-campo-icono" />
          </div>

          {!recuperando && (<>
            <label htmlFor="login-contrasena"><Icono nombre="candado" /> Contraseña</label>
            <CampoContrasena
              id="login-contrasena" value={contrasena} onChange={escribir(setContrasena)} placeholder="Tu contraseña"
              autoFocus={Boolean(correo)}
            />
            <div className="login-opciones">
              <label className="casilla-recordar">
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> Recordar mi correo
              </label>
              <button type="button" className="login-enlace fuerte" onClick={alternarModo}>¿Olvidaste tu contraseña?</button>
            </div>
          </>)}

          <button type="submit" className="boton ancho login-boton" disabled={cargando}>
            {!cargando && !recuperando && <Icono nombre="entrar" />}
            {estado === "exito" ? "Entrando…" : cargando ? "Verificando…" : recuperando ? "Enviar enlace" : "Iniciar sesión"}
          </button>

          {recuperando ? (
            <div className="login-enlaces">
              <button type="button" className="login-enlace fuerte" onClick={alternarModo}>Volver a iniciar sesión</button>
            </div>
          ) : (<>
            <p className="login-separador"><span>¿No tienes cuenta?</span></p>
            <Link className="boton ancho contorno" to="/registrarse"><Icono nombre="usuarios" /> Crear cuenta <Icono nombre="flecha" /></Link>
          </>)}
        </form>
      </main>
    </div>
  );
}
