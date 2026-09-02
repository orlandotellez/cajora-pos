import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { productsApi, type CreateProductPayload } from "@/api/products";
import { categoriesApi } from "@/api/categories";
import { suppliersApi } from "@/api/suppliers";
import type { Product, Category, Supplier } from "@/api";
import { useCachedCrudList } from "@/hooks/useCachedCrudList";
import { fetchAllPages, fetchFirstPage, fetchPageFrom } from "@/lib/fetch-all-pages";
import { useToast } from "@/components/common/ui/Toast";
import { usePosStore } from "@/store/posStore";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ProductTable } from "@/components/pages/products/ProductTable";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import styles from "./Products.module.css";
import { Header } from "@/components/pages/products/Header";
import { Filter } from "@/components/pages/products/Filter";
import { EditProductModal } from "@/components/pages/products/EditProductModal";
import { ProductDetailModal } from "@/components/pages/products/ProductDetailModal";
import { ImportCsvModal } from "@/components/pages/products/ImportCsvModal";

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

export default function Products() {
  const { toast } = useToast();
  const addToCart = usePosStore((s) => s.addToCart);
  const { has, isAdmin } = usePermissions();
  const canWrite = has("catalog_write");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllDeleting, setDeleteAllDeleting] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [unitType, setUnitType] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    items: products,
    total,
    page,
    q,
    loading,
    refreshing,
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
    // Primera carga ágil: mostramos al instante los primeros 50 productos y
    // rellenamos el resto en background de a 50. Así la página se siente rápida
    // con 500+ productos mientras el usuario ya interactúa con las primeras filas.
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
    searchFn: (p, query) =>
      p.name.toLowerCase().includes(query) ||
      (p.barcode?.toLowerCase().includes(query) ?? false) ||
      (p.category?.name.toLowerCase().includes(query) ?? false),
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

  // Cargar categorías y proveedores una vez para los dropdowns del modal.
  // Separado del hook porque son fetches one-shot (no se re-piden con
  // cada cambio de search/page).
  useEffect(() => {
    if (categories.length === 0) {
      categoriesApi.list().then(setCategories).catch(() => { });
    }
    if (suppliers.length === 0) {
      suppliersApi.list().then((res) => setSuppliers(res.suppliers)).catch(() => { });
    }
  }, [categories.length, suppliers.length]);

  // Sincronizar filtros externos con el hook caché cada vez que cambian.
  useEffect(() => {
    setExternalFilters({ categoryId, unitType });
  }, [categoryId, unitType, setExternalFilters]);

  function openCreate() {
    setForm(emptyForm);
    setEditing("new");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Los ids vacíos van como `undefined` (el server los ignora).
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
      setEditing(null);
      refreshImmediate();
      toast("Producto guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar producto:", err);
      toast((err as Error)?.message || "Error al guardar producto", "error");
    } finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    try {
      await productsApi.delete(id);
      refreshImmediate();
      toast("Producto eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      toast((err as Error)?.message || "Error al eliminar producto", "error");
    }
  }

  function toggleEditMode() {
    setEditMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await productsApi.bulkDelete([...selectedIds]);
      refreshImmediate();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Productos eliminados correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar productos:", err);
      toast((err as Error)?.message || "Error al eliminar productos", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDeleteAll() {
    setDeleteAllDeleting(true);
    try {
      const result = await productsApi.bulkDeleteAll({
        ...(q ? { search: q } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
      });
      refreshImmediate();
      setEditMode(false);
      setSelectedIds(new Set());
      setDeleteAllConfirm(false);
      toast(`Se eliminaron ${result.deleted} productos`, "success");
    } catch (err) {
      console.error("Error al eliminar productos:", err);
      toast((err as Error)?.message || "Error al eliminar productos", "error");
    } finally {
      setDeleteAllDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} setEditing={openCreate} loading={loading} showCreateButton={canWrite} onImport={canWrite ? () => setImportOpen(true) : undefined} showEditMode={isAdmin} editMode={editMode} onToggleEditMode={toggleEditMode} />

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

      {editMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size > 0
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "producto seleccionado" : "productos seleccionados"}`
              : `Modo edición activo`}
          </span>
          <div className={styles.bulkActions}>
            <button
              className={styles.bulkDeleteAllBtn}
              onClick={() => setDeleteAllConfirm(true)}
              disabled={deleteAllDeleting}
              title="Elimina todos los productos del catálogo actual (respeta el filtro aplicado)"
            >
              <Trash2 size={14} /> Eliminar todos ({total})
            </button>
            {selectedIds.size > 0 && (
              <button
                className={styles.bulkDeleteBtn}
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={bulkDeleting}
              >
                <Trash2 size={14} /> Eliminar {selectedIds.size}
              </button>
            )}
          </div>
        </div>
      )}

      <ProductTable
        products={products}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(p) => setEditing(p)}
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
        dimmed={false}
        refreshing={refreshing}
        selectable={editMode && isAdmin}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {editing === "new" && (
        <EditProductModal
          setEditing={() => setEditing(null)}
          form={form}
          setForm={setForm}
          handleSave={handleSave}
          submitting={submitting}
          setBarcodeScannerOpen={setBarcodeScannerOpen}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      {typeof editing === "object" && editing && (
        <ProductDetailModal
          product={editing}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refreshImmediate();
          }}
          onDelete={canWrite ? (p) => {
            setEditing(null);
            setDeleteTarget({ id: p.id, name: p.name });
          } : undefined}
          readOnly={!canWrite}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar producto"
        message={`¿Estás seguro de que querés eliminar el producto "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (deleteTarget) remove(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Eliminar productos"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "producto" : "productos"}? Esta acción no se puede deshacer.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />

      <ConfirmDialog
        open={deleteAllConfirm}
        title="Eliminar todos los productos"
        message={`¿Estás seguro de que querés eliminar los ${total} productos${q ? ` que coinciden con "${q}"` : ""}? Esta acción no se puede deshacer.`}
        confirmLabel={deleteAllDeleting ? "Eliminando…" : "Sí, eliminar todos"}
        cancelLabel="Cancelar"
        onConfirm={() => handleDeleteAll()}
        onCancel={() => { if (!deleteAllDeleting) setDeleteAllConfirm(false); }}
      />

      {importOpen && (
        <ImportCsvModal
          setOpen={() => setImportOpen(false)}
          onImported={() => {
            refreshImmediate();
            toast("Productos importados correctamente", "success");
          }}
        />
      )}
    </div>
  );
}
