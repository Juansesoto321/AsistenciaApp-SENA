/**
 * Reportes en PDF, armados en el navegador con jsPDF. La librería se carga
 * solo cuando alguien descarga un PDF, para no hacer más pesada la app.
 *
 * secciones: [{ titulo, columnas: ["Ficha", …], filas: [["3311983", …], …] }]
 */
const VERDE = [43, 128, 0]; // verde SENA oscurecido: el texto blanco encima se lee bien
const TINTA = [27, 35, 25];
const SUAVE = [94, 107, 89];

// Las fuentes estándar del PDF no traen todos los signos tipográficos
const limpiar = (valor) => String(valor ?? "").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

export async function descargarPdf({ titulo, subtitulo, institucion, generadoPor, secciones, archivo }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 40;

  // Encabezado: franja verde con el nombre de la institución y el título
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ancho, 74, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(limpiar(titulo), margen, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(limpiar(`${institucion || "SENA"} · AsistenciaApp SENA`), margen, 54);

  doc.setTextColor(...SUAVE);
  doc.setFontSize(9.5);
  const generado = new Date().toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  doc.text(limpiar(`Generado el ${generado}${generadoPor ? ` por ${generadoPor}` : ""}`), margen, 94);
  if (subtitulo) doc.text(limpiar(subtitulo), margen, 108);

  let y = subtitulo ? 128 : 116;
  for (const seccion of secciones) {
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 50; }
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(limpiar(seccion.titulo), margen, y);
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margen, right: margen },
      head: [seccion.columnas.map(limpiar)],
      body: seccion.filas.length ? seccion.filas.map((fila) => fila.map(limpiar)) : [[{ content: "Sin datos", colSpan: seccion.columnas.length }]],
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: TINTA },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [242, 248, 236] },
    });
    y = doc.lastAutoTable.finalY + 28;
  }

  // Pie: número de página en todas las hojas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUAVE);
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
  doc.save(archivo);
}
