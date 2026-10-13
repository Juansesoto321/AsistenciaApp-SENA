import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../servicios/api";
import { conectarTiempoReal } from "../servicios/socket";
import { useAuth } from "../contexto/AuthContext.jsx";
import Logo from "./Logo.jsx";
import IconoSoporte from "./IconoSoporte.jsx";
import Icono from "./Iconos.jsx";
import { useTema } from "../utilidades/tema";

const SOPORTE = <IconoSoporte />;
const ico = (nombre) => <Icono nombre={nombre} />;

// Un texto suelto es el título de un grupo del menú. Lo que se usa a diario
// va arriba; la planeación y la administración, después.
const CUENTA = [
  "Mi cuenta",
  ["/notificaciones", ico("notificaciones"), "Notificaciones"],
  ["/perfil", ico("perfil"), "Mi perfil"],
  ["/soporte", SOPORTE, "Soporte"],
];
const PLANEACION = [
  "Planeación",
  ["/fichas", ico("fichas"), "Fichas"],
  ["/horarios", ico("horarios"), "Horarios"],
  ["/competencias", ico("competencias"), "Competencias"],
  ["/ambientes", ico("ambientes"), "Ambientes y lectores"],
];
const DIA_A_DIA = [
  "Día a día",
  ["/sesiones", ico("sesiones"), "Sesiones de clase"],
  ["/justificaciones", ico("justificaciones"), "Justificaciones"],
  ["/reportes", ico("reportes"), "Reportes"],
];

const MENUS = {
  coordinador: [
    ["/panel", ico("panel"), "Panel"],
    ...DIA_A_DIA,
    ...PLANEACION,
    "Administración",
    ["/usuarios", ico("usuarios"), "Usuarios"],
    ["/configuracion", ico("configuracion"), "Configuración"],
    ["/registro", ico("registro"), "Registro del sistema"],
    ...CUENTA,
  ],
  instructor: [
    ["/panel", ico("panel"), "Panel"],
    "Día a día",
    ["/sesiones", ico("sesiones"), "Mis clases de hoy"],
    ["/justificaciones", ico("justificaciones"), "Justificaciones"],
    ["/reportes", ico("reportes"), "Reportes"],
    "Mi formación",
    ["/fichas", ico("fichas"), "Mis fichas"],
    ["/horarios", ico("horarios"), "Mis horarios"],
    ["/competencias", ico("competencias"), "Competencias"],
    ...CUENTA,
  ],
  // Mismas opciones del coordinador salvo "Usuarios": el programador apoya la
  // planeacion academica pero no administra cuentas.
  programador: [
    ["/panel", ico("panel"), "Panel"],
    ...DIA_A_DIA,
    ...PLANEACION,
    "Administración",
    ["/configuracion", ico("configuracion"), "Configuración"],
    ["/registro", ico("registro"), "Registro del sistema"],
    ...CUENTA,
  ],
  aprendiz: [
    ["/panel", ico("panel"), "Panel"],
    ["/mi-asistencia", ico("asistencia"), "Mi asistencia"],
    ["/horarios", ico("horarios"), "Mi horario"],
    ["/notificaciones", ico("notificaciones"), "Notificaciones"],
    ["/perfil", ico("perfil"), "Mi perfil"],
    ["/soporte", SOPORTE, "Soporte"],
  ],
};

const CLAVE_COMPACTO = "asistenciaapp.menu-compacto";
function leerCompacto() {
  try { return localStorage.getItem(CLAVE_COMPACTO) === "1"; } catch { return false; }
}

