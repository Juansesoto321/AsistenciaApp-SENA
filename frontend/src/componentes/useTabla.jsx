/**
 * Ordenar por columna y paginar cualquier tabla, sin cambiar su HTML:
 *
 *   const t = useTabla(filas, { porPagina: 15, valores: { fecha: (f) => new Date(f.fecha) } });
 *   <thead><tr>{t.encabezado("fecha", "Fecha")}…</tr></thead>
 *   <tbody>{t.visibles.map(…)}</tbody>
 *   {t.paginacion}
 *
 * `valores` dice cómo comparar una columna cuando no basta con fila[clave].
 */
import { useEffect, useMemo, useState } from "react";
import Icono from "./Iconos.jsx";

const comparador = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function comparar(a, b) {
  const vacioA = a === null || a === undefined || a === "";
  const vacioB = b === null || b === undefined || b === "";
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1; // los vacíos siempre al final
  if (a instanceof Date || b instanceof Date) return new Date(a) - new Date(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return comparador.compare(String(a), String(b));
}

export default function useTabla(filas, { porPagina = 15, valores = {}, orden: ordenInicial = null } = {}) {
  const [orden, setOrden] = useState(ordenInicial); // { clave, asc }
  const [pagina, setPagina] = useState(1);

  const ordenadas = useMemo(() => {
    const lista = filas || [];
    if (!orden) return lista;
    const valor = valores[orden.clave] || ((f) => f[orden.clave]);
    return [...lista].sort((a, b) => comparar(valor(a), valor(b)) * (orden.asc ? 1 : -1));
  }, [filas, orden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al filtrar se vuelve a la primera página. Se mira el tamaño y no la lista:
  // las páginas suelen filtrar en cada render y la lista sería "nueva" siempre.
  useEffect(() => { setPagina(1); }, [filas?.length]);

  const total = ordenadas.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * porPagina;
  const visibles = ordenadas.slice(desde, desde + porPagina);

  function alternar(clave) {
    setOrden((o) => (o?.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }));
  }

  function encabezado(clave, texto, props = {}) {
    const activa = orden?.clave === clave;
    return (
      <th key={clave} aria-sort={activa ? (orden.asc ? "ascending" : "descending") : "none"} {...props}>
        <button type="button" className={`orden-columna${activa ? " activa" : ""}`} onClick={() => alternar(clave)}>
          {texto}
          <Icono nombre={activa ? (orden.asc ? "arriba" : "abajo") : "ordenar"} size="0.95em" />
        </button>
      </th>
    );
  }

  const paginacion = total > porPagina ? (
    <nav className="paginacion" aria-label="Páginas de la tabla">
      <span>{desde + 1}–{Math.min(desde + porPagina, total)} de {total}</span>
      <div>
        <button type="button" className="boton mini suave" disabled={actual === 1} onClick={() => setPagina(actual - 1)}>← Anterior</button>
        <b aria-current="page">{actual} / {paginas}</b>
        <button type="button" className="boton mini suave" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}>Siguiente →</button>
      </div>
    </nav>
  ) : null;

  return { visibles, encabezado, paginacion, total };
}
