import { useEffect, useRef, useState } from "react";
import { Plus, Search, X, Camera } from "lucide-react";
import { productsApi, type CreateProductPayload } from "@/api/products";
import { categoriesApi } from "@/api/categories";
import { suppliersApi } from "@/api/suppliers";
import type { Product, Category, Supplier } from "@/api";
import { cacheGet, cacheSet, cacheClear, cacheKey } from "@/lib/simple-cache";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ProductTable } from "@/components/pages/products/ProductTable";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import { PAGE_LIMIT as LIMIT } from "@/lib/constants";
import styles from "./Products.module.css";


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

  const [products, setProducts] = useState<Product[]>(() => {
    const cached = cacheGet<Product[]>(cacheKey("products", 1, ""));
    return cached ?? [];
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNew = typeof editing === "string";


  useEffect(() => {
    if (!editing) return;
    if (isNew) { setForm(emptyForm); return; }
    setForm({
      name: editing.name,
      barcode: editing.barcode ?? "",
      unit_type: editing.unit_type ?? "",
      unit_quantity: editing.unit_quantity ?? 0,
      category_id: editing.category?.id ?? "",
      supplier_id: editing.supplier?.id ?? "",
      price: editing.price,
      cost: editing.cost,
      stock: editing.stock,
      low_stock_threshold: editing.low_stock_threshold,
    });
  }, [editing]);

  useEffect(() => {
    const key = cacheKey("products", page, q, categoryId);
    const cached = cacheGet<{ products: Product[]; total: number }>(key);
    if (cached) {
      setProducts(cached.products);
      setTotal(cached.total);
      // Si hay caché, igual cargamos categorías y proveedores una vez
      if (categories.length === 0) {
        categoriesApi.list().then(setCategories).catch(() => { });
        suppliersApi.list().then(res => setSuppliers(res.suppliers)).catch(() => { });
      }
      setLoading(false);
      return;
    }
    setLoading(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const [productsRes, cats, sups] = await Promise.all([
          productsApi.list({ page, limit: LIMIT, search: q || undefined, category_id: categoryId || undefined }),
          categories.length === 0 ? categoriesApi.list() : Promise.resolve(undefined),
          suppliers.length === 0 ? suppliersApi.list() : Promise.resolve(undefined),
        ]);

        setProducts(productsRes.products);
        setTotal(productsRes.total);
        if (cats) setCategories(cats);
        if (sups) setSuppliers(sups.suppliers);
        cacheSet(key, { products: productsRes.products, total: productsRes.total });
      } catch (err) {
        console.warn("Error al cargar datos:", err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [page, q, categoryId]);

  function handleSearch(value: string) { setQ(value); setPage(1); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // En creación los ids vacíos van como `undefined` (el server los ignora).
      // En edición los ids vacíos van como `null` (el server los desenlaza).
      const emptyToNull = !isNew;
      const valueOr = (v: string) => v || (emptyToNull ? null : undefined);

      const data: CreateProductPayload = {
        name: form.name,
        barcode: form.barcode || undefined,
        unit_type: form.unit_type || undefined,
        unit_quantity: form.unit_quantity || undefined,
        category_id: valueOr(form.category_id),
        supplier_id: valueOr(form.supplier_id),
        price: form.price,
        cost: form.cost || undefined,
        stock: form.stock,
        low_stock_threshold: form.low_stock_threshold,
      };

      if (isNew) {
        await productsApi.create(data);
      } else if (editing) {
        await productsApi.update(editing.id, data);
      }
      setEditing(null);
      cacheClear("products");
      const res = await productsApi.list({ page, limit: LIMIT, search: q || undefined, category_id: categoryId || undefined });
      setProducts(res.products); setTotal(res.total);
      cacheSet(cacheKey("products", page, q, categoryId), { products: res.products, total: res.total });
      toast("Producto guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar producto:", err);
      toast("Error al guardar producto", "error");
    } finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    try {
      await productsApi.delete(id);
      cacheClear("products");
      const res = await productsApi.list({ page, limit: LIMIT, search: q || undefined, category_id: categoryId || undefined });
      setProducts(res.products); setTotal(res.total);
      cacheSet(cacheKey("products", page, q, categoryId), { products: res.products, total: res.total });
      toast("Producto eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      toast("Error al eliminar producto", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Productos</h1>
          <p className={styles.subtitle}>{total} productos en catálogo</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input value={q} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre, código o categoría" className={styles.searchInput} />
        </div>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={styles.filterSelect}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

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
      />

      {editing && (
        <div className={styles.overlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isNew ? "Nuevo producto" : "Editar producto"}</h2>
              <button onClick={() => setEditing(null)} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.modalForm}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={styles.input} required />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Código de barras</label>
                <div className={styles["barcode-wrapper"]}>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={styles["barcode-input"]} placeholder="Escanear o escribir" />
                  <button
                    type="button"
                    onClick={() => setBarcodeScannerOpen(true)}
                    className={styles["barcode-scan-btn"]}
                    title="Escanear código de barras"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              </div>
              <div className={styles["form-grid"]}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Tipo de empaque</label>
                  <select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} className={styles.select}>
                    <option value="">Sin empaque</option>
                    {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Cant. x empaque</label>
                  <input type="number" min="0" value={form.unit_quantity} onChange={(e) => setForm({ ...form, unit_quantity: Number(e.target.value) })} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Categoría</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={styles.select}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Proveedor</label>
                  <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={styles.select}>
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles["form-grid"]}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Precio venta</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Costo</label>
                  <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Alerta stock bajo</label>
                  <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} className={styles.input} />
                </div>
              </div>
              <div className={styles["form-actions"]}>
                <button type="submit" className={`${styles.primaryBtn} ${styles["btn-fit"]}`} disabled={submitting}>
                  {submitting ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setEditing(null)} className={styles.secondaryBtn}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
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
