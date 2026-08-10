import { useEffect, useRef, useState } from "react";

export interface UseDebouncedSearchOptions<T> {
  /** Texto de búsqueda. Si está vacío (o solo whitespace), no se hace fetch. */
  query: string;
  /** Función que ejecuta el fetch con la query ya trimmeada. */
  fetcher: (term: string) => Promise<T[]>;
  /** Debounce en ms. Default = 300ms (alineado al codebase). */
  delay?: number;
  /**
   * Si cambia, re-ejecuta la búsqueda con el término actual (sin tocar el
   * input). Lo usa el POS para refrescar los resultados visibles cuando llega
   * un evento SSE de stock (otro cajero vendió → el stock mostrado cambia).
   */
  refreshKey?: number;
}

export interface UseDebouncedSearchReturn<T> {
  results: T[];
  loading: boolean;
}

/**
 * Hook genérico para búsquedas con debounce.
 *
 * Centraliza el patrón que vivía inline en `pages/Pos.tsx` (la búsqueda
 * de productos+servicios con 300 ms de debounce).
 *
 * **Comportamiento**:
 *   - `query` vacío o solo whitespace: limpia `results` y no dispara fetch.
 *   - `query` no vacío: arranca un timer de `delay` ms; al resolverse,
 *     ejecuta `fetcher(term)` y guarda el resultado en `results`.
 *   - En cada cambio de `query` o re-mount, el timer pendiente se cancela
 *     (cleanup en el useEffect) y se arranca uno nuevo.
 *   - Si `fetcher` rechaza, no propaga el error (loguea `console.warn`)
 *     y vacía `results`. El consumer no necesita try/catch.
 *
 * **Por qué `fetcher` se inyecta (vs lógica hardcoded)**:
 * la agregación de productos + servicios (heterogénea con type
 * discrimination) NO pertenece al hook — vive en el fetcher que el
 * consumer arma. Esto hace al hook reutilizable (e.g. para una futura
 * búsqueda en otros screens) sin acoplarlo a la API del POS.
 *
 * **Mutable ref de `fetcher`**: idéntico al patrón de `useCrudPagination`
 * — evita que el debounced effect re-arme el timer si el parent crea una
 * nueva identidad de arrow function en cada render.
 *
 * **Race condition fix (generation counter)**:
 * Si el usuario tipea rápido, varios fetches pueden quedar en vuelo y
 * resolver fuera de orden. Cada llamada captura un `requestIdRef` antes
 * del await; solo el último requestId aplica su resultado o error.
 * Esto evita pisar `results` con data stale de un input previo. No
 * requiere AbortSignal en la API (lo cual no está soportado en `api.ts`);
 * descarta resultados viejos en lugar de cancelar HTTP requests.
 */
export function useDebouncedSearch<T>(
  opts: UseDebouncedSearchOptions<T>,
): UseDebouncedSearchReturn<T> {
  const { query, fetcher, delay = 300, refreshKey = 0 } = opts;

  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await fetcherRef.current(term);
        if (myRequestId !== requestIdRef.current) return;
        setResults(data);
      } catch (err) {
        if (myRequestId !== requestIdRef.current) return;
        console.warn("Error al buscar:", err);
        setResults([]);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, delay, refreshKey]);

  return { results, loading };
}
