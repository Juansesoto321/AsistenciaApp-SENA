/**
 * CU-01 Iniciar sesion · CU-02 Recuperar contrasena · CU-03 Actualizar perfil
 * CU-22 Auto-registro con aprobacion del coordinador
 */
const express = require("express");
const controlador = require("../controladores/auth");
const { autenticar } = require("../middleware/autenticar");
const { limitarPeticiones } = require("../middleware/seguridad");

const router = express.Router();

// El bloqueo por cuenta (5 intentos) ya existe; esto frena además a quien
// prueba contraseñas contra muchas cuentas o envía correos de recuperación en masa.
const limiteLogin = limitarPeticiones({
  maximo: 100, ventanaMinutos: 15,
  mensaje: "Demasiados intentos de inicio de sesión desde esta red. Espera unos minutos",
});
const limiteRecuperar = limitarPeticiones({
  maximo: 20, ventanaMinutos: 15,
  mensaje: "Demasiadas solicitudes de recuperación. Espera unos minutos",
});
const limiteRegistro = limitarPeticiones({
  maximo: 60, ventanaMinutos: 60,
  mensaje: "Demasiadas solicitudes de registro desde esta red. Intenta más tarde",
});

router.post("/login", limiteLogin, controlador.login);
router.post("/renovar", autenticar, controlador.renovar); // alarga la sesión de quien sigue usando la app
router.post("/registro", limiteRegistro, controlador.registro);
router.post("/recuperar", limiteRecuperar, controlador.recuperar);
router.post("/restablecer", limiteRecuperar, controlador.restablecer);
router.get("/perfil", autenticar, controlador.verPerfil);
router.put("/perfil", autenticar, controlador.actualizarPerfil);

module.exports = router;
