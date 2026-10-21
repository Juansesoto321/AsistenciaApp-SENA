/**
 * Pruebas de integración: la API real (rutas -> controladores -> servicios ->
 * modelos) contra una base PostgreSQL de pruebas. Recorren el ciclo completo
 * de una clase y verifican cada error corregido para que no vuelva a aparecer.
 *
 * Las pruebas van en orden: cada una parte del estado que dejó la anterior.
 */
require("../preparar");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const entorno = require("./entorno");

let e = null;
const tokens = {};
let idSesion = null;
const LECTOR = { "x-serial": "LECTOR-PRUEBA", "x-clave-api": "clave-de-prueba" };

before(async () => {
  e = await entorno.iniciar();
  if (!e) return;
  for (const rol of ["coordinador", "instructor", "otro", "ana", "programador"]) {
    tokens[rol] = await e.iniciarSesionComo(`${rol}@prueba.co`);
  }
});

after(async () => {
  await entorno.detener();
});

/** Omite la prueba si no hay PostgreSQL (en vez de fallar). */
function prueba(nombre, cuerpo) {
  test(nombre, async (t) => {
    if (!e) return t.skip("PostgreSQL no disponible");
    await cuerpo(t);
  });
}

// ---------- Autenticación ----------

prueba("login correcto devuelve token y rol; incorrecto responde 401 genérico", async () => {
  const ok = await e.peticion("POST", "/api/auth/login", { cuerpo: { correo: "ANA@prueba.co ", contrasena: e.CONTRASENA } });
  assert.equal(ok.estado, 200);
  assert.equal(ok.datos.usuario.rol, "aprendiz");

  const mal = await e.peticion("POST", "/api/auth/login", { cuerpo: { correo: "nadie@prueba.co", contrasena: "x" } });
  assert.equal(mal.estado, 401);
  assert.equal(mal.datos.mensaje, "Correo o contraseña incorrectos");
});

prueba("5 intentos fallidos bloquean la cuenta; al vencer el bloqueo el conteo vuelve a cero", async () => {
  const intentar = () => e.peticion("POST", "/api/auth/login", { cuerpo: { correo: "dora@prueba.co", contrasena: "Mala1234" } });
  for (let i = 0; i < 4; i++) assert.equal((await intentar()).estado, 401);
  assert.match((await intentar()).datos.mensaje, /bloqueada/i);
  assert.equal((await intentar()).estado, 403); // bloqueada

  // Simula que pasaron los 15 minutos
  await e.pool.query("UPDATE usuario SET bloqueado_hasta = NOW() - INTERVAL '1 minute' WHERE correo = 'dora@prueba.co'");
  // Error corregido: antes el primer fallo tras el bloqueo volvía a bloquear
  for (let i = 0; i < 4; i++) {
    const r = await intentar();
    assert.equal(r.estado, 401);
    assert.doesNotMatch(r.datos.mensaje, /bloqueada/i);
  }
  // ...y el quinto fallo nuevo sí vuelve a bloquear
  assert.match((await intentar()).datos.mensaje, /bloqueada/i);
  assert.equal((await intentar()).estado, 403);
});

prueba("el registro sin documento responde 400 (antes era un error 500)", async () => {
  const r = await e.peticion("POST", "/api/auth/registro", {
    cuerpo: { nombres: "Sin", apellidos: "Documento", correo: "sin@prueba.co", contrasena: "Segura123", rol: "aprendiz" },
  });
  assert.equal(r.estado, 400);
});

// ---------- Horarios ----------

prueba("un horario que se cruza con otro del mismo ambiente se rechaza", async () => {
  const r = await e.peticion("POST", "/api/horarios", {
    token: tokens.coordinador,
    cuerpo: {
      id_ficha: e.ids.ficha, id_ambiente: e.ids.ambiente, id_instructor: e.ids.otroInstructor,
      id_competencia: e.ids.competencia, dia_semana: e.ids.diaDeHoy, hora_inicio: "08:00", hora_fin: "10:00",
    },
  });
  assert.equal(r.estado, 400);
  assert.match(r.datos.mensaje, /Conflicto de ambiente/);
});

prueba("un horario que termina antes de empezar se rechaza con un mensaje claro", async () => {
  const r = await e.peticion("POST", "/api/horarios", {
    token: tokens.coordinador,
    cuerpo: {
      id_ficha: e.ids.ficha, id_ambiente: e.ids.ambiente, id_instructor: e.ids.otroInstructor,
      id_competencia: e.ids.competencia, dia_semana: 1, hora_inicio: "10:00", hora_fin: "08:00",
    },
  });
  assert.equal(r.estado, 400);
  assert.match(r.datos.mensaje, /hora de fin/);
});

const nuevoHorario = (cambios) => e.peticion("POST", "/api/horarios", {
  token: tokens.coordinador,
  cuerpo: {
    id_ficha: e.ids.ficha, id_ambiente: e.ids.otroAmbiente, id_instructor: e.ids.otroInstructor,
    id_competencia: e.ids.competencia, hora_inicio: "14:00", hora_fin: "15:00",
    ...cambios,
  },
});
const manana = () => (e.ids.diaDeHoy + 1) % 7;
const pasado = () => (e.ids.diaDeHoy + 2) % 7;

prueba("toda clase necesita una competencia, y el RAP debe ser de esa competencia", async () => {
  const sinCompetencia = await nuevoHorario({ id_competencia: undefined, dia_semana: manana() });
  assert.equal(sinCompetencia.estado, 400);
  assert.match(sinCompetencia.datos.mensaje, /competencia/);

  const rapAjeno = await nuevoHorario({ dia_semana: manana(), id_rap: e.ids.rap_otraCompetencia });
  assert.equal(rapAjeno.estado, 400);
  assert.match(rapAjeno.datos.mensaje, /no pertenece/);
});

prueba("una clase se crea en varios días a la vez, en el trimestre en curso", async () => {
  const r = await nuevoHorario({ dias_semana: [manana(), pasado()], id_rap: e.ids.rap_competencia });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.horarios.length, 2);
  assert.ok(r.datos.horarios.every((h) => h.trimestre === 1 && h.id_competencia === e.ids.competencia));
});

prueba("la misma hora en otro trimestre no choca; en el mismo trimestre sí", async () => {
  const otroTrimestre = await nuevoHorario({ dia_semana: manana(), trimestre: 2 });
  assert.equal(otroTrimestre.estado, 201);
  const mismoTrimestre = await nuevoHorario({ dia_semana: manana(), trimestre: 2, id_instructor: e.ids.instructor });
  assert.equal(mismoTrimestre.estado, 400);
});

