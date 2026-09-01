/**
 * Calcula qué números de página mostrar en el paginador.
 *
 * Si hay más de `maxPages` páginas, se muestra una ventana deslizante de
 * `maxPages` números centrada en la página actual, de modo que el listado
 * nunca crece más allá de ese tope y el usuario se "desplaza" hacia la
 * derecha/izquierda conforme cambia de página.
 *
 * Retorna un array que puede contener números y el string "dots" para
 * indicar un separador de elipsis.
 */
export function getVisiblePages(page: number, totalPages: number, maxPages = 7): (number | "dots")[] {
  const total = Math.max(1, Math.floor(totalPages));

  if (total <= maxPages) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const offset = Math.floor((maxPages - 1) / 2);
  const start = Math.max(1, Math.min(page - offset, total - maxPages + 1));
  const pages: (number | "dots")[] = [];

  for (let i = 0; i < maxPages; i++) {
    const n = start + i;
    if (i > 0 && n - (pages[pages.length - 1] as number) > 1) {
      pages.push("dots");
    }
    pages.push(n);
  }

  return pages;
}
