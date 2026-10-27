import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexto/AuthContext.jsx";
import Diseno from "./componentes/Diseno.jsx";

// Acceso público
import IniciarSesion from "./paginas/acceso/IniciarSesion.jsx";
import Registrarse from "./paginas/acceso/Registrarse.jsx";
import Restablecer from "./paginas/acceso/Restablecer.jsx";
import JustificarPublico from "./paginas/acceso/JustificarPublico.jsx";
// General (todos los roles)
import Panel from "./paginas/general/Panel.jsx";
import Notificaciones from "./paginas/general/Notificaciones.jsx";
import Soporte from "./paginas/general/Soporte.jsx";
import Perfil from "./paginas/general/Perfil.jsx";
import PreguntasFrecuentes from "./paginas/general/PreguntasFrecuentes.jsx";
// Planeación académica
import Fichas from "./paginas/academico/Fichas.jsx";
import DetalleFicha from "./paginas/academico/DetalleFicha.jsx";
import Ambientes from "./paginas/academico/Ambientes.jsx";
import ConectarLector from "./paginas/academico/ConectarLector.jsx";
import Horarios from "./paginas/academico/Horarios.jsx";
import Competencias from "./paginas/academico/Competencias.jsx";
// Asistencia
import Sesiones from "./paginas/asistencia/Sesiones.jsx";
import SesionEnVivo from "./paginas/asistencia/SesionEnVivo.jsx";
import Justificaciones from "./paginas/asistencia/Justificaciones.jsx";
import MiAsistencia from "./paginas/asistencia/MiAsistencia.jsx";
import MisJustificaciones from "./paginas/asistencia/MisJustificaciones.jsx";
import MisDocumentos from "./paginas/asistencia/MisDocumentos.jsx";
import Reportes from "./paginas/asistencia/Reportes.jsx";
// Administración
import Usuarios from "./paginas/administracion/Usuarios.jsx";
import Configuracion from "./paginas/administracion/Configuracion.jsx";
import Registro from "./paginas/administracion/Registro.jsx";

// Quién entra a cada grupo de pantallas (el backend vuelve a validarlo)
const COORDINACION = ["coordinador", "programador"];
const PERSONAL = [...COORDINACION, "instructor"];

function Protegida({ children, roles }) {
  const { sesion } = useAuth();
  const { pathname } = useLocation();
  if (!sesion) return <Navigate to="/" replace />;
  // Antes llevaba al panel sin decir nada: el panel muestra por qué (Diseno.jsx)
  if (roles && !roles.includes(sesion.usuario.rol)) return <Navigate to="/panel" replace state={{ sinPermiso: pathname }} />;
  return <Diseno>{children}</Diseno>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IniciarSesion />} />
      <Route path="/registrarse" element={<Registrarse />} />
      <Route path="/restablecer/:token" element={<Restablecer />} />
      <Route path="/justificar/:token" element={<JustificarPublico />} />

      <Route path="/panel" element={<Protegida><Panel /></Protegida>} />
      <Route path="/notificaciones" element={<Protegida><Notificaciones /></Protegida>} />
      <Route path="/soporte" element={<Protegida><Soporte /></Protegida>} />
      <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
      <Route path="/preguntas" element={<Protegida><PreguntasFrecuentes /></Protegida>} />

      <Route path="/fichas" element={<Protegida roles={PERSONAL}><Fichas /></Protegida>} />
      <Route path="/fichas/:id" element={<Protegida roles={PERSONAL}><DetalleFicha /></Protegida>} />
      <Route path="/ambientes" element={<Protegida roles={COORDINACION}><Ambientes /></Protegida>} />
      <Route path="/ambientes/conectar-lector" element={<Protegida roles={COORDINACION}><ConectarLector /></Protegida>} />
      <Route path="/horarios" element={<Protegida roles={[...PERSONAL, "aprendiz"]}><Horarios /></Protegida>} />
      <Route path="/competencias" element={<Protegida roles={PERSONAL}><Competencias /></Protegida>} />

      <Route path="/sesiones" element={<Protegida roles={PERSONAL}><Sesiones /></Protegida>} />
      <Route path="/sesiones/:id" element={<Protegida roles={PERSONAL}><SesionEnVivo /></Protegida>} />
      <Route path="/justificaciones" element={<Protegida roles={PERSONAL}><Justificaciones /></Protegida>} />
      <Route path="/mi-asistencia" element={<Protegida roles={["aprendiz"]}><MiAsistencia /></Protegida>} />
      <Route path="/mis-justificaciones" element={<Protegida roles={["aprendiz"]}><MisJustificaciones /></Protegida>} />
      <Route path="/mis-documentos" element={<Protegida roles={["aprendiz"]}><MisDocumentos /></Protegida>} />
      <Route path="/reportes" element={<Protegida roles={PERSONAL}><Reportes /></Protegida>} />

      <Route path="/usuarios" element={<Protegida roles={["coordinador"]}><Usuarios /></Protegida>} />
      <Route path="/configuracion" element={<Protegida roles={COORDINACION}><Configuracion /></Protegida>} />
      <Route path="/registro" element={<Protegida roles={COORDINACION}><Registro /></Protegida>} />

      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
