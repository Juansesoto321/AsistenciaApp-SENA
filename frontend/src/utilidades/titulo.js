/**
 * Título de la pestaña según la página ("Reportes · AsistenciaApp SENA").
 * Es lo primero que anuncia el lector de pantalla al cambiar de página, y
 * distingue las pestañas abiertas (WCAG 2.4.2).
 */
import { useEffect } from "react";

const NOMBRE_APP = "AsistenciaApp SENA";

export function useTitulo(pagina) {
  useEffect(() => {
    document.title = pagina ? `${pagina} · ${NOMBRE_APP}` : `${NOMBRE_APP} · Control de asistencia`;
  }, [pagina]);
}
