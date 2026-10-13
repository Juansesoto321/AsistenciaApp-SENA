import { createContext, useContext, useEffect, useState } from "react";
import { cerrarSesion as limpiarSesion, guardarSesion, obtenerSesion } from "../servicios/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(obtenerSesion);

  // api.js renueva el token antes de que venza; aquí se toma el nuevo
  useEffect(() => {
    const alRenovar = (e) => setSesion(e.detail);
    window.addEventListener("sesion-renovada", alRenovar);
    return () => window.removeEventListener("sesion-renovada", alRenovar);
  }, []);

  function iniciarSesion(datos) {
    guardarSesion(datos);
    setSesion(datos);
  }

  function cerrarSesion() {
    limpiarSesion();
    setSesion(null);
  }

  return (
    <AuthContext.Provider value={{ sesion, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return contexto;
}