prueba("una ficha no puede tener dos clases a la misma hora aunque cambien ambiente e instructor", async () => {
  // La ficha ya tiene clase hoy de 00:00 a 23:59 en el ambiente P-1 con el instructor titular
  const r = await nuevoHorario({ dia_semana: e.ids.diaDeHoy, hora_inicio: "09:00", hora_fin: "10:00" });
  assert.equal(r.estado, 400);
  assert.match(r.datos.mensaje, /Conflicto de ficha/);
});

prueba("dos guardados simultáneos de la misma clase dejan una sola (antes quedaba duplicada)", async () => {
  const dia = (e.ids.diaDeHoy + 3) % 7;
  const misma = { dia_semana: dia, hora_inicio: "16:00", hora_fin: "17:00" };
  const [a, b] = await Promise.all([nuevoHorario(misma), nuevoHorario(misma)]);
  assert.deepEqual([a.estado, b.estado].sort(), [201, 400]);
  const r = await e.pool.query(
    "SELECT COUNT(*)::int AS n FROM horario WHERE id_ficha = $1 AND dia_semana = $2 AND hora_inicio = '16:00'",
    [e.ids.ficha, dia]
  );
  assert.equal(r.rows[0].n, 1);
  // Y la base también lo impide (migración 008)
  const indice = await e.pool.query("SELECT 1 FROM pg_indexes WHERE indexname = 'idx_horario_sin_duplicados'");
  assert.equal(indice.rows.length, 1);
});

prueba("una clase de un trimestre futuro no aparece hoy ni se puede iniciar", async () => {
  const futura = await nuevoHorario({ dia_semana: e.ids.diaDeHoy, trimestre: 3, hora_inicio: "09:00", hora_fin: "10:00" });
  assert.equal(futura.estado, 201);
  const hoy = await e.peticion("GET", "/api/sesiones/hoy", { token: tokens.otro });
  assert.ok(!hoy.datos.some((h) => h.id_horario === futura.datos.id_horario));
  const iniciar = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.otro, cuerpo: { id_horario: futura.datos.id_horario } });
  assert.equal(iniciar.estado, 400);
});

prueba("el aprendiz solo ve el horario de su propia ficha (Mi horario)", async () => {
  const propia = await e.peticion("GET", "/api/horarios", { token: tokens.ana });
  assert.equal(propia.estado, 200);
  assert.ok(propia.datos.length > 0);
  assert.ok(propia.datos.every((h) => h.id_ficha === e.ids.ficha));

  // Un aprendiz sin matrícula no ve nada, aunque pida una ficha ajena por filtro
  const tokenAjeno = await e.iniciarSesionComo("ciro@prueba.co");
  const ajena = await e.peticion("GET", `/api/horarios?id_ficha=${e.ids.ficha}`, { token: tokenAjeno });
  assert.equal(ajena.estado, 200);
  assert.deepEqual(ajena.datos, []);
});

// ---------- Sesión de clase y marcación ----------

prueba("el instructor titular inicia la sesión de hoy; otro instructor no puede", async () => {
  const ajeno = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.otro, cuerpo: { id_horario: e.ids.horario } });
  assert.equal(ajeno.estado, 403);

  const r = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.instructor, cuerpo: { id_horario: e.ids.horario } });
  assert.equal(r.estado, 200);
  idSesion = r.datos.id_sesion;
  assert.ok(idSesion);
});

prueba("el detalle de la sesión solo lo ve el personal (antes cualquier aprendiz podía)", async () => {
  assert.equal((await e.peticion("GET", `/api/sesiones/${idSesion}`, { token: tokens.ana })).estado, 403);
  assert.equal((await e.peticion("GET", `/api/sesiones/${idSesion}`, { token: tokens.otro })).estado, 403);
  const r = await e.peticion("GET", `/api/sesiones/${idSesion}`, { token: tokens.coordinador });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.aprendices.length, 2);
});

prueba("un id que no es número responde 400 (antes era un error 500)", async () => {
  assert.equal((await e.peticion("GET", "/api/sesiones/abc", { token: tokens.coordinador })).estado, 400);
});

prueba("huella enrolada marca una vez; la segunda es duplicada; una desconocida no se reconoce", async () => {
  const enrolar = await e.peticion("POST", "/api/biometria/enrolar", {
    token: tokens.instructor,
    cuerpo: { id_aprendiz: e.ids.aprendiz, acepta_consentimiento: true, lectura1: "dedo-ana", lectura2: "dedo-ana" },
  });
  assert.equal(enrolar.estado, 201);

  const primera = await e.peticion("POST", "/api/lector/marcacion", { encabezados: LECTOR, cuerpo: { lectura: "dedo-ana" } });
  assert.equal(primera.estado, 200);
  assert.equal(primera.datos.resultado, "ok");

  const segunda = await e.peticion("POST", "/api/lector/marcacion", { encabezados: LECTOR, cuerpo: { lectura: "dedo-ana" } });
  assert.equal(segunda.datos.resultado, "duplicada");

  const extrana = await e.peticion("POST", "/api/lector/marcacion", { encabezados: LECTOR, cuerpo: { lectura: "dedo-desconocido" } });
  assert.equal(extrana.estado, 404);
  assert.equal(extrana.datos.resultado, "no_reconocida");
});

prueba("un lector con clave incorrecta no puede marcar", async () => {
  const r = await e.peticion("POST", "/api/lector/marcacion", {
    encabezados: { "x-serial": "LECTOR-PRUEBA", "x-clave-api": "otra" }, cuerpo: { lectura: "dedo-ana" },
  });
  assert.equal(r.estado, 401);
});

prueba("el registro manual de un aprendiz que no es de la ficha se rechaza", async () => {
  const r = await e.peticion("POST", `/api/sesiones/${idSesion}/asistencia-manual`, {
    token: tokens.instructor, cuerpo: { id_aprendiz: e.ids.ajeno, estado: "presente", motivo: "Prueba" },
  });
  assert.equal(r.estado, 400);
});

prueba("otro instructor no puede cerrar la sesión; el titular sí, y los ausentes reciben enlace", async () => {
  assert.equal((await e.peticion("POST", `/api/sesiones/${idSesion}/cerrar`, { token: tokens.otro })).estado, 403);

  const r = await e.peticion("POST", `/api/sesiones/${idSesion}/cerrar`, { token: tokens.instructor });
  assert.equal(r.estado, 200);
  assert.match(r.datos.mensaje, /1 aprendiz/);

  const { rows } = await e.pool.query(
    `SELECT a.estado, j.token, j.estado AS estado_justificacion
     FROM asistencia a LEFT JOIN justificacion j ON j.id_asistencia = a.id_asistencia
     WHERE a.id_sesion = $1 AND a.id_aprendiz = $2`,
    [idSesion, e.ids.ausente]
  );
  assert.equal(rows[0].estado, "ausente");
  assert.equal(rows[0].estado_justificacion, "pendiente");
  assert.ok(rows[0].token);

  const aviso = await e.pool.query("SELECT 1 FROM notificacion WHERE id_usuario = $1 AND tipo = 'inasistencia'", [e.ids.ausente]);
  assert.equal(aviso.rows.length, 1);
});

