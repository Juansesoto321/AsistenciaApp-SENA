import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import Aviso from "../../componentes/Aviso.jsx";
import Icono from "../../componentes/Iconos.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";

/**
 * Asistente para conectar el lector real (ZKTeco SenseFace 2A) por WiFi: qué
 * tocar en el lector, qué dirección y puerto escribirle y, en vivo, cuándo
 * llama. Un lector que llama y no está registrado se asocia a un ambiente aquí
 * mismo, sin escribir el serial. Las rutas de menú son las del manual del equipo.
 */
const CONSULTA_MS = 3000; // mientras se configura el lector, se mira cada 3 s si ya llamó

// Las IP de redes virtuales (Docker, WSL, VirtualBox) no sirven para el lector
const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|bluetooth/i;
const INALAMBRICA = /wi-?fi|wlan|wireless|inal[aá]mbrica/i;
// La zona con cobertura inalámbrica de Windows siempre usa 192.168.137.1
const HOTSPOT_WINDOWS = /^192\.168\.137\./;

function etiquetaRed({ nombre, ip }) {
  if (HOTSPOT_WINDOWS.test(ip)) return "Zona con cobertura (hotspot) de este computador";
  if (INALAMBRICA.test(nombre)) return `Red Wi-Fi (${nombre})`;
  if (/ethernet|cable/i.test(nombre)) return `Red por cable (${nombre})`;
  return nombre;
}

/** Las IP de este computador, la más probable para el lector primero. */
function ipsSugeridas(conexion) {
  const orden = (i) => (INALAMBRICA.test(i.nombre) ? 0 : HOTSPOT_WINDOWS.test(i.ip) ? 1 : 2);
  const lista = (conexion?.ips || [])
    .filter((i) => !VIRTUAL.test(i.nombre) && !i.ip.startsWith("169.254."))
    .map((i) => ({ ...i, etiqueta: etiquetaRed(i) }))
    .sort((a, b) => orden(a) - orden(b));
  // Si la app se abrió por la IP de la red (y no por localhost), esa también sirve
  const host = window.location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.startsWith("127.") && !lista.some((i) => i.ip === host)) {
    lista.unshift({ nombre: host, ip: host, etiqueta: "La dirección con la que abriste la app" });
  }
  return lista;
}

