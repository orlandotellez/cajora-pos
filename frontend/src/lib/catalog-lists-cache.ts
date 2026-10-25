import type { Category } from "@/api/categories";
import type { Supplier } from "@/api/suppliers";

const CATEGORIES_KEY = "caja-categories";
const SUPPLIERS_KEY = "caja-suppliers";

function read<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
}

function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function readCachedCategories(): Category[] | null {
  return read<Category>(CATEGORIES_KEY);
}

export function cacheCategories(list: Category[]): void {
  write(CATEGORIES_KEY, list);
}

export function clearCachedCategories(): void {
  clear(CATEGORIES_KEY);
}

export function readCachedSuppliers(): Supplier[] | null {
  return read<Supplier>(SUPPLIERS_KEY);
}

export function cacheSuppliers(list: Supplier[]): void {
  write(SUPPLIERS_KEY, list);
}

export function clearCachedSuppliers(): void {
  clear(SUPPLIERS_KEY);
}
