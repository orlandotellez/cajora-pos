import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeRealtime, subscribeRealtimeStatus } from "@/lib/realtime";
import { PAGE_LIMIT } from "@/lib/constants";
import { isCrudHydrated, getCrudCache, setCrudCache } from "@/lib/crud-list-cache";

export const FIRST_LOAD_SIZE = 50;

export interface UseCachedCrudListOptions<T> {
  namespace: string;
  hydrate: () => Promise<T[]>;
  searchFn: (item: T, query: string) => boolean;
  filterFn?: (item: T, filters: Record<string, string | undefined>) => boolean;
  realtimeEvents?: string[];
  pollMs?: number;
  limit?: number;
  hydrateFirstPage?: () => Promise<T[]>;
  hydrateRest?: (alreadyLoaded: number, total?: number) => Promise<T[]>;
}

export interface UseCachedCrudListReturn<T> {
  items: T[];
  allItems: T[];
  total: number;
  page: number;
  q: string;
  loading: boolean;
  refreshing: boolean;
  /** true mientras el relleno progresivo en background está bajando el resto de los items (de a 50). */
  filling: boolean;
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
    hydrateFirstPage,
    hydrateRest,
  } = opts;

  const cached = useRef(getCrudCache<T>(namespace)).current;
  const [allItems, setAllItems] = useState<T[]>(
    cached?.loaded ? cached.allItems : [],
  );
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(() => !isCrudHydrated(namespace));
  const [refreshing, setRefreshing] = useState(false);
  const [filling, setFilling] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(() => false);

  useEffect(() => subscribeRealtimeStatus(setRealtimeConnected), []);

  const hydrateRef = useRef(hydrate);
  useEffect(() => { hydrateRef.current = hydrate; }, [hydrate]);
  const hydrateFirstPageRef = useRef(hydrateFirstPage);
  useEffect(() => { hydrateFirstPageRef.current = hydrateFirstPage; }, [hydrateFirstPage]);
  const hydrateRestRef = useRef(hydrateRest);
  useEffect(() => { hydrateRestRef.current = hydrateRest; }, [hydrateRest]);
  const searchFnRef = useRef(searchFn);
  useEffect(() => { searchFnRef.current = searchFn; }, [searchFn]);
  const filterFnRef = useRef(filterFn);
  useEffect(() => { filterFnRef.current = filterFn; }, [filterFn]);

  const generationRef = useRef(0);

  const initialFillRef = useRef(false);

  const doHydrate = useCallback(async (showLoading: boolean, silent = false) => {
    generationRef.current += 1;
    if (showLoading) setLoading(true);
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

  const doHydrateFastAndFill = useCallback(async () => {
    const firstFn = hydrateFirstPageRef.current;
    const restFn = hydrateRestRef.current;

    if (!firstFn || !restFn) {
      await doHydrate(true);
      return;
    }

    const myGeneration = ++generationRef.current;
    initialFillRef.current = true; // pausa el poll mientras el relleno está activo
    setLoading(true);
    try {
      // Fase 1: primera tanda visible YA. Apenas llegan, apagamos el skeleton.
      const first = await firstFn();
      if (generationRef.current !== myGeneration) return; // un SSE/refresh lo invalidó
      let acc = [...first];
      let total = first.length;
      setAllItems(acc);
      setLoading(false);

      // Fase 2: rellenamos en background DE A 50, actualizando la tabla en cada
      // tanda (el usuario ve cómo se va poblando). Sin tocar `loading`.
      setFilling(true); // mientras se rellena, el Header muestra un spinner chico
      for (; ;) {
        const chunk = await restFn(acc.length, total);
        if (generationRef.current !== myGeneration) return; // invalidado por SSE/refresh
        if (chunk.length === 0) break; // no hay más
        acc = [...acc, ...chunk];
        total = Math.max(total, acc.length);
        setAllItems(acc);
        if (chunk.length < FIRST_LOAD_SIZE) break; // última tanda incompleta
      }
      setCrudCache(namespace, acc);
    } catch (err) {
      console.warn("Error al hidratar lista:", err);
      setLoading(false);
    } finally {
      initialFillRef.current = false; // el poll ya puede retomar
      setFilling(false); // termina el relleno (o fue invalidado) → apagar el spinner
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, doHydrate]);

  useEffect(() => {
    if (!isCrudHydrated(namespace)) {
      void doHydrateFastAndFill();
    } else {
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
      if (initialFillRef.current) return;
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
    filling,
    totalPages,
    setSearch,
    setPage,
    refresh,
    refreshImmediate,
    setExternalFilters,
  };
}
