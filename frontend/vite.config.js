import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API_DESTINO: el backend al que apunta el servidor de desarrollo (la copia usa el 4100)
const api = process.env.API_DESTINO || "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: api, changeOrigin: true },
      "/socket.io": { target: api, ws: true },
    },
  },
});
