export interface CrudCacheEntry<T> {
  allItems: T[];
  loaded: boolean;
  hydratedAt: number | null;
}

const cache = new Map<string, CrudCacheEntry<unknown>>();

function getEntry<T>(namespace: string): CrudCacheEntry<T> {
  const existing = cache.get(namespace) as CrudCacheEntry<T> | undefined;
  if (existing) return existing;
  const created: CrudCacheEntry<T> = {
    allItems: [],
    loaded: false,
    hydratedAt: null,
  };
  cache.set(namespace, created as CrudCacheEntry<unknown>);
  return created;
}

export function isCrudHydrated(namespace: string): boolean {
  return cache.get(namespace)?.loaded ?? false;
}

export function getCrudCache<T>(namespace: string): CrudCacheEntry<T> | null {
  const entry = cache.get(namespace) as CrudCacheEntry<T> | undefined;
  if (!entry) return null;
  return { ...entry, allItems: [...entry.allItems] };
}

export function setCrudCache<T>(namespace: string, allItems: T[]): void {
  const entry = getEntry<T>(namespace);
  entry.allItems = allItems;
  entry.loaded = true;
  entry.hydratedAt = Date.now();
}

export function clearCrudCache(namespace: string): void {
  const entry = cache.get(namespace);
  if (entry) {
    entry.loaded = false;
    entry.hydratedAt = null;
  }
}

export function clearAllCrudCache(): void {
  cache.clear();
}
