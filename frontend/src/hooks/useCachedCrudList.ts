import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeRealtime, subscribeRealtimeStatus } from "@/lib/realtime";
import { PAGE_LIMIT } from "@/lib/constants";
import { isCrudHydrated, getCrudCache, setCrudCache } from "@/lib/crud-list-cache";

export interface UseCachedCrudListOptions<T> {
  namespace: string;
  hydrate: () => Promise<T[]>;
  searchFn: (item: T, query: string) => boolean;
  filterFn?: (item: T, filters: Record<string, string | undefined>) => boolean;
  realtimeEvents?: string[];
  pollMs?: number;
  limit?: number;
}

export interface UseCachedCrudListReturn<T> {
  items: T[];
  allItems: T[];
  total: number;
  page: number;
  q: string;
  loading: boolean;
  refreshing: boolean;
  totalPages: number;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  refresh: () => void;
  refreshImmediate: () => void;
  setExternalFilters: (filters: Record<string, string | undefined>) => void;
}

export function useCachedCrudList<T>(
  opts: UseCachedCrudListOptions<T>,
): UseCachedCrudListReturn<T> {
  const {
    namespace,
    hydrate,
    searchFn,
    filterFn,
    realtimeEvents,
    pollMs,
    limit = PAGE_LIMIT,
  } = opts;

  const cached = useRef(getCrudCache<T>(namespace)).current;
  const [allItems, setAllItems] = useState<T[]>(
    cached?.loaded ? cached.allItems : [],
  );
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(() => !isCrudHydrated(namespace));
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(() => false);

  useEffect(() => subscribeRealtimeStatus(setRealtimeConnected), []);

  const hydrateRef = useRef(hydrate);
  useEffect(() => { hydrateRef.current = hydrate; }, [hydrate]);
  const searchFnRef = useRef(searchFn);
  useEffect(() => { searchFnRef.current = searchFn; }, [searchFn]);
  const filterFnRef = useRef(filterFn);
  useEffect(() => { filterFnRef.current = filterFn; }, [filterFn]);

  const doHydrate = useCallback(async (showLoading: boolean, silent = false) => {
    if (showLoading) setLoading(true);
    // En modo silencioso no tocamos `refreshing`: el refresh en background de
    // montaje/poll no debe encender el badge "Actualizando…" (sería ruido en
    // cada entrada a la página). Solo acciones explícitas (SSE en vivo) lo
    // muestran.
    if (!silent) setRefreshing(!showLoading);
    try {
      const items = await hydrateRef.current();
      setAllItems(items);
      setCrudCache(namespace, items);
    } catch (err) {
      console.warn("Error al hidratar lista:", err);
    } finally {
      if (showLoading) setLoading(false);
      if (!silent) setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  useEffect(() => {
    if (!isCrudHydrated(namespace)) {
      // Primera vez en esta sesión: todavía no hay nada que mostrar,
      // hidratamos con skeleton.
      void doHydrate(true);
    } else {
      // Ya hay caché a nivel de módulo: la mostramos al instante (re-entrada
      // sin skeleton), pero al mismo tiempo re-hidratamos en background desde
      // el server. Así no nos quedamos con una foto vieja si OTRO terminal
      // (o esta misma pestaña en otra vista) modificó la data mientras este
      // namespace no estaba montado/escuchando. Silencioso: no encender el
      // badge en cada entrada.
      void doHydrate(false, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  const normalizedQ = useMemo(() => q.trim().toLowerCase(), [q]);

  const filtered = useMemo(() => {
    let result = allItems;
    if (normalizedQ) {
      result = result.filter((item) => searchFnRef.current(item, normalizedQ));
    }
    if (filterFnRef.current) {
      result = result.filter((item) => filterFnRef.current!(item, filters));
    }
    return result;
  }, [allItems, normalizedQ, filters]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const items = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const setSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    void doHydrate(false);
  }, [doHydrate]);

  const refreshImmediate = useCallback(() => {
    void doHydrate(true);
  }, [doHydrate]);

  const setExternalFilters = useCallback((next: Record<string, string | undefined>) => {
    setFilters(next);
    setPage(1);
  }, []);

  const realtimeEventsKey = useMemo(
    () => realtimeEvents?.join(",") ?? "",
    [realtimeEvents],
  );

  useEffect(() => {
    if (!realtimeEventsKey) return;
    const events = realtimeEventsKey.split(",");

    let inFlight = false;
    const handler = (event: string) => {
      if (!events.includes(event)) return;
      if (inFlight) return;
      inFlight = true;
      setRefreshing(true);
      void doHydrate(false).finally(() => {
        inFlight = false;
      });
    };

    return subscribeRealtime(handler);
  }, [realtimeEventsKey, doHydrate]);

  const pollTokenRef = useRef(0);
  useEffect(() => {
    if (!pollMs) return;

    let inFlight = false;
    const tick = () => {
      if (inFlight || document.hidden) return;
      if (realtimeConnected && realtimeEventsKey) return;
      inFlight = true;
      const token = ++pollTokenRef.current;
      // Silencioso: el poll es un respaldo en background, no debe encender
      // el badge "Actualizando…".
      void doHydrate(false, true).finally(() => {
        inFlight = false;
        if (token === pollTokenRef.current) setRefreshing(false);
      });
    };

    const intervalId = window.setInterval(tick, pollMs);
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      pollTokenRef.current += 1;
    };
  }, [pollMs, doHydrate, realtimeConnected, realtimeEventsKey]);

  return {
    items,
    allItems,
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
    setExternalFilters,
  };
}
