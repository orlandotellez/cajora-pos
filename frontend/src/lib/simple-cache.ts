const MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 30_000; // 30 segundos

interface CacheEntry {
  data: unknown;
  key: string;
  expiresAt: number;
}

const _store = new Map<string, CacheEntry>();

function touch(key: string): void {
  const entry = _store.get(key);
  if (entry) {
    _store.delete(key);
    _store.set(key, entry);
  }
}

function evict(): void {
  if (_store.size <= MAX_ENTRIES) return;
  const oldest = _store.keys().next().value;
  if (oldest != null) _store.delete(oldest);
}

export function cacheGet<T>(key: string): T | null {
  touch(key);
  const entry = _store.get(key);
  if (!entry) return null;
  // Si expiró, eliminar y devolver null
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs?: number): void {
  _store.set(key, {
    data,
    key,
    expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL_MS),
  });
  evict();
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    _store.clear();
    return;
  }
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p != null && p !== "").join(":");
}
