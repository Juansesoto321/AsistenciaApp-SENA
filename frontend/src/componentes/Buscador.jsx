/**
 * Buscador de la barra de arriba: encuentra páginas, preguntas frecuentes y,
 * según el rol, fichas (personal) y usuarios (coordinación, en el backend).
 * Se maneja con el teclado: "/" lo enfoca desde cualquier parte, las flechas
 * recorren los resultados, Enter abre el elegido y Escape lo cierra.
 * `paginas`: [[ruta, nombre], …] que el rol puede abrir.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicios/api";
import { useAuth } from "../contexto/AuthContext.jsx";
import Icono from "./Iconos.jsx";
import { preguntasDe } from "../utilidades/preguntas";

const MAX = 5;
// Sin tildes ni mayúsculas: "configuracion" encuentra "Configuración"
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Buscador({ paginas }) {
  const rol = useAuth().sesion.usuario.rol;
  const navegar = useNavigate();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [fichas, setFichas] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const entrada = useRef(null);
  const caja = useRef(null);
  const q = normalizar(texto.trim());

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const enfocado = document.activeElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(enfocado?.tagName) || enfocado?.isContentEditable) return;
      e.preventDefault();
      entrada.current?.focus();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsarAfuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", alPulsarAfuera);
    return () => document.removeEventListener("mousedown", alPulsarAfuera);
  }, [abierto]);

  // Los usuarios se buscan en el backend (pueden ser cientos); espera a que deje de escribir
  useEffect(() => {
    if (rol !== "coordinador" || q.length < 2) { setUsuarios([]); return undefined; }
    const espera = setTimeout(() => {
      api(`/usuarios?buscar=${encodeURIComponent(texto.trim())}`)
        .then((lista) => setUsuarios((Array.isArray(lista) ? lista : []).slice(0, MAX)))
        .catch(() => setUsuarios([]));
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);

  useEffect(() => { setActivo(0); }, [q]);

  function cargarFichas() {
    if (rol !== "aprendiz" && fichas === null) api("/fichas").then(setFichas).catch(() => setFichas([]));
  }

  const grupos = useMemo(() => {
    if (!q) return [];
    const coincide = (...campos) => campos.some((c) => normalizar(c).includes(q));
    return [
      ["Páginas", paginas.filter(([, nombre]) => coincide(nombre)).slice(0, MAX)
        .map(([ruta, nombre]) => ({ clave: `pag${ruta}`, icono: "flecha", texto: nombre, ir: ruta }))],
      ["Preguntas frecuentes", preguntasDe(rol).map((p, i) => ({ p, i })).filter(({ p }) => coincide(p.pregunta, p.respuesta)).slice(0, 3)
        .map(({ p, i }) => ({ clave: `pre${i}`, icono: "ayuda", texto: p.pregunta, ir: `/preguntas?p=${i}` }))],
      ["Fichas", (fichas || []).filter((f) => coincide(f.numero_ficha, f.programa)).slice(0, MAX)
        .map((f) => ({ clave: `fic${f.id_ficha}`, icono: "fichas", texto: `Ficha ${f.numero_ficha}`, detalle: f.programa, ir: `/fichas/${f.id_ficha}` }))],
      ["Usuarios", usuarios.map((u) => ({
        clave: `usu${u.id_usuario}`, icono: "usuarios", texto: `${u.nombres} ${u.apellidos}`,
        detalle: `${u.rol} · ${u.documento}`, ir: `/usuarios?buscar=${encodeURIComponent(u.documento)}`,
      }))],
    ].filter(([, lista]) => lista.length);
  }, [q, fichas, usuarios, paginas, rol]);
  const resultados = grupos.flatMap(([, lista]) => lista);

  function abrir(r) {
    setAbierto(false);
    setTexto("");
    entrada.current?.blur();
    navegar(r.ir);
  }

  function alTeclear(e) {
    if (e.key === "Escape") { setAbierto(false); entrada.current?.blur(); return; }
    if (!resultados.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + resultados.length) % resultados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      abrir(resultados[activo]);
    }
  }

  const visible = abierto && Boolean(q);
  let posicion = -1;
  return (
    <div className="buscador-global" ref={caja} role="search">
      <Icono nombre="buscar" className="buscador-icono" />
      <input
        ref={entrada} type="search" value={texto} placeholder="Buscar…" aria-label="Buscar en la app (tecla /)"
        role="combobox" aria-expanded={visible} aria-controls="resultados-busqueda" aria-autocomplete="list"
        aria-activedescendant={visible && resultados[activo] ? `resultado-${resultados[activo].clave}` : undefined}
        onFocus={() => { setAbierto(true); cargarFichas(); }}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onKeyDown={alTeclear}
      />
      <kbd className="buscador-tecla" aria-hidden="true">/</kbd>
      {visible && (
        <div className="resultados-busqueda" id="resultados-busqueda" role="listbox" aria-label="Resultados">
          {!grupos.length && <p className="sin-resultados">Nada coincide con «{texto.trim()}».</p>}
          {grupos.map(([grupo, lista]) => (
            <div key={grupo} role="group" aria-label={grupo}>
              <p className="grupo-resultados" aria-hidden="true">{grupo}</p>
              {lista.map((r) => {
                posicion++;
                const i = posicion;
                return (
                  <button
                    key={r.clave} id={`resultado-${r.clave}`} type="button" role="option" tabIndex={-1}
                    aria-selected={i === activo} className="resultado"
                    onMouseEnter={() => setActivo(i)} onClick={() => abrir(r)}
                  >
                    <Icono nombre={r.icono} />
                    <span>{r.texto}{r.detalle && <small>{r.detalle}</small>}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