prueba("una justificación con el plazo vencido responde 410", async () => {
  const { rows } = await e.pool.query(
    `SELECT j.token FROM justificacion j JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     WHERE a.id_aprendiz = $1`,
    [e.ids.ausente]
  );
  const token = rows[0].token;
  assert.equal((await e.peticion("GET", `/api/justificaciones/token/${token}`)).estado, 200);

  await e.pool.query("UPDATE justificacion SET expira_en = NOW() - INTERVAL '1 minute' WHERE token = $1", [token]);
  const vencida = await e.peticion("GET", `/api/justificaciones/token/${token}`);
  assert.equal(vencida.estado, 410);
  assert.equal(vencida.datos.vencida, true);

  // En la bandeja ya sale como vencida, aunque la tarea programada aún no la haya marcado
  const bandeja = await e.peticion("GET", "/api/justificaciones", { token: tokens.instructor });
  const deBeto = bandeja.datos.find((j) => j.nombres === "Beto");
  assert.equal(deBeto.estado, "vencida");
  const enBase = await e.pool.query("SELECT estado FROM justificacion WHERE token = $1", [token]);
  assert.equal(enBase.rows[0].estado, "pendiente");
});

prueba("pasadas 24 h del cierre, el instructor ya no corrige asistencia pero el coordinador sí", async () => {
  await e.pool.query("UPDATE sesion_clase SET hora_cierre = NOW() - INTERVAL '25 hours' WHERE id_sesion = $1", [idSesion]);
  const cuerpo = { id_aprendiz: e.ids.ausente, estado: "presente", motivo: "=1+1 llegó con soporte" };

  const instructor = await e.peticion("POST", `/api/sesiones/${idSesion}/asistencia-manual`, { token: tokens.instructor, cuerpo });
  assert.equal(instructor.estado, 403);

  const coordinador = await e.peticion("POST", `/api/sesiones/${idSesion}/asistencia-manual`, { token: tokens.coordinador, cuerpo });
  assert.equal(coordinador.estado, 200);
});

prueba("el CSV exportado neutraliza fórmulas de Excel", async () => {
  const r = await e.peticion("GET", "/api/reportes/exportar", { token: tokens.coordinador });
  assert.equal(r.estado, 200);
  assert.match(r.datos, /'=1\+1 llegó con soporte/);
  assert.doesNotMatch(r.datos, /;=1\+1/);
});

// ---------- Configuración y validaciones generales ----------

prueba("la configuración rechaza valores inválidos y acepta los válidos", async () => {
  const mala = await e.peticion("PUT", "/api/configuracion", { token: tokens.coordinador, cuerpo: { minutos_tolerancia: "abc" } });
  assert.equal(mala.estado, 400);
  const buena = await e.peticion("PUT", "/api/configuracion", { token: tokens.coordinador, cuerpo: { minutos_tolerancia: 10 } });
  assert.equal(buena.estado, 200);
  const aprendiz = await e.peticion("PUT", "/api/configuracion", { token: tokens.ana, cuerpo: { minutos_tolerancia: 0 } });
  assert.equal(aprendiz.estado, 403);
});

prueba("un JSON mal formado responde 400 y no queda como falla del servidor", async () => {
  const r = await e.peticion("POST", "/api/auth/login", { crudo: "{esto no es json" });
  assert.equal(r.estado, 400);
  const logs = await e.pool.query("SELECT COUNT(*)::int AS total FROM log_error");
  assert.equal(logs.rows[0].total, 0);
});

prueba("una matrícula de alguien que no es aprendiz se rechaza", async () => {
  const r = await e.peticion("POST", `/api/fichas/${e.ids.ficha}/matriculas`, {
    token: tokens.coordinador, cuerpo: { ids_aprendices: [e.ids.otroInstructor] },
  });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.matriculados, 0);
  assert.match(r.datos.errores[0].error, /no es aprendiz/);
});

prueba("el coordinador no puede desactivar su propia cuenta", async () => {
  const r = await e.peticion("PATCH", `/api/usuarios/${e.ids.coordinador}/estado`, {
    token: tokens.coordinador, cuerpo: { estado: "inactivo" },
  });
  assert.equal(r.estado, 400);
});

// ---------- Plan de formación por trimestre ----------

prueba("la misma competencia se programa en dos trimestres, con el mismo u otro instructor", async () => {
  const competencia = await e.peticion("POST", "/api/competencias", {
    token: tokens.coordinador, cuerpo: { nombre: "Desarrollar la solución de software (prueba)" },
  });
  assert.equal(competencia.estado, 201);
  const idCompetencia = competencia.datos.id_competencia;
  const programar = (trimestre, idInstructor) => e.peticion("POST", `/api/fichas/${e.ids.ficha}/programacion`, {
    token: tokens.coordinador, cuerpo: { trimestre, id_competencia: idCompetencia, id_instructor: idInstructor },
  });

  assert.equal((await programar(1, e.ids.instructor)).estado, 201);
  assert.equal((await programar(2, e.ids.otroInstructor)).estado, 201); // otro instructor
  assert.equal((await programar(3, e.ids.instructor)).estado, 201);     // el mismo, otro trimestre

  const repetida = await programar(1, e.ids.instructor);
  assert.equal(repetida.estado, 400);
  assert.match(repetida.datos.mensaje, /ya está asignada/);

  const fueraDeRango = await programar(9, e.ids.instructor);
  assert.equal(fueraDeRango.estado, 400);

  const noInstructor = await programar(2, e.ids.aprendiz);
  assert.equal(noInstructor.estado, 400);

  const plan = await e.peticion("GET", `/api/fichas/${e.ids.ficha}/programacion`, { token: tokens.instructor });
  assert.equal(plan.estado, 200);
  assert.deepEqual(plan.datos.programacion.map((p) => p.trimestre), [1, 2, 3]);
  assert.ok(plan.datos.trimestre_actual >= 1);
});

prueba("solo la coordinación arma el plan; un aprendiz ni siquiera lo ve", async () => {
  const intento = await e.peticion("POST", `/api/fichas/${e.ids.ficha}/programacion`, {
    token: tokens.instructor, cuerpo: { trimestre: 1, id_competencia: 1, id_instructor: e.ids.instructor },
  });
  assert.equal(intento.estado, 403);
  assert.equal((await e.peticion("GET", `/api/fichas/${e.ids.ficha}/programacion`, { token: tokens.ana })).estado, 403);
});

