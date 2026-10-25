import { useEffect, useState } from "react";
import { productsApi, type Product } from "@/api/products";
import { useCachedCrudList } from "@/hooks/useCachedCrudList";
import { fetchAllPages, fetchFirstPage, fetchPageFrom } from "@/lib/fetch-all-pages";
import { stripAccents } from "@/lib/catalog";
import { useToast } from "@/components/common/ui/Toast";
import { usePosStore } from "@/store/posStore";
import { useCategories, useSuppliers } from "@/hooks/useCatalogLists";
import { ProductGrid } from "@/components/pages/products/ProductGrid";
import { Header } from "@/components/pages/products/Header";
import { Filter } from "@/components/pages/products/Filter";
import { ProductDetailModal } from "@/components/pages/products/ProductDetailModal";
import styles from "./Products.module.css";

export default function Products() {
  const { toast } = useToast();
  const addToCart = usePosStore((s) => s.addToCart);
  const categories = useCategories();
  const suppliers = useSuppliers();
  const [categoryId, setCategoryId] = useState("");
  const [unitType, setUnitType] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);

  const {
    items: products,
    total,
    page,
    q,
    loading,
    refreshing,
    filling,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
    setExternalFilters,
  } = useCachedCrudList<Product>({
    namespace: "products",
    hydrate: () =>
      fetchAllPages((page, limit) =>
        productsApi
          .list({ page, limit })
          .then((res) => ({ items: res.products, total: res.total })),
      ),
    hydrateFirstPage: () =>
      fetchFirstPage((page, limit) =>
        productsApi
          .list({ page, limit })
          .then((res) => ({ items: res.products, total: res.total })),
      ).then((res) => res.items),
    hydrateRest: (alreadyLoaded) =>
      fetchPageFrom(
        (page, limit) =>
          productsApi
            .list({ page, limit })
            .then((res) => ({ items: res.products, total: res.total })),
        alreadyLoaded,
      ).then((res) => res.items),
    searchFn: (p, query) => {
      const q = stripAccents(query);
      return (
        stripAccents(p.name.toLowerCase()).includes(q) ||
        (p.barcode ? stripAccents(p.barcode.toLowerCase()).includes(q) : false) ||
        (p.category?.name ? stripAccents(p.category.name.toLowerCase()).includes(q) : false)
      );
    },
    filterFn: (p, filters) => {
      if (filters.categoryId && p.category?.id !== filters.categoryId) return false;
      if (filters.unitType && p.unit_type !== filters.unitType) return false;
      return true;
    },
    pollMs: 5_000,
    realtimeEvents: [
      "product.created",
      "product.updated",
      "product.deleted",
      "sale.created",
      "inventory.movement.created",
      "inventory.batch.created",
      "category.updated",
      "category.deleted",
      "supplier.updated",
      "supplier.deleted",
    ],
  });

  useEffect(() => {
    setExternalFilters({ categoryId, unitType });
  }, [categoryId, unitType, setExternalFilters]);

  return (
    <div className={styles.page}>
      <Header total={total} loading={loading} filling={filling} />

      <Filter
        q={q}
        setSearch={setSearch}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        unitType={unitType}
        setUnitType={setUnitType}
        setPage={setPage}
        categories={categories}
      />

      <ProductGrid
        products={products}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onProductClick={setDetail}
        onAddToCart={(p) => {
          const inCart = usePosStore
            .getState()
            .cart.find((x) => x._type === "product" && x.id === p.id);
          const inCartQty = inCart ? inCart.quantity : 0;
          if (p.stock <= 0) {
            toast(`"${p.name}" no tiene stock disponible`, "error");
            return;
          }
          if (inCartQty + 1 > p.stock) {
            toast(
              `Stock insuficiente para "${p.name}": disponible ${p.stock}, ya tenés ${inCartQty} en la lista`,
              "error",
            );
            return;
          }
          addToCart(p);
          toast(`"${p.name}" agregado a la lista de venta (${inCartQty + 1} en total)`, "success", { dedupeKey: p.id });
        }}
        refreshing={refreshing}
      />

      {detail && (
        <ProductDetailModal
          product={detail}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setDetail(null)}
          onSaved={refreshImmediate}
          readOnly
        />
      )}
    </div>
  );
}
