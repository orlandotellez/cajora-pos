/**
 * Calcula qué números de página mostrar en el paginador.
 *
 * Si hay más de `maxPages` páginas, se muestra una ventana deslizante de
 * `maxPages` números centrada en la página actual, de modo que el listado
 * nunca crece más allá de ese tope y el usuario se "desplaza" hacia la
 * derecha/izquierda conforme cambia de página.
 */
export function getVisiblePages(page: number, totalPages: number, maxPages = 7): number[] {
  const total = Math.max(1, Math.floor(totalPages));

  if (total <= maxPages) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const offset = Math.floor((maxPages - 1) / 2);
  const start = Math.max(1, Math.min(page - offset, total - maxPages + 1));
  return Array.from({ length: maxPages }, (_, i) => start + i);
}
