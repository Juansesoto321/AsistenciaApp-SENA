# Caracterización del proceso de control de asistencia — AsistenciaApp SENA

Diagrama BPMN 2.0 del proceso TO-BE: [08-Proceso-Asistencia-TO-BE.bpmn](08-Proceso-Asistencia-TO-BE.bpmn).
Para verlo, abre <https://demo.bpmn.io> y arrastra el archivo a la página (o usa Camunda Modeler).

## 1. Situación actual (AS-IS) y situación propuesta (TO-BE)

### 1.1 AS-IS: control manual

Hoy el instructor toma la asistencia al inicio de cada sesión, llamando a lista o pasando una planilla en papel o en una hoja de cálculo. Después pasa los datos a un consolidado para coordinación.

**Actores:** instructor, aprendiz y coordinación académica.

**Actividades:**

1. El instructor llama a lista o hace circular la planilla.
2. El aprendiz responde o firma.
3. El instructor anota a mano las llegadas tarde, según su propio criterio.
4. Al final, el instructor pasa la planilla al consolidado.
5. Cuando hay una falta, el aprendiz entrega la excusa en persona o por correo, sin un plazo controlado.
6. Coordinación pide los consolidados para revisar el porcentaje de asistencia.

**Problemas:**

- **Suplantación:** un compañero puede firmar o responder por otro, y no hay forma de comprobar quién estuvo.
- **Tiempo de clase perdido:** llamar a lista quita minutos de formación en cada sesión.
- **Retardos sin regla común:** cada instructor decide qué cuenta como «llegar tarde».
- **Faltas sin aviso:** el aprendiz no sabe a tiempo que quedó ausente, y las excusas no tienen plazo ni seguimiento.
- **Sin trazabilidad:** no queda registro de quién cambió un dato ni cuándo; el papel se pierde o se altera.
- **Información tardía:** coordinación ve el porcentaje de asistencia días o semanas después, cuando ya es tarde para actuar.
- **Datos personales sin control:** las planillas con nombres y documentos circulan sin protección.

### 1.2 TO-BE: control biométrico automatizado con AsistenciaApp

El aprendiz marca con su huella en el lector ZKTeco. El lector identifica la huella 1:N y envía por el protocolo ADMS (`/iclock/cdata`) solo el PIN, que es su documento, y la hora.

El backend (Node.js/Express, arquitectura en capas):

1. Valida la marca contra la ficha y la ventana de marcación.
2. Calcula el estado: presente o tardanza.
3. Guarda la asistencia en PostgreSQL.
4. La publica en tiempo real en el panel React por Socket.IO.

Al cerrar la clase, ya sea a mano o automáticamente, el sistema:

1. Marca ausentes a quienes no marcaron.
2. Genera un enlace de justificación con plazo.
3. Envía el correo de inasistencia.

El instructor aprueba o rechaza la justificación, y el rechazo exige una observación. Cada acción queda en la auditoría y se refleja en los reportes de coordinación.

### 1.3 Comparación

| Aspecto | AS-IS (manual) | TO-BE (AsistenciaApp) |
|---|---|---|
| Identificación | Firma o respuesta verbal | Huella dactilar 1:N en el lector ZKTeco |
| Suplantación | Posible y difícil de detectar | Muy difícil: se necesita el dedo del aprendiz |
| Tiempo en clase | Varios minutos llamando a lista | Unos segundos por aprendiz, sin interrumpir la clase |
| Retardos | Criterio de cada instructor | Regla única y configurable (tolerancia de 15 min por defecto) |
| Ausencias | Se anotan a mano y a veces no se registran | Automáticas al cerrar la clase, a mano o sola a la hora fin + 10 min |
| Aviso al aprendiz | Ninguno o verbal | Correo y notificación con enlace «Justificar» |
| Justificaciones | Papel, sin plazo ni seguimiento | Formulario con soporte, plazo de 72 h y revisión del instructor |
| Trazabilidad | No existe | Auditoría de quién hizo qué y cuándo, más historial de cambios de estado |
| Información | Consolidado tardío | Panel en vivo, reportes y alerta por debajo del 80 % |
| Datos personales | Planillas expuestas | Ley 1581/2012: consentimiento, cifrado y acceso por rol |
| Fallas del lector | — | Aviso de lector caído; las marcas que llegan tarde corrigen la ausencia |

