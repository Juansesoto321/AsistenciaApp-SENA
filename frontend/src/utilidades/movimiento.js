/**
 * Ayudas para las animaciones: todas se apagan si el equipo tiene activado
 * "reducir movimiento" (accesibilidad).
 */
export const reducirMovimiento = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Las respuestas de la API llegan en milisegundos: sin una espera mínima la
 * animación de "verificando" no alcanza a verse. Con movimiento reducido, nada.
 */
export const esperaMinima = (ms) => esperar(reducirMovimiento() ? 0 : ms);
