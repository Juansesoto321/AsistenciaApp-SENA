import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";

// Las mismas reglas que valida el servidor
const REQUISITOS = [
  ["8 caracteres o más", (c) => c.length >= 8],
  ["Una mayúscula", (c) => /[A-Z]/.test(c)],
  ["Una minúscula", (c) => /[a-z]/.test(c)],
  ["Un número", (c) => /\d/.test(c)],
];

function CampoContrasena({ id, etiqueta, valor, alCambiar, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-contrasena">
        <input id={id} type={visible ? "text" : "password"} value={valor} autoComplete={autoComplete} onChange={(e) => alCambiar(e.target.value)} />
        <button type="button" className="boton mini suave" onClick={() => setVisible(!visible)} aria-pressed={visible}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </>
  );
}

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [telefono, setTelefono] = useState("");
  const [claves, setClaves] = useState({ actual: "", nueva: "", repetida: "" });
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api("/auth/perfil")
      .then((p) => { setPerfil(p); setTelefono(p.telefono || ""); })
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  }, []);

  const cumplidos = REQUISITOS.map(([, regla]) => regla(claves.nueva));
  const nuevaValida = cumplidos.every(Boolean);
  const coinciden = claves.nueva && claves.nueva === claves.repetida;

  async function enviar(cuerpo, exito) {
    setGuardando(true);
    try {
      await api("/auth/perfil", { method: "PUT", body: cuerpo });
      setMensaje({ tipo: "exito", texto: exito });
      return true;
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarContrasena() {
    const ok = await enviar({ contrasena_actual: claves.actual, contrasena_nueva: claves.nueva }, "Contraseña cambiada. Úsala la próxima vez que inicies sesión.");
    if (ok) setClaves({ actual: "", nueva: "", repetida: "" });
  }

  if (!perfil) return mensaje ? <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} /> : <Cargando />;
  const iniciales = `${perfil.nombres.charAt(0)}${perfil.apellidos.charAt(0)}`.toUpperCase();

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Mi perfil</h1><p>Tus datos y tu contraseña. El nombre, el documento y el rol solo los cambia un coordinador.</p></div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="dos-columnas iguales">
        <div className="tarjeta">
          <div className="perfil-cabeza">
            <div className="avatar grande" aria-hidden="true">{iniciales}</div>
            <div>
              <h3>{perfil.nombres} {perfil.apellidos}</h3>
              <span className="insignia huella" style={{ textTransform: "capitalize" }}>{perfil.rol}</span>
            </div>
          </div>
          <dl className="datos-perfil">
            <div><dt>Documento</dt><dd>{perfil.tipo_documento} {perfil.documento}</dd></div>
            <div><dt>Correo</dt><dd>{perfil.correo}</dd></div>
          </dl>
          <label htmlFor="perfil-telefono">Teléfono</label>
          <input id="perfil-telefono" type="tel" value={telefono} autoComplete="tel" onChange={(e) => setTelefono(e.target.value)} />
          <button className="boton" style={{ marginTop: 16 }} disabled={guardando || telefono === (perfil.telefono || "")}
            onClick={async () => { if (await enviar({ telefono }, "Teléfono actualizado")) setPerfil({ ...perfil, telefono }); }}>
            Guardar teléfono
          </button>
        </div>

        <div className="tarjeta">
          <h3 style={{ fontSize: 16 }}>Cambiar contraseña</h3>
          <p className="texto-suave" style={{ marginTop: 4 }}>Si entraste con una contraseña temporal que te llegó al correo, cámbiala aquí.</p>
          <CampoContrasena id="clave-actual" etiqueta="Contraseña actual" valor={claves.actual} autoComplete="current-password"
            alCambiar={(v) => setClaves({ ...claves, actual: v })} />
          <CampoContrasena id="clave-nueva" etiqueta="Contraseña nueva" valor={claves.nueva} autoComplete="new-password"
            alCambiar={(v) => setClaves({ ...claves, nueva: v })} />
          <ul className="requisitos" aria-label="Requisitos de la contraseña">
            {REQUISITOS.map(([texto], i) => (
              <li key={texto} className={cumplidos[i] ? "cumple" : ""}>{cumplidos[i] ? "✓" : "○"} {texto}</li>
            ))}
          </ul>
          <CampoContrasena id="clave-repetida" etiqueta="Repite la contraseña nueva" valor={claves.repetida} autoComplete="new-password"
            alCambiar={(v) => setClaves({ ...claves, repetida: v })} />
          {claves.repetida && !coinciden && <p className="nota-estado alerta">Las dos contraseñas nuevas no coinciden.</p>}
          <button className="boton" style={{ marginTop: 16 }} disabled={guardando || !claves.actual || !nuevaValida || !coinciden} onClick={cambiarContrasena}>
            Cambiar contraseña
          </button>
        </div>
      </div>
    </>
  );
}