prueba("no se puede reducir los trimestres si quedarían competencias por fuera", async () => {
  const reducir = await e.peticion("PATCH", `/api/fichas/${e.ids.ficha}/trimestres`, {
    token: tokens.coordinador, cuerpo: { trimestres: 2 },
  });
  assert.equal(reducir.estado, 400);
  assert.match(reducir.datos.mensaje, /después del trimestre 2/);

  const ampliar = await e.peticion("PATCH", `/api/fichas/${e.ids.ficha}/trimestres`, {
    token: tokens.coordinador, cuerpo: { trimestres: 8 },
  });
  assert.equal(ampliar.estado, 200);
});

// ---------- Recuperar la contraseña ----------

prueba("recuperar la contraseña no aprueba cuentas pendientes ni reactiva las desactivadas", async () => {
  // Cuenta pendiente de aprobación: no recibe enlace
  const registro = await e.peticion("POST", "/api/auth/registro", {
    cuerpo: { nombres: "Eva", apellidos: "Pendiente", documento: "900020", correo: "eva@prueba.co", rol: "aprendiz", contrasena: "Prueba123*" },
  });
  assert.equal(registro.estado, 201);
  assert.equal((await e.peticion("POST", "/api/auth/recuperar", { cuerpo: { correo: "eva@prueba.co" } })).estado, 200);
  const enlaces = await e.pool.query(
    "SELECT 1 FROM token_recuperacion t JOIN usuario u ON u.id_usuario = t.id_usuario WHERE u.correo = 'eva@prueba.co'"
  );
  assert.equal(enlaces.rows.length, 0);

  // Cuenta desactivada con un enlace pedido antes: cambia la contraseña, pero sigue desactivada.
  // Error corregido: antes quedaba activa y podía entrar.
  await e.pool.query("UPDATE usuario SET estado = 'inactivo' WHERE id_usuario = $1", [e.ids.ajeno]);
  await e.pool.query(
    "INSERT INTO token_recuperacion (id_usuario, token, expira_en) VALUES ($1, 'enlace-de-ciro', NOW() + INTERVAL '1 hour')",
    [e.ids.ajeno]
  );
  const cambio = await e.peticion("POST", "/api/auth/restablecer", { cuerpo: { token: "enlace-de-ciro", contrasena: "Nueva1234" } });
  assert.equal(cambio.estado, 200);
  const login = await e.peticion("POST", "/api/auth/login", { cuerpo: { correo: "ciro@prueba.co", contrasena: "Nueva1234" } });
  assert.equal(login.estado, 403);
  assert.match(login.datos.mensaje, /desactivada/);
});

// ---------- Lector real (protocolo ADMS de ZKTeco) ----------

const SERIAL_ADMS = "ADMS-PRUEBA";
let sesionAdms = null;