const iniciales = ({ nombres = "", apellidos = "" }) =>
  `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase();

function Contador({ valor }) {
  if (!valor) return null;
  return <span className="contador-notif">{valor > 99 ? "99+" : valor}</span>;
}

export default function Diseno({ children }) {
  const { sesion, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const usuario = sesion.usuario;
  const menu = MENUS[usuario.rol] || [];
  const [notifPendientes, setNotifPendientes] = useState(0);
  const [porRevisar, setPorRevisar] = useState(0); // justificaciones que esperan respuesta
  const [menuAbierto, setMenuAbierto] = useState(false); // solo aplica en pantallas angostas
  const [compacto, setCompacto] = useState(() => leerCompacto()); // menú solo con íconos (computador)
  const [, cambiarTema, temaActual] = useTema();
  const revisaJustificaciones = usuario.rol !== "aprendiz";

  function alternarCompacto() {
    const nuevo = !compacto;
    setCompacto(nuevo);
    try { localStorage.setItem(CLAVE_COMPACTO, nuevo ? "1" : "0"); } catch { /* solo no se recuerda */ }
  }

  // Numeritos del menú, actualizados en vivo: notificaciones sin leer (todos)
  // y justificaciones por revisar (instructor y coordinación).
  useEffect(() => {
    const cargarNotificaciones = () =>
      api("/notificaciones/contador").then((r) => setNotifPendientes(r.pendientes)).catch(() => {});
    const cargarPorRevisar = () =>
      api("/justificaciones/pendientes/contador").then((r) => setPorRevisar(Number(r.pendientes))).catch(() => {});
    cargarNotificaciones();
    if (revisaJustificaciones) cargarPorRevisar();
    const socket = conectarTiempoReal();
    socket.on("notificaciones:actualizadas", cargarNotificaciones);
    if (revisaJustificaciones) socket.on("justificaciones:actualizadas", cargarPorRevisar);
    return () => socket.disconnect();
  }, [usuario.id, revisaJustificaciones]);

  const contadores = { "/notificaciones": notifPendientes, "/justificaciones": porRevisar };

  // En celular el menú se cierra al cambiar de página o con la tecla Escape
  useEffect(() => { setMenuAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (e) => { if (e.key === "Escape") setMenuAbierto(false); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuAbierto]);

  return (
    <div className={`aplicacion${compacto ? " compacta" : ""}`}>
      {/* Barra superior: solo se ve en celulares y tabletas (ver estilos.css) */}
      <header className="barra-superior">
        <button className="boton-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
          <Icono nombre="menu" size="1.4em" />
        </button>
        <Link to="/panel" className="marca-mini">
          <span className="icono"><Logo size="1.25em" /></span>
          AsistenciaApp
        </Link>
        <Link to="/notificaciones" className="boton-menu campana" aria-label={`Notificaciones: ${notifPendientes} sin leer`}>
          <Icono nombre="notificaciones" size="1.3em" />
          <Contador valor={notifPendientes} />
        </Link>
      </header>

      <div className={`fondo-menu ${menuAbierto ? "visible" : ""}`} onClick={() => setMenuAbierto(false)} aria-hidden="true" />

      <aside className={`barra-lateral ${menuAbierto ? "abierta" : ""}`} aria-label="Menú principal">
        <div className="marca">
          <div className="icono"><Logo size="1.45em" /></div>
          <div className="marca-texto">
            AsistenciaApp
            <small>SENA · Control de asistencia</small>
          </div>
          <button className="boton-menu cerrar-menu" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <Icono nombre="cerrar" size="1.2em" />
          </button>
        </div>
        <nav>
          {menu.map((entrada) => {
            if (typeof entrada === "string") return <p key={entrada} className="grupo-menu">{entrada}</p>;
            const [ruta, icono, nombre] = entrada;
            return (
              <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? "activo" : "")}
                title={compacto ? nombre : undefined} aria-label={compacto ? nombre : undefined}>
                <span className="enlace-menu">{icono} <span className="texto-menu">{nombre}</span></span>
                <Contador valor={contadores[ruta]} />
              </NavLink>
            );
          })}
        </nav>
        <div className="herramientas-menu">
          <button type="button" className="boton-salir boton-compacto" onClick={alternarCompacto}
            title={compacto ? "Mostrar el menú completo" : "Mostrar solo íconos"} aria-label={compacto ? "Mostrar el menú completo" : "Mostrar solo íconos"}>
            <Icono nombre={compacto ? "expandir" : "contraer"} size="1.15em" />
            <span className="texto-menu">Solo íconos</span>
          </button>
          <button type="button" className="boton-salir" onClick={() => cambiarTema(temaActual === "oscuro" ? "claro" : "oscuro")}
            title={temaActual === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} aria-label={temaActual === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            <Icono nombre={temaActual === "oscuro" ? "sol" : "luna"} size="1.15em" />
            <span className="texto-menu">{temaActual === "oscuro" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
        </div>
        <div className="pie-usuario">
          <Link to="/perfil" className="avatar" title="Mi perfil" aria-label="Mi perfil">{iniciales(usuario)}</Link>
          <div className="datos-usuario">
            <b title={`${usuario.nombres} ${usuario.apellidos}`}>{usuario.nombres} {usuario.apellidos}</b>
            <span>{usuario.rol}</span>
          </div>
          <button className="boton-salir" onClick={() => { cerrarSesion(); navegar("/"); }} title="Cerrar sesión" aria-label="Cerrar sesión">
            <Icono nombre="salir" size="1.15em" />
          </button>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
