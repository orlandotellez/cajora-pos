import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    extraFilters: Record<string, string | undefined>;
  }) => Promise<{ items: T[]; total: number }>;
  /** Namespace para cache en `simple-cache`. Si se omite, no se cachea. */
  cacheNamespace?: string;
  /** Items iniciales (antes del primer fetch). Útil para first-paint del cache previo. */
  initialData?: T[];
  /** Tamaño de página. Default = `PAGE_LIMIT` global. */
  limit?: number;
  /** Debounce del search. Default = 300ms (alineado al codebase). */
  debounceMs?: number;
  /**
   * Filtros extra (e.g. `categoryId`, `stockFilter`). Se serializan en la
   * cache key (para que cada combinación de filtros tenga su propia entry)
   * y se pasan al fetcher como argumento normalizado.
   *
   * Cambiar un valor dispara re-fetch. El consumer es responsable de
   * resetear `page` a 1 al cambiar un filtro (el hook no lo hace
   * automáticamente porque eso causaría un doble-fetch vía el flujo
   * setState→re-render→effect).
   */
  extraFilters?: Record<string, string | undefined>;
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
  /**
   * Igual que `refresh` pero sin esperar el debounce: ejecuta el fetch de
   * inmediato y cancela cualquier timer pendiente. Pensado para
   * flujos post-save / post-delete donde la tabla no debe quedar
   * momentáneamente desactualizada.
   */
  refreshImmediate: () => void;
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
 *    `refreshImmediate()` hace lo mismo pero sin esperar el debounce —
 *    útil tras save/delete para que la UI refleje los cambios al instante.
 *
 * **Decisión arquitectónica (Option A)**: cada instancia del hook hace
 * su propio fetch (sin cache global de módulo). Mismas razones que
 * `useStoreSettings`: simplicidad > micro-optimización para N=4 consumers.
 *
 * **Sobre `Users.tsx` e `Inventory.tsx`**:
 *   - `Users.tsx`: no usa cache (la API no tiene GET rápido repetido),
 *     se mantiene con su useEffect inline.
 *   - `Inventory.tsx` (sección productos): ahora puede usar el hook con
 *     `extraFilters: { categoryId, stockFilter }`. Las secciones de
 *     movimientos y batches no usan search, se quedan con useEffect inline.
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
    extraFilters,
  } = opts;

  const [items, setItems] = useState<T[]>(initialData);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounceRef = useRef(false);

  // Mutable-ref de `fetcher` para evitar que el debounced useEffect se
  // re-dispare cuando el consumer re-renderiza y crea una nueva identidad
  // de arrow function inline. Mismo patrón que usa `usePosScanner`.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Misma idea para `extraFilters`: una clave estable derivada del CONTENIDO
  // (no de la identidad del objeto) que se usa en deps y en cache key,
  // + un ref mutable para que el fetcher siempre vea el último valor
  // cuando se llama desde el effect debounced.
  const extraFiltersKey = useMemo(() => {
    if (!extraFilters) return "";
    return Object.entries(extraFilters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v ?? ""}`)
      .join("&");
  }, [extraFilters]);

  const extraFiltersRef = useRef(extraFilters);
  useEffect(() => {
    extraFiltersRef.current = extraFilters;
  }, [extraFilters]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // 1) Cache lookup effect — si hay cacheNamespace y cache hit, lo aplicamos
  //    inmediatamente y marcamos loading=false. Se re-ejecuta cuando
  //    page/q/refreshTick/extraFiltersKey cambian.
  useEffect(() => {
    if (!cacheNamespace) {
      setLoading(false);
      return;
    }
    const key = cacheKey(cacheNamespace, page, q, extraFiltersKey);
    const cached = cacheGet<{ items: T[]; total: number }>(key);
    if (cached) {
      setItems(cached.items);
      setTotal(cached.total);
    }
    setLoading(!cached);
  }, [cacheNamespace, page, q, refreshTick, extraFiltersKey]);

  const runFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current({
        page,
        limit,
        search: q,
        extraFilters: extraFiltersRef.current || {},
      });
      setItems(result.items);
      setTotal(result.total);
      if (cacheNamespace) {
        cacheSet(cacheKey(cacheNamespace, page, q, extraFiltersKey), {
          items: result.items,
          total: result.total,
        });
      }
    } catch (err) {
      console.warn("Error al listar:", err);
    } finally {
      setLoading(false);
    }
  }, [page, q, extraFiltersKey, cacheNamespace, limit]);

  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(true);
      void runFetch();
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [page, q, refreshTick, extraFiltersKey, cacheNamespace, limit, debounceMs, runFetch]);

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

  const refreshImmediate = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    skipNextDebounceRef.current = true;
    setRefreshTick((t) => t + 1);
    setLoading(true);
    void runFetch();
  }, [runFetch]);

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
    refreshImmediate,
  };
}