function Copiable({ valor, grande }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => navigator.clipboard?.writeText(String(valor)).then(() => {
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  });
  return (
    <span className={`conectar-valor${grande ? " grande" : ""}`}>
      <code>{valor}</code>
      <button type="button" className="boton mini suave" onClick={copiar} aria-label={`Copiar ${valor}`}>
        <Icono nombre={copiado ? "verificado" : "copiar"} /> {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}

/** Ruta de menú del lector: M/OK → COMM. → Cloud Server Settings */
function Ruta({ pasos }) {
  return (
    <span className="conectar-ruta">
      {pasos.map((p, i) => <span key={p}>{i > 0 && <span className="separador" aria-hidden="true">›</span>}<kbd>{p}</kbd></span>)}
    </span>
  );
}

function Paso({ numero, titulo, children, listo }) {
  return (
    <li className={`tarjeta conectar-paso${listo ? " listo" : ""}`}>
      <span className="conectar-numero" aria-hidden="true">{listo ? <Icono nombre="verificado" /> : numero}</span>
      <div>
        <h2>{titulo}</h2>
        {children}
      </div>
    </li>
  );
}

export default function ConectarLector() {
  const [conexion, setConexion] = useState(null);
  const [ambientes, setAmbientes] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [idFicha, setIdFicha] = useState("");
  const [aprendices, setAprendices] = useState([]);
  const [eleccion, setEleccion] = useState({}); // serial -> id_ambiente elegido
  const [mensaje, setMensaje] = useState(null);

  const cargarAmbientes = () => api("/ambientes").then(setAmbientes).catch(() => {});
  useEffect(() => {
    const consultar = () => api("/dispositivos/conexion").then(setConexion).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
    consultar();
    cargarAmbientes();
    api("/fichas").then((fs) => { setFichas(fs); if (fs.length === 1) setIdFicha(String(fs[0].id_ficha)); }).catch(() => {});
    const reloj = setInterval(consultar, CONSULTA_MS);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    if (!idFicha) return setAprendices([]);
    api(`/fichas/${idFicha}/matriculas`)
      .then((ms) => setAprendices(ms.filter((m) => m.estado === "activa")))
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  }, [idFicha]);

  async function asociar(serial) {
    const idAmbiente = eleccion[serial];
    if (!idAmbiente) return setMensaje({ tipo: "error", texto: "Elige el ambiente donde quedará el lector" });
    try {
      await api(`/ambientes/${idAmbiente}/dispositivo`, { method: "POST", body: { serial, modelo: "ZKTeco SenseFace 2A" } });
      setMensaje({ tipo: "exito", texto: `Lector ${serial} asociado. Ya puede enviar las marcas de ese ambiente.` });
      cargarAmbientes();
      setConexion(await api("/dispositivos/conexion"));
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  const ips = ipsSugeridas(conexion);
  const ip = ips[0]?.ip;
  const puerto = conexion?.puerto ?? "…";
  const detectados = conexion?.detectados || [];
  const libres = ambientes.filter((a) => !a.serial);
  const conectado = detectados.some((d) => d.registrado && !d.bloqueado);

  return (<>
    <div className="cabecera-pagina">
      <div>
        <h1>Conectar un lector</h1>
        <p>Sigue los pasos con el lector en la mano. Cuando el lector llame a este computador aparece en «Señal del lector», en vivo.</p>
      </div>
      <Link className="boton suave" to="/ambientes">Volver a ambientes y lectores</Link>
    </div>
    <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

    <div className="conectar">
      <ol className="conectar-pasos">
        <Paso numero={1} titulo="Pon el lector y este computador en la misma red WiFi">
          <p>Lo más seguro en un evento es el <b>punto de acceso (hotspot) de un celular</b>: las redes WiFi públicas suelen no dejar que los equipos se vean entre sí. Conecta este computador a esa red.</p>
          <p>Otra opción: que este computador cree la red en <b>Configuración › Red e Internet › Zona con cobertura inalámbrica móvil</b> y conectar el lector a ella (la dirección es entonces <code>192.168.137.1</code>).</p>
          <p>En el lector: <Ruta pasos={["M/OK", "COMM.", "Wi-Fi Settings"]} />. Activa el Wi-Fi, toca la red, escribe la contraseña y presiona <kbd>M/OK</kbd>. Arriba en la pantalla aparece el ícono del WiFi.</p>
        </Paso>

        <Paso numero={2} titulo="Abre el puerto en este computador (una sola vez)">
          <p>Windows bloquea lo que llega desde la red. En la carpeta del proyecto haz doble clic en <code>herramientas\preparar-lector.bat</code> y acepta el permiso de administrador: abre el puerto <b>{puerto}</b> y muestra la IP de este computador.</p>
        </Paso>

        <Paso numero={3} titulo="Escribe estos datos en el lector">
          <div className="conectar-datos">
            <div>
              <span className="conectar-etiqueta">Server Address (IP de este computador)</span>
              {ip ? (<>
                <Copiable valor={ip} grande />
                <span className="conectar-nota conectar-red">{ips[0].etiqueta}</span>
              </>) : (
                <p className="conectar-nota">
                  {conexion?.enDocker
                    ? "La app corre en Docker y desde ahí no se ve la IP del computador. "
                    : "No encontré la IP de la red. "}
                  Usa la que muestra <code>preparar-lector.bat</code>, o en una terminal escribe <code>ipconfig</code> y busca la «Dirección IPv4» del adaptador Wi-Fi.
                </p>
              )}
              {ips.length > 1 && (
                <details className="conectar-otras">
                  <summary>Otras direcciones de este computador</summary>
                  <ul>{ips.slice(1).map((i) => <li key={i.ip}><code>{i.ip}</code> · {i.etiqueta}</li>)}</ul>
                </details>
              )}
            </div>
            <div>
              <span className="conectar-etiqueta">Server Port</span>
              <Copiable valor={puerto} grande />
            </div>
          </div>
          <ol className="conectar-lista">
            <li><Ruta pasos={["M/OK", "COMM.", "PC Connection"]} />: <b>HTTPS</b> apagado. Si estaba encendido, el lector pide confirmar y se reinicia.</li>
            <li><Ruta pasos={["M/OK", "COMM.", "Cloud Server Settings"]} />: <b>Enable Domain Name</b> apagado, <b>Server Address</b> la IP de arriba, <b>Server Port</b> {puerto} y <b>Enable Proxy Server</b> apagado.</li>
            <li><Ruta pasos={["M/OK", "System", "Date Time"]} />: la fecha y hora de hoy, zona horaria GMT-05:00 (Bogotá). Así cada marca llega con su hora real.</li>
          </ol>
        </Paso>

        <Paso numero={4} titulo="Asocia el lector a un ambiente" listo={conectado}>
          <p>En menos de un minuto el lector llama y aparece en <b>Señal del lector</b>. Si es nuevo, elige el ambiente y toca <b>Asociar</b>. Su número de serie también está en <Ruta pasos={["M/OK", "System Info", "Device Info"]} />.</p>
          {!libres.length && <p className="conectar-nota">Todos los ambientes ya tienen lector. Crea uno en <Link to="/ambientes">Ambientes y lectores</Link>.</p>}
        </Paso>

        <Paso numero={5} titulo="Registra a los aprendices en el lector">
          <p>Por cada aprendiz: <Ruta pasos={["M/OK", "User Mgt.", "New User"]} />. En <b>User ID</b> escribe su <b>número de documento</b> (así la app sabe quién marcó), toca <b>Fingerprint</b> y pon el mismo dedo 3 veces.</p>
          <label htmlFor="conectar-ficha">Ficha</label>
          <select id="conectar-ficha" value={idFicha} onChange={(e) => setIdFicha(e.target.value)}>
            <option value="">Elige la ficha…</option>
            {fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha} · {f.programa}</option>)}
          </select>
          {aprendices.length > 0 && (
            <div className="tabla-desplazable conectar-aprendices">
              <table className="tabla">
                <thead><tr><th>Aprendiz</th><th>User ID (documento)</th></tr></thead>
                <tbody>
                  {aprendices.map((a) => (
                    <tr key={a.id_matricula}>
                      <td>{a.nombres} {a.apellidos}</td>
                      <td><Copiable valor={a.documento} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paso>

        <Paso numero={6} titulo="Pruébalo">
          <p>Inicia la clase de ese ambiente (o la <b>clase de demostración</b>) en <Link to="/sesiones">Sesiones de clase</Link>, pon el dedo en el lector y mira la marca llegar en vivo.</p>
        </Paso>
      </ol>

      <aside className="tarjeta conectar-senal" aria-live="polite">
        <h2><Icono nombre="wifi" /> Señal del lector</h2>
        {!detectados.length ? (
          <div className="conectar-esperando">
            <p><span className="pulso" aria-hidden="true" /><b>Esperando a que el lector llame…</b> Aparece aquí en cuanto guardes los datos del paso 3 (puede tardar hasta un minuto).</p>
            <p className="conectar-nota">¿Pasan dos minutos y nada? Revisa que estén en la misma red, que hayas corrido <code>preparar-lector.bat</code>, y prueba en el lector <Ruta pasos={["COMM.", "Network Diagnosis"]} /> con la IP de este computador.</p>
          </div>
        ) : (
          <ul className="conectar-detectados">
            {detectados.map((d) => (
              <li key={d.serial}>
                <div className="conectar-equipo">
                  <b>{d.serial}</b>
                  <span>IP {d.ip} · <span title={fechaHora(d.ultimaVez)}>{haceCuanto(d.ultimaVez)}</span></span>
                </div>
                {d.bloqueado ? (
                  <p className="conectar-alerta">
                    Llegó, pero la IP <code>{d.ip}</code> no está en <code>IP_LECTORES</code>: agrégala en el archivo <code>.env</code> (o deja la variable vacía) y reinicia el backend.
                  </p>
                ) : d.registrado ? (
                  <span className="insignia activa"><span className="pulso" aria-hidden="true" /> Conectado · ambiente {d.ambiente}</span>
                ) : (
                  <div className="conectar-asociar">
                    <select aria-label={`Ambiente para el lector ${d.serial}`} value={eleccion[d.serial] || ""} onChange={(e) => setEleccion({ ...eleccion, [d.serial]: e.target.value })}>
                      <option value="">Ambiente…</option>
                      {libres.map((a) => <option key={a.id_ambiente} value={a.id_ambiente}>{a.numero_ambiente} · {a.sede_centro}</option>)}
                    </select>
                    <button type="button" className="boton mini" onClick={() => asociar(d.serial)}>Asociar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  </>);
}
