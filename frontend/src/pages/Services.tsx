import { useEffect, useRef, useState } from "react";
import { Plus, Search, X, Package } from "lucide-react";
import { servicesApi, type CreateServicePayload, type UpdateServicePayload } from "@/api/services";
import { productsApi } from "@/api/products";
import type { Service, Product } from "@/api";
import { money } from "@/lib/format";
import { cacheGet, cacheSet, cacheClear, cacheKey } from "@/lib/simple-cache";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ServiceTable } from "@/components/pages/services/ServiceTable";
import { PAGE_LIMIT as LIMIT } from "@/lib/constants";
import styles from "./Services.module.css";

export default function Services() {
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>(() => {
    const cached = cacheGet<Service[]>(cacheKey("services", 1, ""));
    return cached ?? [];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", base_price: 0 });
  const [selectedProducts, setSelectedProducts] = useState<{ product_id: string; product_name: string; quantity: number }[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNew = typeof editing === "string";

  useEffect(() => {
    productsApi.list({ active: true, limit: 100 })
      .then((res) => setProducts(res.products))
      .catch((err) => console.warn("Error al cargar productos:", err));
  }, []);

  useEffect(() => {
    if (!editing) return;
    if (isNew) { setForm({ name: "", description: "", base_price: 0 }); setSelectedProducts([]); return; }
    setForm({ name: editing.name, description: editing.description ?? "", base_price: editing.base_price });
    setSelectedProducts(editing.products.map(sp => ({ product_id: sp.product_id, product_name: sp.product_name, quantity: sp.quantity })));
  }, [editing]);

  useEffect(() => {
    const key = cacheKey("services", page, q);
    const cached = cacheGet<{ services: Service[]; total: number }>(key);
    if (cached) { setServices(cached.services); setTotal(cached.total); }
    setLoading(!cached);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      servicesApi.list({ page, limit: LIMIT, search: q || undefined })
        .then((res) => {
          setServices(res.services);
          setTotal(res.total);
          cacheSet(key, { services: res.services, total: res.total });
        })
        .catch((err) => console.warn("Error al listar servicios:", err))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [page, q]);

  function handleSearch(value: string) { setQ(value); setPage(1); }

  const addProduct = () => {
    const available = products.filter(p => !selectedProducts.find(sp => sp.product_id === p.id));
    if (available.length === 0) return;
    const first = available[0];
    setSelectedProducts([...selectedProducts, { product_id: first.id, product_name: first.name, quantity: 1 }]);
  };

  const removeProduct = (productId: string) => setSelectedProducts(selectedProducts.filter(sp => sp.product_id !== productId));
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeProduct(productId); return; }
    setSelectedProducts(selectedProducts.map(sp => sp.product_id === productId ? { ...sp, quantity: qty } : sp));
  };

  const changeProduct = (oldId: string, newId: string) => {
    const prod = products.find(p => p.id === newId);
    if (!prod || selectedProducts.find(sp => sp.product_id === newId && sp.product_id !== oldId)) return;
    setSelectedProducts(selectedProducts.map(sp => sp.product_id === oldId ? { ...sp, product_id: prod.id, product_name: prod.name } : sp));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: CreateServicePayload = {
        name: form.name,
        description: form.description || undefined,
        base_price: form.base_price,
        products: selectedProducts.map(sp => ({ product_id: sp.product_id, quantity: sp.quantity })),
      };
      if (isNew) {
        await servicesApi.create(data);
      } else if (editing) {
        await servicesApi.update(editing.id, data as UpdateServicePayload);
      }
      setEditing(null);
      cacheClear("services");
      const res = await servicesApi.list({ page, limit: LIMIT, search: q || undefined });
      setServices(res.services); setTotal(res.total);
      cacheSet(cacheKey("services", page, q), { services: res.services, total: res.total });
      toast("Servicio guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      toast("Error al guardar servicio", "error");
    } finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    try {
      await servicesApi.delete(id);
      cacheClear("services");
      const res = await servicesApi.list({ page, limit: LIMIT, search: q || undefined });
      setServices(res.services); setTotal(res.total);
      cacheSet(cacheKey("services", page, q), { services: res.services, total: res.total });
      toast("Servicio eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar servicio:", err);
      toast("Error al eliminar servicio", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Servicios</h1>
          <p className={styles.subtitle}>{total} servicios en catálogo</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input value={q} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre..." className={styles.searchInput} />
        </div>
      </div>

      <ServiceTable
        services={services}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(s) => setEditing(s)}
        onDelete={(s) => setDeleteTarget(s.id)}
        dimmed={false}
      />

      {editing && (
        <div className={styles.overlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isNew ? "Nuevo servicio" : "Editar servicio"}</h2>
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
                <label className={styles.fieldLabel}>Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={styles.textarea} rows={3} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Precio base *</label>
                <input type="number" step="0.01" min="0" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })} className={styles.input} required />
              </div>

              <div className={styles.field}>
                <div className={styles["products-header"]}>
                  <label className={styles.fieldLabel}>Productos asociados</label>
                  <button type="button" onClick={addProduct} className={styles["add-product-btn"]}>
                    <Plus size={12} /> Agregar
                  </button>
                </div>
                {selectedProducts.length === 0 ? (
                  <div className={styles["no-products"]}>
                    <Package size={20} />
                    <span className={styles["no-products-text"]}>Sin productos asociados</span>
                  </div>
                ) : (
                  <div className={styles["products-list"]}>
                    {selectedProducts.map(sp => (
                      <div key={sp.product_id} className={styles["product-row"]}>
                        <select value={sp.product_id} onChange={e => changeProduct(sp.product_id, e.target.value)} className={styles["product-select"]}>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}
                        </select>
                        <input type="number" min="1" value={sp.quantity} onChange={e => updateQty(sp.product_id, Number(e.target.value))} className={styles["product-qty"]} />
                        <button type="button" onClick={() => removeProduct(sp.product_id)} className={styles["product-remove"]}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles["form-actions"]}>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar servicio"
        message="¿Estás seguro de que querés eliminar este servicio? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (deleteTarget) remove(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
