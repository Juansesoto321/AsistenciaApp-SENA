/**
 * Preguntas frecuentes por rol. Las usan la página de Preguntas frecuentes y
 * el buscador. Los números (tolerancia, plazo, mínimo) son los de fábrica: la
 * coordinación puede cambiarlos en Configuración, y así lo dicen las respuestas.
 */
const TODOS = ["aprendiz", "instructor", "coordinador", "programador"];
const PERSONAL = ["instructor", "coordinador", "programador"];
const COORDINACION = ["coordinador", "programador"];

const PREGUNTAS = [
  {
    roles: ["aprendiz"], pregunta: "¿Cómo registro mi asistencia?",
    respuesta: "Cuando el instructor inicie la clase, pon tu dedo en el lector del ambiente. En la pantalla de la clase tu nombre pasa a «presente» al instante, y en tu panel aparece la hora en que marcaste.",
  },
  {
    roles: ["aprendiz"], pregunta: "¿Hasta qué hora puedo marcar sin quedar con tardanza?",
    respuesta: "El lector acepta tu huella desde 15 minutos antes del inicio hasta 10 minutos después del fin de la clase. Si marcas después de los minutos de tolerancia (15 por defecto), quedas con tardanza. La coordinación puede cambiar estos tiempos.",
  },
  {
    roles: ["aprendiz"], pregunta: "¿Qué pasa si falto a una clase?",
    respuesta: "Al cerrarse la clase quedas «ausente» y te llega un correo con un enlace para justificar. Tienes 72 horas (por defecto) para cargar la excusa; después la falta queda sin justificar.",
  },
  {
    roles: ["aprendiz"], pregunta: "¿Cómo justifico una inasistencia?",
    respuesta: "Desde «Mis justificaciones» o con el enlace del correo: elige el motivo, escribe una descripción y adjunta el soporte (por ejemplo, la cita médica). Tu instructor la aprueba o la rechaza, y te llega un aviso con la respuesta.",
  },
  {
    roles: ["aprendiz"], pregunta: "¿Cuál es el porcentaje mínimo de asistencia?",
    respuesta: "El 80 % por defecto (lo define la coordinación). Las faltas justificadas cuentan como asistencia. Si bajas del mínimo, tu panel te avisa.",
  },
  {
    roles: ["aprendiz"], pregunta: "El lector no reconoce mi huella, ¿qué hago?",
    respuesta: "Avísale a tu instructor en ese momento: puede registrarte a mano con un motivo (queda en el registro del sistema). Después pide que te vuelvan a registrar la huella en el lector.",
  },
  {
    roles: ["aprendiz"], pregunta: "¿Dónde descargo mi constancia de asistencia?",
    respuesta: "En «Mis documentos»: ahí descargas en PDF tu constancia de asistencia y tu horario de la semana.",
  },
  {
    roles: ["instructor"], pregunta: "¿Cómo inicio una clase?",
    respuesta: "En «Mis clases de hoy», toca «Iniciar sesión de hoy» en la clase. Se abre la supervisión en vivo y el lector del ambiente empieza a aceptar huellas.",
  },
  {
    roles: ["instructor", "coordinador"], pregunta: "¿Cómo registro a un aprendiz a mano?",
    respuesta: "En la clase en vivo, toca «Registro manual» en su fila, elige el estado y escribe el motivo. El cambio queda en el registro del sistema con tu nombre.",
  },
  {
    roles: ["instructor", "coordinador"], pregunta: "¿Qué pasa cuando cierro la clase?",
    respuesta: "Los aprendices que no marcaron quedan «ausentes» y les llega el correo con el enlace para justificar. Si nadie la cierra, la app la cierra sola cuando termina el horario.",
  },
  {
    roles: ["instructor", "coordinador"], pregunta: "¿Cómo reviso las justificaciones?",
    respuesta: "En «Justificaciones» ves las que esperan respuesta con su soporte. Al aprobar, la falta pasa a «justificada»; al rechazar, escribe el motivo, que le llega al aprendiz.",
  },
  {
    roles: ["instructor", "coordinador"], pregunta: "¿Puedo corregir una asistencia después de cerrar la clase?",
    respuesta: "Sí, durante las 24 horas siguientes al cierre. Pasado ese tiempo, solo la coordinación puede corregirla.",
  },
  {
    roles: ["coordinador"], pregunta: "¿Cómo creo las cuentas?",
    respuesta: "En «Usuarios»: «Nuevo usuario» para una cuenta o «Carga masiva» para subir varias desde un archivo.",
  },
  {
    roles: COORDINACION, pregunta: "¿Cómo agrego un lector de huella?",
    respuesta: "En «Ambientes y lectores» registra el serial del lector y el ambiente donde está. Cuando el lector se conecta, aparece «en línea».",
  },
  {
    roles: COORDINACION, pregunta: "¿Dónde cambio la tolerancia y el porcentaje mínimo?",
    respuesta: "En «Configuración»: minutos de tolerancia, ventana para marcar, porcentaje mínimo y horas para justificar.",
  },
  {
    roles: PERSONAL, pregunta: "¿Cómo descargo un reporte?",
    respuesta: "En «Reportes»: busca por ficha, aprendiz, estado o fechas y descarga el resultado en PDF, Excel o CSV.",
  },
  {
    roles: TODOS, pregunta: "¿Cómo cambio mi contraseña o mis datos?",
    respuesta: "Toca tu avatar, arriba a la derecha, y entra a «Mi perfil».",
  },
  {
    roles: TODOS, pregunta: "¿Cómo reporto un problema con la app?",
    respuesta: "En «Soporte» (desde el avatar o los accesos del panel): describe qué pasó y, si puedes, adjunta una captura.",
  },
  {
    roles: TODOS, pregunta: "¿Cómo busco algo rápido?",
    respuesta: "Usa el buscador de arriba (o la tecla /): encuentra páginas, preguntas frecuentes y, según tu rol, fichas y usuarios.",
  },
];

export const preguntasDe = (rol) => PREGUNTAS.filter((p) => p.roles.includes(rol));
