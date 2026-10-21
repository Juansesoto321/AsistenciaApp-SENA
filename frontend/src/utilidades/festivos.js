import { useEffect, useState } from "react";
import { api } from "../servicios/api";

/**
 * Festivos de Colombia (año anterior, actual y siguiente) como un Map
 * "AAAA-MM-DD" -> nombre. El backend los calcula; mientras llegan, vacío.
 */
export function useFestivos() {
  const [festivos, setFestivos] = useState(() => new Map());
  useEffect(() => {
    api("/festivos")
      .then((lista) => setFestivos(new Map(lista.map((f) => [f.fecha, f.nombre]))))
      .catch(() => {}); // sin festivos el calendario sigue funcionando
  }, []);
  return festivos;
}
