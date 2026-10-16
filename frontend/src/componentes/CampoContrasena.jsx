/**
 * Campo de contraseña de las pantallas de acceso: botón para mostrarla u
 * ocultarla y aviso de Bloq Mayús (la causa más común de "contraseña incorrecta").
 */
import { useState } from "react";

function IconoOjo({ tachado }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {tachado && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  );
}

export default function CampoContrasena({ id, value, onChange, autoComplete = "current-password", placeholder, ...props }) {
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  return (<>
    <div className="login-clave">
      <input
        id={id} type={visible ? "text" : "password"} autoComplete={autoComplete}
        value={value} onChange={onChange} placeholder={placeholder}
        onKeyUp={(e) => setMayusculas(e.getModifierState?.("CapsLock") ?? false)}
        onBlur={() => setMayusculas(false)}
        {...props}
      />
      <button
        type="button" className="login-ver-clave" onClick={() => setVisible(!visible)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible}
      >
        <IconoOjo tachado={visible} />
      </button>
    </div>
    {mayusculas && <p className="login-mayus">Bloq Mayús está activado</p>}
  </>);
}