/** "2026-10-13 08:02:15": así envía la hora el lector (hora local del equipo) */
function horaDelEquipo(fecha) {
  const p = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())} ${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`;
}
function haceMinutos(minutos) {
  const f = new Date(Date.now() - minutos * 60000);
  f.setMilliseconds(0);
  return f;
}
const enviarAttlog = (lineas, serial = SERIAL_ADMS) => e.peticion("POST", `/iclock/cdata?SN=${serial}&table=ATTLOG`, {
  crudo: lineas.join("\n"), encabezados: { "Content-Type": "text/plain" },
});
async function asistenciaEnAdms(idAprendiz) {
  const { rows } = await e.pool.query(
    `SELECT a.id_asistencia, a.estado, a.metodo, a.hora_marca,
            (SELECT COUNT(*)::int FROM justificacion j WHERE j.id_asistencia = a.id_asistencia AND j.estado = 'pendiente') AS enlaces
     FROM asistencia a WHERE a.id_sesion = $1 AND a.id_aprendiz = $2`,
    [sesionAdms, idAprendiz]
  );
  return rows;
}

prueba("el lector real saluda y queda en línea; un serial desconocido se ignora", async () => {
  await e.pool.query(
    "INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api) VALUES ($1, 'SenseFace 2A', $2, 'no-aplica')",
    [SERIAL_ADMS, e.ids.otroAmbiente]
  );
  const saludo = await e.peticion("GET", `/iclock/cdata?SN=${SERIAL_ADMS}`);
  assert.equal(saludo.estado, 200);
  assert.match(saludo.datos, /GET OPTION FROM: ADMS-PRUEBA/);
  const { rows } = await e.pool.query("SELECT estado FROM dispositivo WHERE serial = $1", [SERIAL_ADMS]);
  assert.equal(rows[0].estado, "en_linea");

  assert.equal((await enviarAttlog(["900010\t2026-01-01 08:00:00"], "DESCONOCIDO")).datos, "OK");
});

prueba("el lector real usa la hora de la marca, no la de llegada, y no duplica lo que reenvía", async () => {
  // Clase de hoy en el ambiente de este lector. La clase principal de la ficha
  // (ya cerrada) se acorta a 00:00-00:01 para que la del lector sea otro bloque
  // del mismo día: una ficha no puede tener dos clases a la misma hora.
  await e.pool.query("UPDATE horario SET hora_fin = '00:01' WHERE id_horario = $1", [e.ids.horario]);
  const horario = await e.pool.query(
    `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, EXTRACT(DOW FROM CURRENT_DATE), '00:02', '23:59') RETURNING id_horario`,
    [e.ids.ficha, e.ids.otroAmbiente, e.ids.instructor, e.ids.periodo]
  );
  const inicio = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.instructor, cuerpo: { id_horario: horario.rows[0].id_horario } });
  assert.equal(inicio.estado, 200);
  sesionAdms = inicio.datos.id_sesion;
  await e.pool.query("UPDATE sesion_clase SET hora_apertura = NOW() - INTERVAL '10 minutes' WHERE id_sesion = $1", [sesionAdms]);

  const marcaDeAna = haceMinutos(3);
  const linea = `900010\t${horaDelEquipo(marcaDeAna)}\t0\t1\t0\t0\t0`;
  assert.equal((await enviarAttlog([linea])).datos, "OK");
  assert.equal((await enviarAttlog([linea])).datos, "OK"); // el equipo reintenta el mismo lote

  const ana = await asistenciaEnAdms(e.ids.aprendiz);
  assert.equal(ana.length, 1);
  assert.equal(ana[0].metodo, "huella");
  assert.equal(new Date(ana[0].hora_marca).getTime(), marcaDeAna.getTime());

  // Una marca de ayer (cuando no había clase en ese ambiente) no cuenta para la de hoy
  const ayer = new Date(Date.now() - 24 * 3600 * 1000);
  assert.equal((await enviarAttlog([`900011\t${horaDelEquipo(ayer)}\t0\t1`])).datos, "OK");
  assert.equal((await asistenciaEnAdms(e.ids.ausente)).length, 0);
});

prueba("una marca hecha en clase pero recibida después del cierre corrige la ausencia", async () => {
  const marcaDeBeto = haceMinutos(1); // el lector estaba sin red y la envía tarde
  const cierre = await e.peticion("POST", `/api/sesiones/${sesionAdms}/cerrar`, { token: tokens.instructor });
  assert.equal(cierre.estado, 200);
  let beto = await asistenciaEnAdms(e.ids.ausente);
  assert.equal(beto[0].estado, "ausente");
  assert.equal(beto[0].enlaces, 1);

  assert.equal((await enviarAttlog([`900011\t${horaDelEquipo(marcaDeBeto)}\t0\t1`])).datos, "OK");
  beto = await asistenciaEnAdms(e.ids.ausente);
  assert.ok(["presente", "tardanza"].includes(beto[0].estado));
  assert.equal(beto[0].metodo, "huella");
  assert.equal(beto[0].enlaces, 0); // ya no necesita justificar

  const cambio = await e.pool.query(
    "SELECT estado_anterior, cambiado_por FROM cambio_asistencia WHERE id_asistencia = $1", [beto[0].id_asistencia]
  );
  assert.equal(cambio.rows[0].estado_anterior, "ausente");
  assert.equal(cambio.rows[0].cambiado_por, null); // lo cambió el lector, no una persona
  const aviso = await e.pool.query("SELECT 1 FROM notificacion WHERE id_usuario = $1 AND titulo = 'Asistencia corregida'", [e.ids.ausente]);
  assert.equal(aviso.rows.length, 1);

  // Beto no tiene huella en la app, pero el lector real lo reconoció: no sale como "Sin registrar"
  const matriculas = await e.peticion("GET", `/api/fichas/${e.ids.ficha}/matriculas`, { token: tokens.coordinador });
  const filaBeto = matriculas.datos.find((m) => m.id_usuario === e.ids.ausente);
  assert.equal(filaBeto.tiene_huella, false);
  assert.equal(filaBeto.huella_en_lector, true);
});

// ---------- Panel y reportes ----------

prueba("las clases de hoy traen cómo va la asistencia y el estado del lector", async () => {
  const r = await e.peticion("GET", "/api/sesiones/hoy", { token: tokens.instructor });
  assert.equal(r.estado, 200);
  const clase = r.datos.find((c) => c.id_sesion === sesionAdms);
  assert.equal(clase.matriculados, 2);
  assert.equal(clase.presentes + clase.tardanzas, 2);
  assert.equal(clase.estado_lector, "en_linea");
});

prueba("el resumen de reportes no necesita filtros; el aprendiz no lo ve", async () => {
  const r = await e.peticion("GET", "/api/reportes/resumen", { token: tokens.coordinador });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.por_ficha[0].numero_ficha, "999999");
  assert.ok(r.datos.por_ficha[0].clases >= 2);
  assert.equal(typeof r.datos.minimo, "number");
  assert.ok(Array.isArray(r.datos.mas_faltas) && Array.isArray(r.datos.bajo_minimo));
  assert.equal((await e.peticion("GET", "/api/reportes/resumen", { token: tokens.ana })).estado, 403);

  const t = await e.peticion("GET", "/api/reportes/tendencia?dias=7", { token: tokens.instructor });
  assert.equal(t.estado, 200);
  assert.equal(t.datos.length, 7);
  assert.ok(t.datos.at(-1).registros > 0); // hoy hubo clases
  assert.equal((await e.peticion("GET", "/api/reportes/tendencia?dias=5", { token: tokens.coordinador })).estado, 400);
});

// ---------- Registro de actividad y exportaciones ----------

prueba("las exportaciones quedan en la auditoría, que solo consulta la coordinación", async () => {
  const excel = await e.peticion("POST", "/api/reportes/exportaciones", {
    token: tokens.instructor, cuerpo: { formato: "excel", contenido: "busqueda", filas: 12, filtros: { estado: "ausente" } },
  });
  assert.equal(excel.estado, 201);
  const malo = await e.peticion("POST", "/api/reportes/exportaciones", { token: tokens.instructor, cuerpo: { formato: "exe" } });
  assert.equal(malo.estado, 400);
  assert.equal((await e.peticion("GET", "/api/reportes/exportar", { token: tokens.coordinador })).estado, 200); // CSV

  const r = await e.peticion("GET", "/api/auditoria?accion=exportar_reporte", { token: tokens.coordinador });
  assert.equal(r.estado, 200);
  const formatos = r.datos.registros.map((x) => x.detalle.formato);
  assert.ok(formatos.includes("excel") && formatos.includes("csv"));
  assert.ok(r.datos.acciones.includes("login"));
  assert.equal(r.datos.registros.find((x) => x.detalle.formato === "excel").usuario, "Instructor Prueba");

  assert.equal((await e.peticion("GET", "/api/auditoria", { token: tokens.instructor })).estado, 403);
  assert.equal((await e.peticion("GET", "/api/auditoria", { token: tokens.ana })).estado, 403);
});

prueba("el registro de actividad nombra lo que se tocó, oculta los inicios de sesión y anota su exportación", async () => {
  // Lo que se tocó aparece con su nombre, no como "ficha #2"; lo borrado conserva el nombre
  await e.pool.query(
    "INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad) VALUES ($1, 'cambiar_trimestres_ficha', 'ficha', $2)",
    [e.ids.coordinador, e.ids.ficha]
  );
  const tematica = await e.peticion("POST", "/api/competencias/tematicas", {
    token: tokens.coordinador, cuerpo: { id_rap: e.ids.rap_competencia, nombre: "Temática que se borra" },
  });
  assert.equal(tematica.estado, 201);
  const idTematica = tematica.datos.id_tematica;
  assert.equal((await e.peticion("DELETE", `/api/competencias/tematicas/${idTematica}`, { token: tokens.coordinador })).estado, 200);

  const todo = await e.peticion("GET", "/api/auditoria?limite=1000", { token: tokens.coordinador });
  const deFicha = todo.datos.registros.find((x) => x.accion === "cambiar_trimestres_ficha");
  assert.equal(deFicha.nombre_entidad, "Ficha 999999");
  const borrada = todo.datos.registros.find((x) => x.accion === "eliminar_tematica" && x.id_entidad === idTematica);
  assert.equal(borrada.nombre_entidad, "Temática que se borra");
  assert.ok(todo.datos.registros.some((x) => x.accion === "login"));

  // Ocultar inicios de sesión; la búsqueda también encuentra por lo que se tocó
  const sinLogin = await e.peticion("GET", "/api/auditoria?sin_login=1&limite=1000", { token: tokens.coordinador });
  assert.ok(sinLogin.datos.registros.length > 0);
  assert.ok(sinLogin.datos.registros.every((x) => x.accion !== "login"));
  const porFicha = await e.peticion("GET", "/api/auditoria?texto=999999", { token: tokens.coordinador });
  assert.ok(porFicha.datos.registros.some((x) => x.accion === "cambiar_trimestres_ficha"));

  // La exportación a CSV queda anotada (el archivo se arma en el navegador)
  const exportacion = await e.peticion("POST", "/api/auditoria/exportaciones", {
    token: tokens.coordinador, cuerpo: { filas: 42, filtros: { accion: "", ocultar_inicios: true } },
  });
  assert.equal(exportacion.estado, 201);
  const anotada = await e.peticion("GET", "/api/auditoria?accion=exportar_auditoria", { token: tokens.coordinador });
  assert.equal(anotada.datos.registros[0].detalle.filas, 42);
  assert.equal((await e.peticion("POST", "/api/auditoria/exportaciones", { token: tokens.instructor, cuerpo: { filas: 1 } })).estado, 403);
});

// ---------- Soporte con captura ----------

const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

prueba("un ticket de soporte lleva captura; la ve quien lo creó y la coordinación, nadie más", async () => {
  const sinImagen = await e.peticion("POST", "/api/soporte", {
    token: tokens.ana, cuerpo: { tipo: "huella", descripcion: "No me toma la huella", archivo_datos: "data:application/pdf;base64,AAAA" },
  });
  assert.equal(sinImagen.estado, 400);

  const creado = await e.peticion("POST", "/api/soporte", {
    token: tokens.ana, cuerpo: { tipo: "huella", descripcion: "No me toma la huella", nombre_archivo: "lector.png", archivo_datos: PNG_1X1 },
  });
  assert.equal(creado.estado, 201);
  const id = creado.datos.id_ticket;

  const lista = await e.peticion("GET", "/api/soporte", { token: tokens.ana });
  const ticket = lista.datos.find((t) => t.id_ticket === id);
  assert.equal(ticket.tiene_captura, true);
  assert.equal(ticket.archivo_datos, undefined); // la imagen no viaja en el listado

  assert.equal((await e.peticion("GET", `/api/soporte/${id}/captura`, { token: tokens.ana })).datos.archivo_datos, PNG_1X1);
  assert.equal((await e.peticion("GET", `/api/soporte/${id}/captura`, { token: tokens.coordinador })).estado, 200);
  assert.equal((await e.peticion("GET", `/api/soporte/${id}/captura`, { token: tokens.instructor })).estado, 403);
});

// ---------- Sesión ----------

prueba("la sesión se renueva con un token válido; sin token no", async () => {
  const r = await e.peticion("POST", "/api/auth/renovar", { token: tokens.instructor });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.usuario.rol, "instructor");
  assert.equal((await e.peticion("GET", "/api/sesiones/hoy", { token: r.datos.token })).estado, 200);
  assert.equal((await e.peticion("POST", "/api/auth/renovar")).estado, 401);
});

// ---------- Clases repetidas ----------

prueba("no se abre una segunda sesión de la misma ficha a la misma hora (clase repetida)", async () => {
  // Una clase repetida como las que la base ya tenía antes de la validación (se inserta directo)
  const r = await e.pool.query(
    `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5, '10:00', '11:00') RETURNING id_horario`,
    [e.ids.ficha, e.ids.otroAmbiente, e.ids.instructor, e.ids.periodo, e.ids.diaDeHoy]
  );
  const idRepetida = r.rows[0].id_horario;
  const iniciar = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.instructor, cuerpo: { id_horario: idRepetida } });
  assert.equal(iniciar.estado, 400);
  assert.match(iniciar.datos.mensaje, /ya tiene una sesión hoy/);
  await e.pool.query("DELETE FROM horario WHERE id_horario = $1", [idRepetida]);
});

// ---------- Ventana de marcación ----------

prueba("una huella fuera del horario de la clase no cuenta, aunque la sesión esté abierta", async () => {
  // Una base instalada antes de estos parámetros no los tiene: valen los de por defecto
  await e.pool.query("DELETE FROM configuracion WHERE clave IN ('minutos_antes_marcar', 'minutos_despues_marcar')");
  const conf = await e.peticion("GET", "/api/configuracion", { token: tokens.coordinador });
  assert.equal(conf.datos.minutos_antes_marcar, "15");
  assert.equal(conf.datos.minutos_despues_marcar, "10");

  // Otra ficha con Ciro, y dos clases de hoy lejos de la hora actual: así se
  // reproduce la clase de 12:00 iniciada a las 9:57 que se quedó con esas huellas
  const ficha = await e.pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ('888888', 'Ventana', 'mañana', CURRENT_DATE - 30, CURRENT_DATE + 30, $1, $2) RETURNING id_ficha`,
    [e.ids.periodo, e.ids.instructor]
  );
  const idFicha = ficha.rows[0].id_ficha;
  await e.pool.query("INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1, $2)", [e.ids.ajeno, idFicha]);
  const temprano = new Date().getHours() < 3;
  const bloques = temprano ? [["22:00", "22:30"], ["23:00", "23:30"]] : [["00:20", "00:40"], ["01:00", "01:20"]];
  const ids = [];
  for (const [[inicio, fin], ambiente] of [[bloques[0], e.ids.ambiente], [bloques[1], e.ids.otroAmbiente]]) {
    const h = await e.pool.query(
      `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_horario`,
      [idFicha, ambiente, e.ids.instructor, e.ids.periodo, e.ids.diaDeHoy, inicio, fin]
    );
    ids.push(h.rows[0].id_horario);
  }

  // Lector simulado: la sesión está abierta pero la hora no es de esa clase
  const sesion = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.instructor, cuerpo: { id_horario: ids[0] } });
  assert.equal(sesion.estado, 200);
  const simulada = await e.peticion("POST", "/api/lector/marcacion", { encabezados: LECTOR, cuerpo: { lectura: "dedo-ciro" } });
  assert.equal(simulada.estado, 409);
  assert.match(simulada.datos.mensaje, /fuera del horario de la clase/);

  // Lector real: la marca de ahora se rechaza y no deja asistencia
  const real = await e.peticion("POST", "/api/sesiones/iniciar", { token: tokens.instructor, cuerpo: { id_horario: ids[1] } });
  assert.equal(real.estado, 200);
  await e.pool.query("UPDATE sesion_clase SET hora_apertura = NOW() - INTERVAL '10 minutes' WHERE id_sesion = $1", [real.datos.id_sesion]);
  const linea = `900012\t${horaDelEquipo(haceMinutos(1))}\t0\t1`;
  assert.equal((await enviarAttlog([linea])).datos, "OK");
  const contar = async () => (await e.pool.query(
    "SELECT COUNT(*)::int AS n FROM asistencia WHERE id_sesion = $1", [real.datos.id_sesion])).rows[0].n;
  assert.equal(await contar(), 0);

  // Si la clase sí es a esta hora, la misma marca cuenta
  await e.pool.query("UPDATE horario SET hora_inicio = '00:00', hora_fin = '23:59' WHERE id_horario = $1", [ids[1]]);
  assert.equal((await enviarAttlog([linea])).datos, "OK");
  assert.equal(await contar(), 1);
});

