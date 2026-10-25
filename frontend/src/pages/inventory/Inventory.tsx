import { useCallback, useState } from "react";
import { productsApi, type CreateProductPayload, type Product } from "@/api/products";
import { inventoryApi, type InventoryMovement, type LowStockProduct, type BatchResponse } from "@/api/inventory";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useCategories, useSuppliers } from "@/hooks/useCatalogLists";
import { usePermissions } from "@/hooks/usePermissions";
import { EditProductModal } from "@/components/pages/products/EditProductModal";
import { ImportCsvModal } from "@/components/pages/products/ImportCsvModal";
import { ProductDetailModal } from "@/components/pages/products/ProductDetailModal";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { useToast } from "@/components/common/ui/Toast";
import { AdjustStockModal } from "@/components/pages/inventory/AdjustStockModal";
import { MovementDetailModal } from "@/components/pages/inventory/MovementDetailModal";
import { InventoryProductDetailModal } from "@/components/pages/inventory/InventoryProductDetailModal";
import { BatchMovementModal } from "@/components/pages/inventory/BatchMovementModal";
import { BatchDetailModal } from "@/components/pages/inventory/BatchDetailModal";
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

const emptyForm = {
  name: "",
  barcode: "",
  unit_type: "",
  unit_quantity: 0,
  category_id: "",
  supplier_id: "",
  price: 0,
  cost: 0,
  stock: 0,
  low_stock_threshold: 5,
};

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
  const { has } = usePermissions();
  const canWrite = has("catalog_write");
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTab>("inventory");
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [unitType, setUnitType] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">("");
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const suppliers = useSuppliers();
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
    extraFilters: { categoryId, unitType, stockFilter },
    fetcher: async ({ page, limit, search, extraFilters }) => {
      const [productRes, lowStockRes] = await Promise.all([
        productsApi.list({
          page,
          limit,
          active: true,
          search: search || undefined,
          category_id: extraFilters.categoryId || undefined,
          unit_type: extraFilters.unitType || undefined,
          low_stock: extraFilters.stockFilter === "low" || undefined,
          out_of_stock: extraFilters.stockFilter === "out" || undefined,
        }),
        inventoryApi.lowStock(),
      ]);
      setLowStockProducts(lowStockRes.products);
      return { items: productRes.products, total: productRes.total };
    },
  });

  const {
    items: movements,
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

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: CreateProductPayload = {
        name: form.name,
        barcode: form.barcode || undefined,
        unit_type: form.unit_type || undefined,
        unit_quantity: form.unit_quantity || undefined,
        category_id: form.category_id || undefined,
        supplier_id: form.supplier_id || undefined,
        price: form.price,
        cost: form.cost || undefined,
        stock: form.stock,
        low_stock_threshold: form.low_stock_threshold,
      };
      await productsApi.create(data);
      setCreating(false);
      refetchAll();
      toast("Producto guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar producto:", err);
      toast((err as Error)?.message || "Error al guardar producto", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    try {
      await productsApi.delete(id);
      refetchAll();
      toast("Producto eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      toast((err as Error)?.message || "Error al eliminar producto", "error");
    }
  }

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
      <Header
        setBatchModalOpen={() => setBatchModalOpen(true)}
        onCreateProduct={canWrite ? openCreate : undefined}
        onImport={canWrite ? () => setImportOpen(true) : undefined}
        canWrite={canWrite}
      />

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
            unitType={unitType}
            setUnitType={setUnitType}
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
        <ProductDetailModal
          product={editProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setEditProduct(null)}
          onSaved={refetchAll}
          onDelete={canWrite ? (p) => { setEditProduct(null); setDeleteTarget(p); } : undefined}
          readOnly={!canWrite}
        />
      )}

      {creating && (
        <EditProductModal
          setEditing={() => setCreating(false)}
          form={form}
          setForm={setForm}
          handleSave={handleSave}
          submitting={submitting}
          setBarcodeScannerOpen={setBarcodeScannerOpen}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      <BarcodeScanner
        open={barcodeScannerOpen}
        onScan={(code) => {
          setForm({ ...form, barcode: code });
          setBarcodeScannerOpen(false);
        }}
        onClose={() => setBarcodeScannerOpen(false)}
      />

      {importOpen && (
        <ImportCsvModal
          setOpen={() => setImportOpen(false)}
          onImported={() => {
            refetchAll();
            toast("Productos importados correctamente", "success");
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar producto"
        message={`¿Estás seguro de que querés eliminar el producto "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (deleteTarget) remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {selectedMovement && (
        <MovementDetailModal
          movement={selectedMovement}
          onClose={() => setSelectedMovement(null)}
        />
      )}

      <BatchMovementModal
        open={batchModalOpen}
        suppliers={suppliers}
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
