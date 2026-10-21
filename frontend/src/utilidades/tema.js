/**
 * Tema claro / oscuro. La preferencia ("claro", "oscuro" o "sistema") se
 * guarda en este navegador; "sistema" sigue la configuración del equipo.
 * Quien no ha elegido ve el oscuro: es el diseño principal de la app.
 * index.html aplica el tema antes de pintar la página para que no parpadee.
 */
import { useEffect, useState } from "react";

const CLAVE = "asistenciaapp.tema";
const consultaOscuro = () => window.matchMedia?.("(prefers-color-scheme: dark)");
const oyentes = new Set();

export function leerPreferencia() {
  try {
    return localStorage.getItem(CLAVE) || "oscuro";
  } catch {
    return "oscuro"; // navegador sin almacenamiento (modo privado estricto)
  }
}

/** Pone data-tema="claro" | "oscuro" en <html>; el CSS hace el resto. */
export function aplicarTema(preferencia = leerPreferencia()) {
  const oscuro = preferencia === "oscuro" || (preferencia === "sistema" && !!consultaOscuro()?.matches);
  document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#0c0d0d" : "#0e2310");
}

export function cambiarPreferencia(preferencia) {
  try { localStorage.setItem(CLAVE, preferencia); } catch { /* se aplica igual, solo no se recuerda */ }
  aplicarTema(preferencia);
  oyentes.forEach((avisar) => avisar(preferencia));
}

// Si la preferencia es "sistema", el tema cambia cuando cambia el del equipo
consultaOscuro()?.addEventListener?.("change", () => {
  if (leerPreferencia() === "sistema") aplicarTema("sistema");
});

/** [preferencia, cambiar, temaEfectivo] para cualquier componente. */
export function useTema() {
  const [preferencia, setPreferencia] = useState(leerPreferencia);
  useEffect(() => {
    oyentes.add(setPreferencia);
    return () => oyentes.delete(setPreferencia);
  }, []);
  const efectivo = document.documentElement.dataset.tema || "claro";
  return [preferencia, cambiarPreferencia, efectivo];
}
