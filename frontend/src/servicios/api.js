/** Cliente HTTP con el token JWT de la sesion. */
const guardarSesion = (datos) => localStorage.setItem("sesion", JSON.stringify(datos));
const cerrarSesion = () => localStorage.removeItem("sesion");

/** Segundos de expiración que trae el token (campo `exp` del JWT). */
function expiracionDelToken(token) {
  try {
    const carga = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return carga.exp || 0;
  } catch {
    return 0;
  }
}

/**
 * Devuelve la sesión guardada, o null si no hay o si el token ya venció
 * (dura 8 horas). Así, quien vuelve al día siguiente ve el inicio de sesión
 * en vez de una pantalla que falla en la primera petición.
 */
function obtenerSesion() {
  let sesion = null;
  try {
    sesion = JSON.parse(localStorage.getItem("sesion") || "null");
  } catch {
    sesion = null;
  }
  if (sesion && expiracionDelToken(sesion.token) * 1000 <= Date.now()) {
    cerrarSesion();
    return null;
  }
  return sesion;
}

// Quien sigue usando la app no debe quedar por fuera a las 8 horas (p. ej. a
// mitad de una clase): si al token le quedan menos de 2 horas, se pide uno nuevo.
const MARGEN_RENOVACION_MS = 2 * 60 * 60 * 1000;
let renovando = null;

function renovarSiHaceFalta(sesion) {
  if (!sesion?.token || renovando) return;
  if (expiracionDelToken(sesion.token) * 1000 - Date.now() > MARGEN_RENOVACION_MS) return;
  renovando = fetch("/api/auth/renovar", { method: "POST", headers: { Authorization: `Bearer ${sesion.token}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then((nueva) => {
      if (!nueva?.token) return;
      guardarSesion(nueva);
      window.dispatchEvent(new CustomEvent("sesion-renovada", { detail: nueva })); // AuthContext toma el token nuevo
    })
    .catch(() => {})
    .finally(() => { renovando = null; });
}

async function api(ruta, opciones = {}) {
  const sesion = obtenerSesion();
  const r = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
      ...opciones.headers,
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && sesion) { cerrarSesion(); window.location.href = "/"; }
  if (!r.ok) throw new Error(datos.mensaje || "Error de servidor");
  renovarSiHaceFalta(sesion);
  return datos;
}

export { api, guardarSesion, obtenerSesion, cerrarSesion };
