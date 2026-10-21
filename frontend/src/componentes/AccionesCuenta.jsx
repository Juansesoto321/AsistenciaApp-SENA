/**
 * Acciones de la cuenta, arriba a la derecha de cada página (a la altura del
 * título): cambiar el tema, las notificaciones con su número sin leer y el
 * avatar, que abre un menú con Mi perfil, Soporte y Salir de la cuenta.
 * En celular se ubican dentro de la barra superior (ver estilos.css).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexto/AuthContext.jsx";
import { useTema } from "../utilidades/tema";
import Icono from "./Iconos.jsx";
import IconoSoporte from "./IconoSoporte.jsx";

const iniciales = ({ nombres = "", apellidos = "" }) =>
  `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase();

export default function AccionesCuenta({ notificaciones = 0 }) {
  const { sesion, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [, cambiarTema, temaActual] = useTema();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const usuario = sesion.usuario;
  const oscuro = temaActual === "oscuro";

  // El menú se cierra al cambiar de página, al hacer clic afuera o con Escape
  useEffect(() => { setAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!abierto) return undefined;
    menu.current?.querySelector('[role="menuitem"]')?.focus();
    const alPulsarAfuera = (e) => { if (!contenedor.current?.contains(e.target)) setAbierto(false); };
    const alTeclear = (e) => {
      if (e.key === "Escape") { setAbierto(false); boton.current?.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      // Flechas: recorren las opciones del menú, dando la vuelta
      const opciones = [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])];
      const actual = opciones.indexOf(document.activeElement);
      const siguiente = (actual + (e.key === "ArrowDown" ? 1 : -1) + opciones.length) % opciones.length;
      opciones[siguiente]?.focus();
      e.preventDefault();
    };
    document.addEventListener("mousedown", alPulsarAfuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alPulsarAfuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  function salir() {
    cerrarSesion();
    navegar("/");
  }

  const textoTema = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <div className="acciones-cuenta" ref={contenedor}>
      <button type="button" className="accion-cuenta" onClick={() => cambiarTema(oscuro ? "claro" : "oscuro")} title={textoTema} aria-label={textoTema}>
        <Icono nombre={oscuro ? "sol" : "luna"} />
      </button>

      <Link
        to="/notificaciones" className="accion-cuenta" title="Notificaciones"
        aria-label={notificaciones ? `Notificaciones: ${notificaciones} sin leer` : "Notificaciones"}
      >
        <Icono nombre="notificaciones" />
        {notificaciones > 0 && <span className="contador-notif">{notificaciones > 99 ? "99+" : notificaciones}</span>}
      </Link>

      <span className="separador-acciones" aria-hidden="true" />

      <button
        type="button" ref={boton} className="avatar-cuenta" onClick={() => setAbierto(!abierto)}
        aria-haspopup="menu" aria-expanded={abierto} aria-label={`Cuenta de ${usuario.nombres}`} title={`${usuario.nombres} ${usuario.apellidos}`}
      >
        {iniciales(usuario)}
      </button>

      {abierto && (
        <div className="menu-cuenta" role="menu" ref={menu} aria-label="Mi cuenta">
          <div className="menu-cuenta-cabeza">
            <span className="avatar-cuenta mini" aria-hidden="true">{iniciales(usuario)}</span>
            <span>
              <b>{usuario.nombres} {usuario.apellidos}</b>
              <small>{usuario.rol}</small>
            </span>
          </div>
          <Link to="/perfil" role="menuitem" className="opcion-cuenta" onClick={() => setAbierto(false)}><Icono nombre="perfil" /> Mi perfil</Link>
          <Link to="/soporte" role="menuitem" className="opcion-cuenta" onClick={() => setAbierto(false)}><IconoSoporte /> Soporte</Link>
          <hr />
          <button type="button" role="menuitem" className="opcion-cuenta salir" onClick={salir}><Icono nombre="salir" /> Salir de la cuenta</button>
        </div>
      )}
    </div>
  );
}
