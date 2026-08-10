import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cacheClear, cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { subscribeRealtime } from "@/lib/realtime";
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
   * Polling silencioso en ms. Si se define, la tabla se refresca en background
   * cada `pollMs` para reflejar cambios hechos por OTROS usuarios (multi-caja).
   * El poll SIEMPRE lee del server (bypass del cache), no muestra loading y se
   * pausa cuando la pestaña no es visible; al volver a ser visible refresca al
   * instante.
   */
  pollMs?: number;
  /**
   * Nombres de eventos SSE que refrescan esta tabla al instante (p. ej.
   * `["product.updated"]`). Comparte la ÚNICA conexión SSE del sistema
   * (`subscribeRealtime`); al llegar un evento de la lista se hace
   * cacheClear + re-fetch silencioso (igual que un poll, pero instantáneo).
   */
  realtimeEvents?: string[];
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
  refreshing: boolean;
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
    pollMs,
    realtimeEvents,
  } = opts;

  const [items, setItems] = useState<T[]>(initialData);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounceRef = useRef(false);
  const cacheHitRef = useRef(false);

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
      cacheHitRef.current = false;
      setLoading(false);
      return;
    }
    const key = cacheKey(cacheNamespace, page, q, extraFiltersKey);
    const cached = cacheGet<{ items: T[]; total: number }>(key);
    if (cached) {
      setItems(cached.items);
      setTotal(cached.total);
      cacheHitRef.current = true;
    } else {
      cacheHitRef.current = false;
    }
    setLoading(!cached);
  }, [cacheNamespace, page, q, refreshTick, extraFiltersKey]);

  // Contador de secuencia: descarta respuestas obsoletas. Si un poll silencioso
  // quedó en vuelo y el usuario cambió de página/filtros, su resultado no debe
  // pisar los datos más nuevos (ni apagar el loading de un fetch posterior).
  const requestSeqRef = useRef(0);

  const runFetch = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await fetcherRef.current({
        page,
        limit,
        search: q,
        extraFilters: extraFiltersRef.current || {},
      });
      if (seq !== requestSeqRef.current) return; // respuesta obsoleta
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
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [page, q, extraFiltersKey, cacheNamespace, limit]);

  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    const fromCache = cacheHitRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!fromCache) setLoading(true);
    timerRef.current = setTimeout(() => {
      void runFetch();
    }, fromCache ? 0 : debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [page, q, refreshTick, extraFiltersKey, cacheNamespace, limit, debounceMs, runFetch]);

  // 3) Auto-recover page > totalPages
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // 4) Polling silencioso opcional (`pollMs`) — ver doc en el interface.
  //    Refresca la vista en background para que los cambios hechos por otros
  //    usuarios (edición, ventas, ajustes de stock) lleguen a todos los
  //    terminales abiertos.
  useEffect(() => {
    if (!pollMs) return;

    let inFlight = false;

    const tick = () => {
      // No hacer polling si hay un fetch en curso o la pestaña no es visible.
      if (inFlight || document.hidden) return;
      inFlight = true;
      const token = ++refreshTokenRef.current;
      if (cacheNamespace) cacheClear(cacheNamespace);
      void runFetch().finally(() => {
        inFlight = false;
        if (token === refreshTokenRef.current) setRefreshing(false);
      });
    };

    const intervalId = window.setInterval(tick, pollMs);
    // Al volver a la pestaña, refrescar al instante en vez de esperar el tick.
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pollMs, runFetch, cacheNamespace]);

  // 5) Tiempo real opcional (`realtimeEvents`) — ver doc en el interface.
  //    Escucha los eventos SSE de la tienda y refresca la tabla al instante
  //    cuando llega uno que le interesa. Comparte la conexión única del
  //    sistema; el refcount del cliente cierra la conexión cuando ninguna
  //    tabla la necesita.
  //
  // `realtimeEventsKey` es una key estable (serializada) para que el effect no
  // se re-ejecute por la identidad del array en cada render — mismo patrón que
  // `extraFiltersKey`. `runFetchRef` evita resuscribir al cambiar de página o
  // search (mismo patrón que `fetchSalesRef` en Sales.tsx).
  const realtimeEventsKey = useMemo(() => realtimeEvents?.join(",") ?? "", [realtimeEvents]);

  const runFetchRef = useRef(runFetch);
  useEffect(() => {
    runFetchRef.current = runFetch;
  }, [runFetch]);

  const refreshTokenRef = useRef(0);

  useEffect(() => {
    if (!realtimeEventsKey) return;
    const events = realtimeEventsKey.split(",");

    let inFlight = false;

    const handler = (event: string) => {
      if (!events.includes(event)) return;
      if (inFlight) return; // no apilar refrescos si ya hay uno en vuelo
      inFlight = true;
      const token = ++refreshTokenRef.current;
      // Bypass del cache: el evento significa que los datos del server cambiaron.
      if (cacheNamespace) cacheClear(cacheNamespace);
      setRefreshing(true);
      void runFetchRef.current().finally(() => {
        inFlight = false;
        if (token === refreshTokenRef.current) setRefreshing(false);
      });
    };

    return subscribeRealtime(handler);
  }, [realtimeEventsKey, cacheNamespace]);

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
    refreshing,
    totalPages,
    setSearch,
    setPage,
    refresh,
    refreshImmediate,
  };
}
