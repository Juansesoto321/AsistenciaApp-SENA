/**
 * Utilidades de las tareas de consola que crean cuentas o cambian contraseñas
 * (crear-coordinador.js y nueva-clave.js).
 */
const crypto = require("crypto");

// Sin caracteres que se confunden al copiarlos a mano (0/O, 1/l/I)
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const NUMEROS = "23456789";
const SIMBOLOS = "*#%+=?";
const TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

const alAzar = (caracteres) => caracteres[crypto.randomInt(caracteres.length)];

/**
 * Contraseña aleatoria que cumple la política del sistema (mayúscula, minúscula
 * y número). Con 14 caracteres de 63 posibles no se puede adivinar ni probar
 * por fuerza bruta.
 */
function generarClaveSegura(largo = 14) {
  const letras = [alAzar(MAYUSCULAS), alAzar(MINUSCULAS), alAzar(NUMEROS), alAzar(SIMBOLOS)];
  while (letras.length < largo) letras.push(alAzar(TODOS));
  // Mezcla para que las obligatorias no queden siempre al principio
  for (let i = letras.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
}

/**
 * Devuelve una función para hacer preguntas en la terminal. Lee las respuestas
 * con el iterador de líneas, que las guarda en orden: con rl.question se
 * perdían las que llegaban juntas (respuestas pegadas o enviadas por tubería)
 * y el script terminaba sin crear nada ni avisar.
 */
function crearPreguntador(rl) {
  const lineas = rl[Symbol.asyncIterator]();
  return async (texto) => {
    process.stdout.write(texto);
    const { value, done } = await lineas.next();
    if (done) throw new Error("La entrada se cerró antes de responder todas las preguntas");
    return value;
  };
}

module.exports = { generarClaveSegura, crearPreguntador };
