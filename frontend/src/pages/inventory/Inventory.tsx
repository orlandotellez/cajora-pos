import { useCallback, useState } from "react";
import { productsApi, type Product } from "@/api/products";
import { categoriesApi, type Category } from "@/api/categories";
import { inventoryApi, type InventoryMovement, type LowStockProduct, type BatchResponse } from "@/api/inventory";
import { suppliersApi } from "@/api/suppliers";
import type { Supplier } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { AdjustStockModal } from "@/components/pages/inventory/AdjustStockModal";
import { MovementDetailModal } from "@/components/pages/inventory/MovementDetailModal";
import { InventoryProductDetailModal } from "@/components/pages/inventory/InventoryProductDetailModal";
import { BatchMovementModal } from "@/components/pages/inventory/BatchMovementModal";
import { BatchDetailModal } from "@/components/pages/inventory/BatchDetailModal";
import { EditInventoryModal } from "@/components/pages/inventory/EditInventoryModal";
import { MovementHistoryTable } from "@/components/pages/inventory/MovementHistoryTable";
import { BatchHistoryTable } from "@/components/pages/inventory/BatchHistoryTable";
import styles from "./Inventory.module.css";
import { Header } from "@/components/pages/inventory/Header";
import { InventoryProductosSection } from "@/components/pages/inventory/InventoryProductosSection";

type InventoryTab = "inventory" | "movements" | "batches";

const TAB_ORDER: InventoryTab[] = ["inventory", "movements", "batches"];
const TAB_LABELS: Record<InventoryTab, string> = {
  inventory: "Inventario",
  movements: "Movimientos",
  batches: "Movimientos agrupados",
};
const TAB_ID = (t: InventoryTab) => `inventory-tab-${t}`;
const PANEL_ID = (t: InventoryTab) => `inventory-panel-${t}`;

type AdjustState = {
  id: string;
  name: string;
  stock: number;
  cost?: number;
  unit_type?: string | null;
  unit_quantity?: number | null;
} | null;

// Resuelve el empaque del producto EN EL CLIENTE: el backend puede no enviar
// unit_type/unit_quantity (deploy viejo), así que lo completamos desde la
// lista de productos ya cargada. Si el movimiento ya lo trae, no se toca.
function withProductUnit(m: InventoryMovement, products: Product[]): InventoryMovement {
  if (m.unit_type) return m;
  const p = products.find((prod) => prod.id === m.product_id);
  return p ? { ...m, unit_type: p.unit_type ?? null, unit_quantity: p.unit_quantity ?? null } : m;
}

export default function Inventory() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<InventoryTab>("inventory");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">("");
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adjust, setAdjust] = useState<AdjustState>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
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
    refreshing: refreshingProducts,
    refreshImmediate: refreshProducts,
  } = useCrudPagination<Product>({
    cacheNamespace: "inventory",
    pollMs: 5_000,
    realtimeEvents: [
      "product.created",
      "product.updated",
      "product.deleted",
      "inventory.movement.created",
      "inventory.batch.created",
      "sale.created",
    ],
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
    loading: movementsLoading,
    setPage: setMovementPage,
    refreshing: refreshingMovements,
    refreshImmediate: refreshMovements,
  } = useCrudPagination<InventoryMovement>({
    cacheNamespace: "inventory-movements",
    pollMs: 10_000,
    // Un ajuste manual, una venta o un lote generan movimientos de inventario.
    realtimeEvents: ["inventory.movement.created", "inventory.batch.created", "sale.created"],
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
    loading: batchesLoading,
    setPage: setBatchPage,
    refreshing: refreshingBatches,
    refreshImmediate: refreshBatches,
  } = useCrudPagination<BatchResponse>({
    cacheNamespace: "inventory-batches",
    pollMs: 10_000,
    realtimeEvents: ["inventory.batch.created"],
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
      toast((err as Error)?.message || "Error al cargar el detalle del lote", "error");
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
        cost: product.cost,
        unit_type: product.unit_type,
        unit_quantity: product.unit_quantity,
      }),
    [setAdjust],
  );

  const handleEdit = useCallback((product: Product) => setEditProduct(product), []);

  // Desde el detalle: cerrar el detalle y abrir la acción pedida.
  const handleDetailEdit = useCallback((product: Product) => {
    setDetailProduct(null);
    setEditProduct(product);
  }, []);

  const handleDetailAdjust = useCallback((product: Product) => {
    setDetailProduct(null);
    handleAdjust(product);
  }, [handleAdjust]);

  function handleBatchCreated() {
    refetchAll();
  }

  function onTabsKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const current = TAB_ORDER.indexOf(activeTab);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % TAB_ORDER.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TAB_ORDER.length - 1;

    const tab = TAB_ORDER[next];
    setActiveTab(tab);
    requestAnimationFrame(() => {
      document.getElementById(TAB_ID(tab))?.focus();
    });
  }

  return (
    <div className={styles.page}>
      <Header setBatchModalOpen={() => setBatchModalOpen(true)} />

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Secciones de inventario"
        onKeyDown={onTabsKeyDown}
      >
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            id={TAB_ID(tab)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={PANEL_ID(tab)}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div
        id={PANEL_ID(activeTab)}
        role="tabpanel"
        aria-labelledby={TAB_ID(activeTab)}
      >
        {activeTab === "inventory" && (
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
            onEdit={handleEdit}
            onAdjust={handleAdjust}
            onRowClick={setDetailProduct}
            refreshing={refreshingProducts}
          />
        )}

        {activeTab === "movements" && (
          <section className={styles.movementSection}>
            <h2 className={styles.movementSectionTitle}>Historial de movimientos</h2>
            <MovementHistoryTable
              movements={movements.map((m) => withProductUnit(m, products))}
              page={movementPage}
              totalPages={movementsTotalPages}
              loading={movementsLoading}
              onPageChange={setMovementPage}
              onSelect={setSelectedMovement}
              refreshing={refreshingMovements}
            />
          </section>
        )}

        {activeTab === "batches" && (
          <section className={styles.movementSection}>
            <h2 className={styles.movementSectionTitle}>Historial de movimientos agrupados</h2>
            <BatchHistoryTable
              batches={batches}
              page={batchPage}
              totalPages={batchesTotalPages}
              loading={batchesLoading}
              onPageChange={setBatchPage}
              onSelect={openBatchDetail}
              refreshing={refreshingBatches}
            />
          </section>
        )}
      </div>

      {detailProduct && (
        <InventoryProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onEdit={handleDetailEdit}
          onAdjust={handleDetailAdjust}
        />
      )}

      {adjust && (
        <AdjustStockModal
          adjust={adjust}
          onClose={() => setAdjust(null)}
          onApplied={handleAdjustApplied}
        />
      )}

      {editProduct && (
        <EditInventoryModal
          product={editProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setEditProduct(null)}
          onSaved={refetchAll}
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
