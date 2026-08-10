import { useCallback, useState } from "react";
import { productsApi, type Product } from "@/api/products";
import { categoriesApi, type Category } from "@/api/categories";
import { inventoryApi, type InventoryMovement, type LowStockProduct, type BatchResponse } from "@/api/inventory";
import { suppliersApi } from "@/api/suppliers";
import type { Supplier } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { AdjustStockModal } from "@/components/pages/inventory/AdjustStockModal";
import { MovementDetailModal } from "@/components/pages/inventory/MovementDetailModal";
import { BatchMovementModal } from "@/components/pages/inventory/BatchMovementModal";
import { BatchDetailModal } from "@/components/pages/inventory/BatchDetailModal";
import { MovementHistoryTable } from "@/components/pages/inventory/MovementHistoryTable";
import { BatchHistoryTable } from "@/components/pages/inventory/BatchHistoryTable";
import styles from "./Inventory.module.css";
import { Header } from "@/components/pages/inventory/Header";
import { InventoryProductosSection } from "@/components/pages/inventory/InventoryProductosSection";

type AdjustState = {
  id: string;
  name: string;
  stock: number;
  unit_type?: string | null;
  unit_quantity?: number | null;
} | null;

export default function Inventory() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">("");
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adjust, setAdjust] = useState<AdjustState>(null);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDetail, setBatchDetail] = useState<BatchResponse | null>(null);

  const {
    items: products,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate: refreshProducts,
  } = useCrudPagination<Product>({
    cacheNamespace: "inventory",
    pollMs: 30_000,
    extraFilters: { categoryId, stockFilter },
    fetcher: async ({ page, limit, search, extraFilters }) => {
      const [productRes, lowStockRes, cats, sups] = await Promise.all([
        productsApi.list({
          page,
          limit,
          active: true,
          search: search || undefined,
          category_id: extraFilters.categoryId || undefined,
          low_stock: extraFilters.stockFilter === "low" || undefined,
          out_of_stock: extraFilters.stockFilter === "out" || undefined,
        }),
        inventoryApi.lowStock(),
        categories.length === 0 ? categoriesApi.list() : Promise.resolve(undefined),
        suppliers.length === 0 ? suppliersApi.list() : Promise.resolve(undefined),
      ]);
      setLowStockProducts(lowStockRes.products);
      if (cats) setCategories(cats);
      if (sups) setSuppliers(sups.suppliers);
      return { items: productRes.products, total: productRes.total };
    },
  });

  const {
    items: movements,
    total: movementsTotal,
    page: movementPage,
    totalPages: movementsTotalPages,
    setPage: setMovementPage,
    refreshImmediate: refreshMovements,
  } = useCrudPagination<InventoryMovement>({
    cacheNamespace: "inventory-movements",
    pollMs: 60_000,
    limit: 10,
    debounceMs: 0,
    fetcher: async ({ page, limit }) => {
      const res = await inventoryApi.list({ page, limit });
      return { items: res.movements, total: res.total };
    },
  });

  const {
    items: batches,
    total: batchesTotal,
    page: batchPage,
    totalPages: batchesTotalPages,
    setPage: setBatchPage,
    refreshImmediate: refreshBatches,
  } = useCrudPagination<BatchResponse>({
    cacheNamespace: "inventory-batches",
    pollMs: 60_000,
    limit: 10,
    debounceMs: 0,
    fetcher: async ({ page, limit }) => {
      const res = await inventoryApi.batchList({ page, limit });
      return { items: res.batches, total: res.total };
    },
  });

  async function openBatchDetail(batch: BatchResponse) {
    try {
      const detail = await inventoryApi.batchGetById(batch.id);
      setBatchDetail(detail);
    } catch (err) {
      console.error("Error al cargar detalle", err);
    }
  }

  function refetchAll() {
    cacheClear("inventory");
    cacheClear("inventory-movements");
    cacheClear("inventory-batches");
    refreshProducts();
    refreshMovements();
    refreshBatches();
  }

  function handleAdjustApplied() {
    refetchAll();
  }

  const handleAdjust = useCallback(
    (product: Product) =>
      setAdjust({
        id: product.id,
        name: product.name,
        stock: product.stock,
        unit_type: product.unit_type,
        unit_quantity: product.unit_quantity,
      }),
    [setAdjust],
  );

  function handleBatchCreated() {
    refetchAll();
  }

  return (
    <div className={styles.page}>
      <Header setBatchModalOpen={() => setBatchModalOpen(true)} />

      <InventoryProductosSection
        products={products}
        total={total}
        page={page}
        totalPages={totalPages}
        loading={loading}
        q={q}
        setSearch={setSearch}
        setPage={setPage}
        categories={categories}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        lowStockProducts={lowStockProducts}
        onAdjust={handleAdjust}
      />

      <section className={styles.movementSection}>
        <h2 className={styles.movementSectionTitle}>Historial de movimientos</h2>
        <MovementHistoryTable
          movements={movements}
          page={movementPage}
          totalPages={movementsTotalPages}
          onPageChange={setMovementPage}
          onSelect={setSelectedMovement}
        />
      </section>

      <section className={styles.movementSection}>
        <h2 className={styles.movementSectionTitle}>Historial de movimientos agrupados</h2>
        <BatchHistoryTable
          batches={batches}
          page={batchPage}
          totalPages={batchesTotalPages}
          onPageChange={setBatchPage}
          onSelect={openBatchDetail}
        />
      </section>

      {adjust && (
        <AdjustStockModal
          adjust={adjust}
          onClose={() => setAdjust(null)}
          onApplied={handleAdjustApplied}
        />
      )}

      {selectedMovement && (
        <MovementDetailModal
          movement={selectedMovement}
          onClose={() => setSelectedMovement(null)}
        />
      )}

      <BatchMovementModal
        open={batchModalOpen}
        suppliers={suppliers}
        products={products}
        onClose={() => setBatchModalOpen(false)}
        onCreated={handleBatchCreated}
      />

      {batchDetail && (
        <BatchDetailModal
          batch={batchDetail}
          onClose={() => setBatchDetail(null)}
        />
      )}
    </div>
  );
}
