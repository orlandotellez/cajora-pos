import { useCallback, useEffect, useRef, useState } from "react";
import { cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { PAGE_LIMIT } from "@/lib/constants";

export interface UseCrudPaginationOptions<T> {
  /**
   * Función que ejecuta el fetch. El contrato es un objeto normalizado
   * `{ items: T[]; total: number }`. Cada consumer hace su propio adapter
   * a la firma de su API (`categoriesApi.listPaginated` retorna
   * `{categories, total}`, el adapter lo convierte a `{items, total}`).
   */
  fetcher: (params: {
    page: number;
    limit: number;
    search: string;
  }) => Promise<{ items: T[]; total: number }>;
  /** Namespace para cache en `simple-cache`. Si se omite, no se cachea. */
  cacheNamespace?: string;
  /** Items iniciales (antes del primer fetch). Útil para first-paint del cache previo. */
  initialData?: T[];
  /** Tamaño de página. Default = `PAGE_LIMIT` global. */
  limit?: number;
  /** Debounce del search. Default = 300ms (alineado al codebase). */
  debounceMs?: number;
}

export interface UseCrudPaginationReturn<T> {
  items: T[];
  total: number;
  page: number;
  q: string;
  loading: boolean;
  totalPages: number;
  /** Cambia el search term y resetea a la página 1. */
  setSearch: (value: string) => void;
  /** Cambia la página (lo llama el componente de tabla/paginador). */
  setPage: (page: number) => void;
  /** Fuerza un re-fetch (útil después de un save/delete cuando se quiere invalidar manualmente). */
  refresh: () => void;
}

/**
 * Hook genérico para listas paginadas con search + cache opcional.
 *
 * Centraliza el patrón que vivía duplicado en `pages/{Categories,Suppliers,
 * Services,Products}.tsx`. Maneja:
 *
 *  - Estado: `items`, `total`, `page`, `q`, `loading`
 *  - Derived: `totalPages`
 *  - Side effects: cache lookup inicial + debounced fetch (debounceMs)
 *  - Edge cases: si la página actual supera `totalPages` (ej. delete masivo
 *    que bajó el total), vuelve a página 1 automáticamente
 *  - Invalidación: `refresh()` fuerza un nuevo fetch (el consumer puede
 *    llamar `cacheClear(namespace)` antes del refresh para forzar fetch sin cache).
 *
 * **Decisión arquitectónica (Option A)**: cada instancia del hook hace
 * su propio fetch (sin cache global de módulo). Mismas razones que
 * `useStoreSettings`: simplicidad > micro-optimización para N=4 consumers.
 *
 * **Sobre `Users.tsx` y `Inventory.tsx`**: NO requieren este hook directo,
 * se mantienen con su propio useEffect inline.
 *   - `Users.tsx`: no usa cache (la API no tiene GET rápido repetido).
 *   - `Inventory.tsx`: tiene filtros extra (`categoryId`, `stockFilter`, etc.)
 *     que requerirían un segundo parámetro + handling de deps; se cubre
 *     en un followup con extensión del hook para `extraFilters`.
 */
export function useCrudPagination<T>(
  opts: UseCrudPaginationOptions<T>,
): UseCrudPaginationReturn<T> {
  const {
    fetcher,
    cacheNamespace,
    initialData = [],
    limit = PAGE_LIMIT,
    debounceMs = 300,
  } = opts;

  const [items, setItems] = useState<T[]>(initialData);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mutable-ref de `fetcher` para evitar que el debounced useEffect se
  // re-dispare cuando el consumer re-renderiza y crea una nueva identidad
  // de arrow function inline. Mismo patrón que usa `usePosScanner`.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // 1) Cache lookup effect — si hay cacheNamespace y cache hit, lo aplicamos
  //    inmediatamente y marcamos loading=false. Esto se vuelve a chequear
  //    cuando page/q/refreshTick cambian.
  useEffect(() => {
    if (!cacheNamespace) {
      setLoading(false);
      return;
    }
    const key = cacheKey(cacheNamespace, page, q);
    const cached = cacheGet<{ items: T[]; total: number }>(key);
    if (cached) {
      setItems(cached.items);
      setTotal(cached.total);
    }
    setLoading(!cached);
  }, [cacheNamespace, page, q, refreshTick]);

  // 2) Debounced fetch effect
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await fetcherRef.current({ page, limit, search: q });
        setItems(result.items);
        setTotal(result.total);
        if (cacheNamespace) {
          cacheSet(cacheKey(cacheNamespace, page, q), {
            items: result.items,
            total: result.total,
          });
        }
      } catch (err) {
        console.warn("Error al listar:", err);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [page, q, refreshTick, cacheNamespace, limit, debounceMs]);

  // 3) Auto-recover page > totalPages
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const setSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return {
    items,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refresh,
  };
}
