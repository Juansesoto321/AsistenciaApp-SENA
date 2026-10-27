import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../servicios/api";
import { conectarTiempoReal } from "../servicios/socket";
import { useAuth } from "../contexto/AuthContext.jsx";
import { useTitulo } from "../utilidades/titulo";
import Logo from "./Logo.jsx";
import LogoSena from "./LogoSena.jsx";
import AuroraMenu from "./AuroraMenu.jsx";
import Icono from "./Iconos.jsx";
import Aviso from "./Aviso.jsx";
import AccionesCuenta from "./AccionesCuenta.jsx";
import { version } from "../../package.json";

const ico = (nombre) => <Icono nombre={nombre} />;

// Un texto suelto es el título de un grupo del menú. Lo que se usa a diario
// va arriba; la planeación y la administración, después. Notificaciones, Mi
// perfil, Soporte y Salir están arriba a la derecha (AccionesCuenta).
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

// Al final de todos los menús
const AYUDA = ["Ayuda", ["/preguntas", ico("ayuda"), "Preguntas frecuentes"]];

const MENUS = {
  coordinador: [
    ["/panel", ico("inicio"), "Inicio"],
    ...DIA_A_DIA,
    ...PLANEACION,
    "Administración",
    ["/usuarios", ico("usuarios"), "Usuarios"],
    ["/configuracion", ico("configuracion"), "Configuración"],
    ["/registro", ico("registro"), "Registro del sistema"],
    ...AYUDA,
  ],
  instructor: [
    ["/panel", ico("inicio"), "Inicio"],
    "Día a día",
    ["/sesiones", ico("sesiones"), "Mis clases de hoy"],
    ["/justificaciones", ico("justificaciones"), "Justificaciones"],
    ["/reportes", ico("reportes"), "Reportes"],
    "Mi formación",
    ["/fichas", ico("fichas"), "Mis fichas"],
    ["/horarios", ico("horarios"), "Mis horarios"],
    ["/competencias", ico("competencias"), "Competencias"],
    ...AYUDA,
  ],
  // Mismas opciones del coordinador salvo "Usuarios": el programador apoya la
  // planeacion academica pero no administra cuentas. Las clases y las
  // justificaciones las consulta, sin iniciarlas ni decidirlas.
  programador: [
    ["/panel", ico("inicio"), "Inicio"],
    ...DIA_A_DIA,
    ...PLANEACION,
    "Administración",
    ["/configuracion", ico("configuracion"), "Configuración"],
    ["/registro", ico("registro"), "Registro del sistema"],
    ...AYUDA,
  ],
  aprendiz: [
    ["/panel", ico("inicio"), "Inicio"],
    ["/mi-asistencia", ico("asistencia"), "Mi asistencia"],
    ["/mis-justificaciones", ico("justificaciones"), "Mis justificaciones"],
    ["/horarios", ico("horarios"), "Mi horario"],
    ["/mis-documentos", ico("documento"), "Mis documentos"],
    ...AYUDA,
  ],
};

// Nombre de cada página del menú (de cualquier rol), para los avisos
const NOMBRE_PAGINA = Object.fromEntries(
  Object.values(MENUS).flat().filter(Array.isArray).map(([ruta, , nombre]) => [ruta, nombre])
);
// Páginas que no están en el menú (se abren desde las acciones de la cuenta), para el título
const OTRAS_PAGINAS = { "/notificaciones": "Notificaciones", "/perfil": "Mi perfil", "/soporte": "Soporte" };
// Lo que el buscador puede abrir: el menú del rol y las páginas de la cuenta
const paginasDelRol = (menu) => [...menu.filter(Array.isArray).map(([ruta, , nombre]) => [ruta, nombre]), ...Object.entries(OTRAS_PAGINAS)];

const CLAVE_COMPACTO = "asistenciaapp.menu-compacto";
function leerCompacto() {
  try { return localStorage.getItem(CLAVE_COMPACTO) === "1"; } catch { return false; }
}

function Contador({ valor }) {
  if (!valor) return null;
  return <span className="contador-notif">{valor > 99 ? "99+" : valor}</span>;
}