// ---------- Permisos del programador ----------

prueba("el programador consulta clases y justificaciones, pero no las inicia, cierra ni decide", async () => {
  const token = tokens.programador;
  assert.equal((await e.peticion("GET", "/api/sesiones/hoy", { token })).estado, 200);
  assert.equal((await e.peticion("GET", `/api/sesiones/${idSesion}`, { token })).estado, 200);
  const bandeja = await e.peticion("GET", "/api/justificaciones", { token });
  assert.equal(bandeja.estado, 200);

  const idJustificacion = bandeja.datos[0]?.id_justificacion ?? 1;
  const decidir = await e.peticion("PATCH", `/api/justificaciones/${idJustificacion}`, { token, cuerpo: { estado: "aprobada" } });
  assert.equal(decidir.estado, 403);
  assert.equal((await e.peticion("POST", "/api/sesiones/iniciar", { token, cuerpo: { id_horario: e.ids.horario } })).estado, 403);
  assert.equal((await e.peticion("POST", `/api/sesiones/${idSesion}/cerrar`, { token })).estado, 403);
  const manual = await e.peticion("POST", `/api/sesiones/${idSesion}/asistencia-manual`, {
    token, cuerpo: { id_aprendiz: e.ids.aprendiz, estado: "presente", motivo: "Prueba" },
  });
  assert.equal(manual.estado, 403);
  assert.equal((await e.peticion("DELETE", `/api/sesiones/${idSesion}`, { token })).estado, 403);
});

