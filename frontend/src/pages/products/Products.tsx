import { useEffect, useState } from "react";
import { productsApi, type CreateProductPayload } from "@/api/products";
import { categoriesApi } from "@/api/categories";
import { suppliersApi } from "@/api/suppliers";
import type { Product, Category, Supplier } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ProductTable } from "@/components/pages/products/ProductTable";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import styles from "./Products.module.css";
import { Header } from "@/components/pages/products/Header";
import { Filter } from "@/components/pages/products/Filter";
import { EditProductModal } from "@/components/pages/products/EditProductModal";
import { ProductDetailModal } from "@/components/pages/products/ProductDetailModal";

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
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

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
  } = useCrudPagination<Product>({
    fetcher: ({ page, limit, search, extraFilters }) =>
      productsApi
        .list({
          page,
          limit,
          search: search || undefined,
          category_id: extraFilters.categoryId || undefined,
        })
        .then((res) => ({ items: res.products, total: res.total })),
    cacheNamespace: "products",
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
    extraFilters: { categoryId },
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
      cacheClear("products");
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
      cacheClear("products");
      refreshImmediate();
      toast("Producto eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      toast((err as Error)?.message || "Error al eliminar producto", "error");
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} setEditing={openCreate} loading={loading} />

      <Filter
        q={q}
        setSearch={setSearch}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        setPage={setPage}
        categories={categories}
      />

      <ProductTable
        products={products}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(p) => setEditing(p)}
        onDelete={(p) => setDeleteTarget(p.id)}
        dimmed={false}
        refreshing={refreshing}
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
            cacheClear("products");
            refreshImmediate();
          }}
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
        message="¿Estás seguro de que querés eliminar este producto? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (deleteTarget) remove(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