export default function Diseno({ children }) {
  const { sesion } = useAuth();
  const navegar = useNavigate();
  const { pathname, state } = useLocation();
  const [avisoPermiso, setAvisoPermiso] = useState(null);
  const usuario = sesion.usuario;
  const menu = MENUS[usuario.rol] || [];
  const [notifPendientes, setNotifPendientes] = useState(0);
  const [porRevisar, setPorRevisar] = useState(0); // justificaciones que esperan respuesta
  const [menuAbierto, setMenuAbierto] = useState(false); // solo aplica en pantallas angostas
  const [compacto, setCompacto] = useState(() => leerCompacto()); // menú solo con íconos (computador)
  const [hayMas, setHayMas] = useState(false); // quedan opciones del menú más abajo
  const menuRef = useRef(null);
  const abrirMenuRef = useRef(null);
  const cerrarMenuRef = useRef(null);
  const contenidoRef = useRef(null);
  const devolverFoco = useRef(false); // al cerrar el cajón con Escape o la X, el foco vuelve a "Abrir menú"
  const revisaJustificaciones = ["instructor", "coordinador"].includes(usuario.rol); // el programador solo las consulta

  // Título de la pestaña: el nombre de la página en el menú de este rol; las de
  // detalle (/fichas/12, /sesiones/5) toman el de su sección
  const paginaActual = menu.find((e) => Array.isArray(e) && (pathname === e[0] || pathname.startsWith(`${e[0]}/`)));
  useTitulo(paginaActual?.[2] || OTRAS_PAGINAS[pathname]);

  function alternarCompacto() {
    const nuevo = !compacto;
    setCompacto(nuevo);
    try { localStorage.setItem(CLAVE_COMPACTO, nuevo ? "1" : "0"); } catch { /* solo no se recuerda */ }
  }

  // Numeritos actualizados en vivo: notificaciones sin leer (todos, en la
  // campana) y justificaciones por revisar (instructor y coordinación, en el menú).
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

  const contadores = { "/justificaciones": porRevisar };

  // Si el menú no cabe, el final se desvanece mientras queden opciones abajo
  useEffect(() => {
    const nav = menuRef.current;
    if (!nav) return undefined;
    const revisar = () => setHayMas(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2);
    revisar();
    nav.addEventListener("scroll", revisar, { passive: true });
    const observador = new ResizeObserver(revisar);
    observador.observe(nav);
    return () => { nav.removeEventListener("scroll", revisar); observador.disconnect(); };
  }, [compacto]);

  // Se llegó aquí porque la página pedida es de otro rol (App.jsx): decirlo, una vez
  useEffect(() => {
    if (!state?.sinPermiso) return;
    const pagina = NOMBRE_PAGINA[state.sinPermiso];
    setAvisoPermiso({
      tipo: "error",
      texto: `No tienes permiso para abrir ${pagina ? `«${pagina}»` : "esa página"}. Te llevamos al panel.`,
    });
    navegar(pathname, { replace: true, state: null }); // que no se repita al recargar
  }, [state]);

  function cerrarMenu() {
    devolverFoco.current = true;
    setMenuAbierto(false);
  }

  function saltarAlContenido(e) {
    e.preventDefault();
    contenidoRef.current?.focus();
  }

  // En celular el menú se cierra al cambiar de página o con la tecla Escape
  useEffect(() => { setMenuAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (e) => { if (e.key === "Escape") cerrarMenu(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuAbierto]);

  // Al abrir el cajón el foco entra en él (el resto queda inerte detrás del velo);
  // al cerrarlo vuelve al botón que lo abrió
  useEffect(() => {
    if (menuAbierto) cerrarMenuRef.current?.focus();
    else if (devolverFoco.current) {
      devolverFoco.current = false;
      abrirMenuRef.current?.focus();
    }
  }, [menuAbierto]);

  // Si la pantalla se ensancha con el cajón abierto (al girar una tableta), se
  // cierra: en computador no hay cajón y la página quedaría inerte
  useEffect(() => {
    const ancha = window.matchMedia("(min-width: 861px)");
    const alCambiar = () => { if (ancha.matches) setMenuAbierto(false); };
    ancha.addEventListener("change", alCambiar);
    return () => ancha.removeEventListener("change", alCambiar);
  }, []);

  // "inert" (atributo HTML): React 18 no lo conoce como booleano, va como texto vacío
  const inerte = menuAbierto ? "" : undefined;

  return (
    <div className={`aplicacion${compacto ? " compacta" : ""}`}>
      <a href="#contenido" className="saltar-contenido" onClick={saltarAlContenido}>Saltar al contenido</a>
      {/* Barra superior: solo se ve en celulares y tabletas (ver estilos.css) */}
      <header className="barra-superior" inert={inerte}>
        <button ref={abrirMenuRef} className="boton-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
          <Icono nombre="menu" size="1.4em" />
        </button>
        <Link to="/panel" className="marca-mini">
          <span className="icono"><Logo size="1.25em" /></span>
          <span className="marca-mini-texto">AsistenciaApp SENA</span>
        </Link>
      </header>

      <div className={`fondo-menu ${menuAbierto ? "visible" : ""}`} onClick={cerrarMenu} aria-hidden="true" />

      <aside className={`barra-lateral ${menuAbierto ? "abierta" : ""}`} aria-label="Menú principal">
        <div className="marca">
          <LogoSena className="marca-sena-logo" size="62px" titulo="SENA" />
          {/* El menú es angosto: "SENA" va en su propia línea, como parte del
              nombre; el nombre completo de la entidad sale en el inicio de sesión */}
          <div className="marca-texto">
            AsistenciaApp
            <small className="marca-sena">Control de asistencia</small>
            <small className="marca-version">v{version}</small>
          </div>
          <button type="button" className="boton-salir boton-compacto" onClick={alternarCompacto}
            title={compacto ? "Mostrar el menú completo" : "Mostrar solo íconos"} aria-label={compacto ? "Mostrar el menú completo" : "Mostrar solo íconos"}>
            <Icono nombre={compacto ? "expandir" : "contraer"} size="1.15em" />
          </button>
          <button ref={cerrarMenuRef} className="boton-menu cerrar-menu" onClick={cerrarMenu} aria-label="Cerrar menú">
            <Icono nombre="cerrar" size="1.2em" />
          </button>
        </div>
        <nav ref={menuRef} className={hayMas ? "hay-mas" : undefined}>
          {menu.map((entrada) => {
            if (typeof entrada === "string") return <p key={entrada} className="grupo-menu">{entrada}</p>;
            const [ruta, icono, nombre] = entrada;
            // Solo con íconos el nombre va en aria-label, que tapa el número: se incluye aquí
            const etiqueta = contadores[ruta] ? `${nombre}: ${contadores[ruta]} por revisar` : nombre;
            return (
              <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? "activo" : "")}
                title={compacto ? etiqueta : undefined} aria-label={compacto ? etiqueta : undefined}>
                <span className="enlace-menu">{icono} <span className="texto-menu">{nombre}</span></span>
                <Contador valor={contadores[ruta]} />
              </NavLink>
            );
          })}
        </nav>
        <p className="lema">Formación <span>para la vida</span></p>
        <AuroraMenu />
      </aside>
      <main className="contenido" id="contenido" ref={contenidoRef} tabIndex={-1} inert={inerte}>
        <AccionesCuenta notificaciones={notifPendientes} paginas={paginasDelRol(menu)} />
        {/* La key cambia con la página: el contenido nuevo entra con una animación corta (.vista) */}
        <div key={pathname} className="vista">{children}</div>
        <footer className="pie-app">
          <span className="pie-marca"><LogoSena size="30px" /> <b>Servicio Nacional de Aprendizaje</b> · SENA © {new Date().getFullYear()}</span>
          <span className="pie-lemas">Tecnología · Talento · Innovación</span>
        </footer>
      </main>
      <Aviso mensaje={avisoPermiso} alCerrar={() => setAvisoPermiso(null)} />
    </div>
  );
}
