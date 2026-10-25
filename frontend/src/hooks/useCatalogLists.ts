import { useEffect, useState } from "react";
import { categoriesApi, type Category } from "@/api/categories";
import { suppliersApi, type Supplier } from "@/api/suppliers";
import {
  cacheCategories,
  cacheSuppliers,
  readCachedCategories,
  readCachedSuppliers,
} from "@/lib/catalog-lists-cache";

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(
    () => readCachedCategories() ?? [],
  );

  useEffect(() => {
    let alive = true;
    categoriesApi
      .list()
      .then((list) => {
        if (!alive) return;
        setCategories(list);
        cacheCategories(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return categories;
}

export function useSuppliers(): Supplier[] {
  const [suppliers, setSuppliers] = useState<Supplier[]>(
    () => readCachedSuppliers() ?? [],
  );

  useEffect(() => {
    let alive = true;
    suppliersApi
      .list()
      .then((res) => {
        if (!alive) return;
        setSuppliers(res.suppliers);
        cacheSuppliers(res.suppliers);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return suppliers;
}
