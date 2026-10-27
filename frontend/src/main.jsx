import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "@fontsource-variable/work-sans"; // la letra de la app, incluida en la compilación (sin internet)
import "./estilos.css";
import { AuthProvider } from "./contexto/AuthContext.jsx";
import { ConfirmarProvider } from "./componentes/Confirmar.jsx";
import { aplicarTema } from "./utilidades/tema";

aplicarTema(); // el script de index.html ya lo hizo; esto además escucha los cambios del sistema

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmarProvider>
          <App />
        </ConfirmarProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
