import { useEffect, useRef, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { productsApi, type Product } from "@/api/products";
import { categoriesApi, type Category } from "@/api/categories";
import { inventoryApi, type InventoryMovement, type LowStockProduct, type BatchResponse } from "@/api/inventory";
import { cacheGet, cacheSet, cacheClear, cacheKey } from "@/lib/simple-cache";
import { suppliersApi } from "@/api/suppliers";
import type { Supplier } from "@/api";
import { InventoryTable } from "@/components/pages/inventory/InventoryTable";
import { AdjustStockModal } from "@/components/pages/inventory/AdjustStockModal";
import { MovementDetailModal } from "@/components/pages/inventory/MovementDetailModal";
import { BatchMovementModal } from "@/components/pages/inventory/BatchMovementModal";
import { BatchDetailModal } from "@/components/pages/inventory/BatchDetailModal";
import { MovementHistoryTable } from "@/components/pages/inventory/MovementHistoryTable";
import { BatchHistoryTable } from "@/components/pages/inventory/BatchHistoryTable";
import styles from "./Inventory.module.css";

const LIMIT = 10;

type AdjustState = { id: string; name: string; stock: number } | null;

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = cacheGet<{ products: Product[]; total: number; lowStock: LowStockProduct[] }>(
      cacheKey("inventory", 1, "", "")
    );
    return cached?.products ?? [];
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">("");
  const [q, setQ] = useState("");
  const searchRef = useRef(q);
  searchRef.current = q;
  const [adjust, setAdjust] = useState<AdjustState>(null);
  const [refreshKey, setRefreshKey] = useState(0);


  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const MOVEMENT_LIMIT = 10;


  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [batchPage, setBatchPage] = useState(1);
  const [batchDetail, setBatchDetail] = useState<BatchResponse | null>(null);
  const BATCH_LIMIT = 10;

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const movementsTotalPages = Math.max(1, Math.ceil(movementsTotal / MOVEMENT_LIMIT));
  const batchesTotalPages = Math.max(1, Math.ceil(batchesTotal / BATCH_LIMIT));

  useEffect(() => {
    const key = cacheKey("inventory", page, q, categoryId, stockFilter);
    const cached = cacheGet<{ products: Product[]; total: number; lowStock: LowStockProduct[] }>(key);

    if (cached) {
      setProducts(cached.products);
      setTotal(cached.total);
      setLowStockProducts(cached.lowStock);
      setLoading(false);
      // Si hay caché pero faltan categorías/proveedores, cargarlos en background
      if (categories.length === 0) {
        categoriesApi.list().then(setCategories).catch(() => { });
        suppliersApi.list().then(res => setSuppliers(res.suppliers)).catch(() => { });
      }
      return;
    }

    setLoading(!cached);

    const timer = setTimeout(async () => {

      try {
        const [productRes, lowStockRes, cats, sups] = await Promise.all([
          productsApi.list({
            page,
            limit: LIMIT,
            active: true,
            search: q || undefined,
            category_id: categoryId || undefined,
            low_stock: stockFilter === "low" || undefined,
            out_of_stock: stockFilter === "out" || undefined,
          }),
          inventoryApi.lowStock(),
          categories.length === 0 ? categoriesApi.list() : Promise.resolve(undefined),
          suppliers.length === 0 ? suppliersApi.list() : Promise.resolve(undefined),
        ]);
        setProducts(productRes.products);
        setTotal(productRes.total);
        setLowStockProducts(lowStockRes.products);
        if (cats) setCategories(cats);
        if (sups) setSuppliers(sups.suppliers);
        cacheSet(key, { products: productRes.products, total: productRes.total, lowStock: lowStockRes.products });
      } catch (err) {
        console.warn("Error al cargar inventario:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [page, q, categoryId, stockFilter, refreshKey]);

  useEffect(() => {
    const key = cacheKey("inventory-movements", movementPage);
    const cached = cacheGet<{ movements: InventoryMovement[]; total: number }>(key);
    if (cached) { setMovements(cached.movements); setMovementsTotal(cached.total); return; }

    inventoryApi.list({ page: movementPage, limit: MOVEMENT_LIMIT }).then((res) => {
      setMovements(res.movements);
      setMovementsTotal(res.total);
      cacheSet(key, { movements: res.movements, total: res.total });
    }).catch((err) => console.warn("Error al cargar movimientos:", err));
  }, [movementPage, refreshKey]);

  useEffect(() => {
    const key = cacheKey("inventory-batches", batchPage);
    const cached = cacheGet<{ batches: BatchResponse[]; total: number }>(key);
    if (cached) { setBatches(cached.batches); setBatchesTotal(cached.total); return; }

    inventoryApi.batchList({ page: batchPage, limit: BATCH_LIMIT }).then((res) => {
      setBatches(res.batches);
      setBatchesTotal(res.total);
      cacheSet(key, { batches: res.batches, total: res.total });
    }).catch((err) => console.warn("Error al cargar lotes:", err));
  }, [batchPage, refreshKey]);

  async function openBatchDetail(batch: BatchResponse) {
    try {
      const detail = await inventoryApi.batchGetById(batch.id);
      setBatchDetail(detail);
    } catch (err) {
      console.error("Error al cargar detalle", err);
    }
  }

  function handleAdjustApplied() {
    cacheClear("inventory");
    setRefreshKey((k) => k + 1);
  }

  function handleBatchCreated() {
    cacheClear("inventory");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.h1}>Inventario</h1>
            <p className={styles.subtitle}>Control de stock en tiempo real</p>
          </div>
          <button onClick={() => setBatchModalOpen(true)} className={styles.primaryBtnSmall}>
            Nuevo movimiento agrupado
          </button>
        </div>
      </header>

      {lowStockProducts.length > 0 && (
        <div className={styles.alert}>
          <AlertTriangle size={16} className={styles.alertIcon} />
          <div>
            <div className={styles.alertTitle}>{lowStockProducts.length} producto(s) con stock bajo</div>
            <div className={styles.alertDesc}>
              {lowStockProducts.slice(0, 5).map((p) => p.product_name).join(", ")}
              {lowStockProducts.length > 5 ? "…" : ""}
            </div>
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar producto…"
            className={styles.searchInput}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className={styles.filterSelect}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className={styles.stockFilters}>
          <button
            onClick={() => { setStockFilter(stockFilter === "low" ? "" : "low"); setPage(1); }}
            className={`${styles.stockFilterBtn} ${stockFilter === "low" ? styles.stockFilterActive : ""}`}
          >
            Stock bajo
          </button>
          <button
            onClick={() => { setStockFilter(stockFilter === "out" ? "" : "out"); setPage(1); }}
            className={`${styles.stockFilterBtn} ${stockFilter === "out" ? styles.stockFilterActive : ""}`}
          >
            Sin stock
          </button>
        </div>
      </div>

      <InventoryTable
        products={products}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onAdjust={setAdjust}
        dimmed={loading}
      />

      {}
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
