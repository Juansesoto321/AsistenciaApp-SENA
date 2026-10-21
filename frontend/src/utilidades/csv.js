/**
 * Celda de CSV para Excel (separador ";"), igual que en el backend: comillas
 * cuando hace falta y sin fórmulas (un texto que empiece por "=" se ejecutaría).
 */
function celdaCsv(valor) {
  let texto = String(valor ?? "");
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Descarga un .csv que Excel abre con las tildes bien (BOM) y una columna por dato. */
export function descargarCsv(columnas, filas, archivo) {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celdaCsv).join(";"));
  const blob = new Blob([`﻿${lineas.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = archivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