// ---------- Rango de la serie, festivos, panel y lectores (revisión, punto 13) ----------

const enDias = (n) => {
  const f = new Date();
  f.setDate(f.getDate() + n);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

prueba("una clase puede repetirse solo entre dos fechas, y dos series que no se tocan no chocan", async () => {
  const serie = await nuevoHorario({ dia_semana: pasado(), hora_inicio: "16:00", hora_fin: "17:00", fecha_desde: enDias(1), fecha_hasta: enDias(20) });
  assert.equal(serie.estado, 201);
  assert.equal(serie.datos.excluir_festivos, true); // por defecto no se dicta en festivos
  const lista = await e.peticion("GET", `/api/horarios?id_ficha=${e.ids.ficha}`, { token: tokens.coordinador });
  const creada = lista.datos.find((h) => h.id_horario === serie.datos.id_horario);
  assert.equal(new Date(creada.vigente_desde).getTime(), new Date(`${enDias(1)}T00:00:00`).getTime());
  assert.equal(new Date(creada.vigente_hasta).getTime(), new Date(`${enDias(20)}T00:00:00`).getTime());

  // Otra ficha, mismo ambiente e instructor, a la misma hora pero después de la serie: no choca
  const otra = await e.pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ('777777', 'Rango', 'tarde', CURRENT_DATE - 30, CURRENT_DATE + 30, $1, $2) RETURNING id_ficha`,
    [e.ids.periodo, e.ids.instructor]
  );
  const despues = { id_ficha: otra.rows[0].id_ficha, dia_semana: pasado(), hora_inicio: "16:00", hora_fin: "17:00" };
  assert.equal((await nuevoHorario({ ...despues, fecha_desde: enDias(21), fecha_hasta: enDias(40) })).estado, 201);
  const encima = await nuevoHorario({ ...despues, hora_inicio: "16:30", hora_fin: "17:30", fecha_desde: enDias(10), fecha_hasta: enDias(12) });
  assert.equal(encima.estado, 400);

  // Fechas al revés o fuera del trimestre se rechazan con un mensaje claro
  const alReves = await nuevoHorario({ dia_semana: pasado(), hora_inicio: "18:00", hora_fin: "19:00", fecha_desde: enDias(9), fecha_hasta: enDias(3) });
  assert.equal(alReves.estado, 400);
  assert.match(alReves.datos.mensaje, /posterior/);
  const fuera = await nuevoHorario({ dia_semana: pasado(), hora_inicio: "18:00", hora_fin: "19:00", fecha_desde: enDias(200) });
  assert.equal(fuera.estado, 400);
  assert.match(fuera.datos.mensaje, /fuera del trimestre/);
});

prueba("los festivos de Colombia salen calculados para el calendario", async () => {
  const r = await e.peticion("GET", "/api/festivos?anio=2026", { token: tokens.ana });
  assert.equal(r.estado, 200);
  assert.ok(r.datos.some((f) => f.fecha === "2026-10-12" && f.nombre === "Día de la Raza"));
  assert.ok(r.datos.some((f) => f.fecha.startsWith("2027-")) && r.datos.some((f) => f.fecha.startsWith("2025-")));
});

prueba("el panel cuenta huellas sin registrar y justificaciones vencidas", async () => {
  const contar = async () => (await e.peticion("GET", "/api/reportes/estadisticas", { token: tokens.coordinador })).datos;
  const antes = await contar();

  // Dora entra a una ficha sin huella en la app ni marcas del lector, y deja vencer una justificación
  const ficha = await e.pool.query("SELECT id_ficha FROM ficha WHERE numero_ficha = '777777'");
  await e.pool.query("INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1, $2)", [e.ids.bloqueable, ficha.rows[0].id_ficha]);
  const ausencia = await e.pool.query(
    "INSERT INTO asistencia (id_sesion, id_aprendiz, estado, metodo) VALUES ($1, $2, 'ausente', 'sistema') RETURNING id_asistencia",
    [idSesion, e.ids.bloqueable]
  );
  await e.pool.query(
    "INSERT INTO justificacion (id_asistencia, token, expira_en) VALUES ($1, 'token-vencido-panel', NOW() - INTERVAL '1 hour')",
    [ausencia.rows[0].id_asistencia]
  );

  const despues = await contar();
  assert.equal(despues.huellas_sin_registrar, antes.huellas_sin_registrar + 1);
  assert.equal(despues.justificaciones_vencidas, antes.justificaciones_vencidas + 1);
});

prueba("un lector que pasa 3 minutos sin señal avisa una sola vez a la coordinación", async () => {
  const dispositivo = require("../../src/modelos/dispositivo");
  const { avisarLectoresCaidos } = require("../../src/servicios/tareasProgramadas");
  await e.pool.query(
    "UPDATE dispositivo SET estado = 'en_linea', ultimo_heartbeat = NOW() - INTERVAL '4 minutes' WHERE serial = 'LECTOR-PRUEBA'"
  );
  await avisarLectoresCaidos(await dispositivo.marcarFueraDeLineaSinHeartbeat());
  await avisarLectoresCaidos(await dispositivo.marcarFueraDeLineaSinHeartbeat()); // el minuto siguiente ya no avisa

  const avisos = await e.pool.query(
    "SELECT mensaje FROM notificacion WHERE id_usuario = $1 AND titulo = 'Lector sin señal'", [e.ids.coordinador]
  );
  assert.equal(avisos.rows.length, 1);
  assert.match(avisos.rows[0].mensaje, /LECTOR-PRUEBA del ambiente P-1/);
});

// ---------- Instructor: notificaciones con enlace e historial (revisión, punto 14) ----------

prueba("la justificación que llega abre desde la notificación, y la clase pasada sale en el historial", async () => {
  // Clase de hace dos días, cerrada, en la que Ana faltó y tiene enlace para justificar
  const sesion = await e.pool.query(
    `INSERT INTO sesion_clase (id_horario, fecha, estado, hora_apertura, hora_cierre)
     VALUES ($1, CURRENT_DATE - 2, 'cerrada', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days') RETURNING id_sesion`,
    [e.ids.horario]
  );
  const idPasada = sesion.rows[0].id_sesion;
  const ausencia = await e.pool.query(
    "INSERT INTO asistencia (id_sesion, id_aprendiz, estado, metodo) VALUES ($1, $2, 'ausente', 'sistema') RETURNING id_asistencia",
    [idPasada, e.ids.aprendiz]
  );
  await e.pool.query(
    "INSERT INTO justificacion (id_asistencia, token, expira_en) VALUES ($1, 'token-con-enlace', NOW() + INTERVAL '1 day')",
    [ausencia.rows[0].id_asistencia]
  );
  const envio = await e.peticion("POST", "/api/justificaciones/token/token-con-enlace", {
    cuerpo: { tipo: "calamidad_domestica", descripcion: "Calamidad en casa" },
  });
  assert.equal(envio.estado, 200);

  const { rows } = await e.pool.query(
    `SELECT n.mensaje, n.enlace, j.id_justificacion FROM notificacion n, justificacion j
     WHERE n.id_usuario = $1 AND n.titulo = 'Nueva justificación por revisar' AND j.token = 'token-con-enlace'
     ORDER BY n.id_notificacion DESC LIMIT 1`,
    [e.ids.instructor]
  );
  assert.equal(rows[0].enlace, `/justificaciones?id=${rows[0].id_justificacion}`);
  assert.match(rows[0].mensaje, /ficha 999999/);
  const lista = await e.peticion("GET", "/api/notificaciones", { token: tokens.instructor });
  assert.ok(lista.datos.some((n) => n.enlace === rows[0].enlace));

  // Historial: el titular ve su clase pasada con cuántos faltaron; otro instructor no
  const historial = await e.peticion("GET", "/api/sesiones/historial?dias=30", { token: tokens.instructor });
  assert.equal(historial.estado, 200);
  const pasada = historial.datos.find((c) => c.id_sesion === idPasada);
  assert.equal(pasada.ausentes, 1);
  assert.ok(historial.datos.every((c) => new Date(c.fecha) < new Date(new Date().toDateString()))); // nada de hoy
  const ajeno = await e.peticion("GET", "/api/sesiones/historial", { token: tokens.otro });
  assert.ok(!ajeno.datos.some((c) => c.id_sesion === idPasada));
});

// ---------- Aprendiz: avisos con la clase real y Mis justificaciones (revisión, punto 15) ----------

prueba("el aviso de inasistencia dice qué clase fue y lleva a Mis justificaciones", async () => {
  const { rows } = await e.pool.query(
    "SELECT mensaje, enlace FROM notificacion WHERE id_usuario = $1 AND titulo = 'Inasistencia registrada' ORDER BY id_notificacion",
    [e.ids.ausente]
  );
  assert.ok(rows.length >= 1);
  assert.match(rows[0].mensaje, /\(\d{2}:\d{2}–\d{2}:\d{2}, ficha 999999\)/); // antes: solo la fecha
  assert.equal(rows[0].enlace, "/mis-justificaciones");

  // El historial del aprendiz trae la hora de cada clase para listar sus faltas
  const historial = await e.peticion("GET", "/api/reportes/mi-historial", { token: tokens.ana });
  assert.equal(historial.estado, 200);
  assert.ok(historial.datos.detalle.every((d) => /^\d{2}:\d{2}$/.test(d.hora_inicio)));
});

// ---------- Soporte por rol (revisión, punto 16) ----------

prueba("cada rol reporta los problemas que le pasan a él, y la coordinación lee el nombre del problema", async () => {
  const deInstructor = await e.peticion("GET", "/api/soporte/tipos", { token: tokens.instructor });
  const valores = deInstructor.datos.tipos.map((t) => t.valor);
  assert.ok(valores.includes("lector") && !valores.includes("huella")); // "Mi huella no es reconocida" es del aprendiz
  assert.ok((await e.peticion("GET", "/api/soporte/tipos", { token: tokens.ana })).datos.tipos.some((t) => t.valor === "huella"));

  const ajeno = await e.peticion("POST", "/api/soporte", { token: tokens.instructor, cuerpo: { tipo: "huella", descripcion: "x" } });
  assert.equal(ajeno.estado, 400);
  const bueno = await e.peticion("POST", "/api/soporte", { token: tokens.instructor, cuerpo: { tipo: "lector", descripcion: "El lector del 201 no prende" } });
  assert.equal(bueno.estado, 201);

  const { rows } = await e.pool.query(
    "SELECT mensaje, enlace FROM notificacion WHERE id_usuario = $1 AND mensaje LIKE $2",
    [e.ids.coordinador, `Ticket #${bueno.datos.id_ticket}:%`]
  );
  assert.equal(rows[0].mensaje, `Ticket #${bueno.datos.id_ticket}: El lector del ambiente no funciona`);
  assert.equal(rows[0].enlace, "/soporte");
});

// ---------- Nombres largos (revisión, punto 17) ----------

prueba("un apellido largo se guarda completo (no se recorta)", async () => {
  const apellidos = "Becerra Villalobos de la Torre y Hernández Castañeda";
  const r = await e.peticion("POST", "/api/usuarios", {
    token: tokens.coordinador,
    cuerpo: { nombres: "Julian Felipe", apellidos, tipo_documento: "CC", documento: "900099", correo: "largo@prueba.co", rol: "aprendiz" },
  });
  assert.equal(r.estado, 201);
  const { rows } = await e.pool.query("SELECT apellidos FROM usuario WHERE correo = 'largo@prueba.co'");
  assert.equal(rows[0].apellidos, apellidos);
});