## 2. Proceso afectado y en qué se enfoca la mejora

**Proceso afectado:** *registro y control de la asistencia a la formación y gestión de inasistencias*. Es parte de la gestión académica de la formación profesional integral del SENA. Cubre todo el recorrido: desde que se abre la sesión de clase hasta que la asistencia queda consolidada en los reportes, incluido el ciclo de justificación.

La mejora se concentra en cuatro frentes:

1. **Menos suplantación de identidad.**
   - El lector compara la huella contra las plantillas guardadas en el equipo: un compañero no puede marcar por otro.
   - El backend también valida que el PIN pertenezca a un aprendiz matriculado en la ficha de esa sesión. Si no, la marca se rechaza, queda registrada y se avisa en vivo en el panel.
   - El sistema rechaza las marcas fuera de la ventana permitida (de 15 min antes del inicio a 10 min después del fin).

2. **Retardos y faltas automáticos.**
   - El estado lo calcula una regla de negocio única: tardanza si la marca llega después de los minutos de tolerancia configurados.
   - Al cerrar la clase, todos los que no marcaron quedan como ausentes. Si el instructor no la cierra, una tarea programada que revisa cada minuto la cierra sola.
   - Al cerrarse, cada ausente recibe un correo (Nodemailer + SMTP) con su enlace de justificación.
   - Si el lector estuvo sin red y la marca llega después del cierre, el sistema corrige la ausencia automáticamente y le avisa al aprendiz.

3. **Trazabilidad.**
   - Quedan en la auditoría: abrir y cerrar la sesión, el registro manual (con motivo obligatorio) y aprobar o rechazar una justificación.
   - Cada cambio de estado de una asistencia guarda el estado anterior y quién lo hizo.
   - Los reportes y el porcentaje de asistencia salen de los mismos datos, sin volver a digitar nada.

4. **Cumplimiento de la Ley 1581 de 2012 (protección de datos personales).**
   - La huella es un dato sensible: antes del enrolamiento, el aprendiz da su consentimiento informado, y puede revocarlo y pedir que se borren sus datos biométricos.
   - Con el lector real, la plantilla se queda en el equipo; al servidor solo llegan el PIN y la hora.
   - En el modo simulado, la plantilla se guarda cifrada con AES-256, nunca como imagen.
   - El estado biométrico solo lo ve el propio aprendiz, y cada rol accede únicamente a lo que le corresponde.

## 3. Cómo leer el diagrama BPMN

El diagrama tiene un pool, *AsistenciaApp SENA · Control de asistencia (TO-BE)*, con tres carriles:

- **Aprendiz / Lector ZKTeco:** poner el dedo, identificación 1:N, reintento si no reconoce, envío por ADMS, recepción del correo y la decisión de justificar dentro del plazo.
- **Backend Node.js / PostgreSQL:** abrir la sesión, validar la marca, calcular presente o tardanza (regla de negocio), guardar la asistencia, cerrar la sesión y marcar ausentes, crear el enlace y enviar el correo, vencer el plazo, marcar la falta como justificada y actualizar los reportes. Incluye dos referencias al almacén PostgreSQL.
- **Frontend React:** el instructor inicia la clase y ve el panel en vivo; el aprendiz llena la justificación; el instructor la revisa y la aprueba o rechaza; coordinación consulta los reportes.

**Ciclo de marcación:** la compuerta «¿Se cerró la clase o terminó el horario?» devuelve el flujo al siguiente aprendiz hasta que llega el cierre.

**Notas del diagrama:** privacidad (Ley 1581), tolerancia, cierre automático y plazo de justificación.
