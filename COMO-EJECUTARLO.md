# Cómo ejecutar AsistenciaApp (guía para el equipo)

Solo necesitas **Docker Desktop**. No hace falta instalar Node, PostgreSQL ni nada más por separado.

## 1. Instalar Docker Desktop (una sola vez)

1. Descárgalo de: https://www.docker.com/products/docker-desktop/
2. Ejecuta el instalador y déjalo con las opciones por defecto.
3. Si Windows te pide activar **WSL2**, acepta y reinicia el computador cuando te lo pida.
4. Abre **Docker Desktop** y espera a que el ícono de la ballena (abajo a la derecha, en la barra de tareas) deje de moverse — eso significa que ya está listo.

## 2. Descargar el proyecto

Necesitas tener [Git](https://git-scm.com/downloads) instalado (el instalador de Docker Desktop no lo incluye). Luego, abre una terminal (PowerShell o Git Bash) y ejecuta:

```bash
git clone https://github.com/Juansesoto321/asistenciaapp.git
cd asistenciaapp
```

## 3. Levantar la aplicación

En esa misma terminal, dentro de la carpeta `asistenciaapp`:

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos (está descargando e instalando todo). Cuando termine, ejecuta esto **una sola vez** para crear los datos de prueba:

```bash
docker compose exec backend npm run sembrar
```

## 4. Abrir la aplicación

Ve a tu navegador y entra a:

```
http://localhost:8080
```

### Cuentas para entrar

Al terminar, el comando `sembrar` del paso 3 muestra en la terminal las cuentas de prueba
(coordinador, instructor y aprendices) con sus contraseñas. Esas cuentas son solo para tu
computador: no se usan en el servidor real.

## 5. Para apagarlo (cuando termines de probar)

```bash
docker compose down
```

Y para volver a encenderlo después, solo repites el paso 3 (ya no tarda, porque ya está todo instalado) — no hace falta volver a sembrar los datos.

---

## Si algo falla

- **"docker: command not found"** → Docker Desktop no quedó bien instalado o no está abierto. Ábrelo primero y espera a que cargue.
- **El puerto 8080 ya está en uso** → cierra cualquier otro programa que use ese puerto, o avísame para cambiarlo.
- **Cualquier otro error** → copia el mensaje completo y compártelo en el grupo, para revisarlo entre todos antes del día de la sustentación.

**Recomendación:** prueben esto todos **con anticipación**, no el mismo día de la sustentación — así si algo falla en el computador de alguien, hay tiempo de resolverlo.
