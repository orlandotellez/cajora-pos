import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { suppliersApi, type CreateSupplierPayload, type UpdateSupplierPayload } from "@/api/suppliers";
import type { Supplier } from "@/api/suppliers";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { SupplierTable } from "@/components/pages/suppliers/SupplierTable";
import styles from "./Suppliers.module.css";

const emptyForm = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function Suppliers() {
  const { toast } = useToast();

  const {
    items: suppliers,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refresh,
  } = useCrudPagination<Supplier>({
    fetcher: ({ page, limit, search }) =>
      suppliersApi
        .list({ page, limit, search: search || undefined })
        .then((res) => ({ items: res.suppliers, total: res.total })),
    cacheNamespace: "suppliers",
  });

  const [editing, setEditing] = useState<Supplier | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isNew = typeof editing === "string";

  useEffect(() => {
    if (!editing) return;
    if (isNew) {
      setForm(emptyForm);
      return;
    }
    setForm({
      name: editing.name,
      contact_name: editing.contact_name ?? "",
      email: editing.email ?? "",
      phone: editing.phone ?? "",
      address: editing.address ?? "",
      notes: editing.notes ?? "",
      is_active: editing.is_active,
    });
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: CreateSupplierPayload = {
        name: form.name,
        contact_name: form.contact_name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        is_active: form.is_active,
      };
      if (isNew) {
        await suppliersApi.create(data);
      } else if (editing) {
        await suppliersApi.update(editing.id, data as UpdateSupplierPayload);
      }
      setEditing(null);
      cacheClear("suppliers");
      refresh();
      toast("Proveedor guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar proveedor:", err);
      toast("Error al guardar proveedor", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    try {
      await suppliersApi.delete(id);
      cacheClear("suppliers");
      refresh();
      toast("Proveedor eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar proveedor:", err);
      toast("Error al eliminar proveedor", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Proveedores</h1>
          <p className={styles.subtitle}>{total} proveedores registrados</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo proveedor
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, contacto o email…"
            className={styles.searchInput}
          />
        </div>
      </div>

      <SupplierTable
        suppliers={suppliers}
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
              <h2 className={styles.modalTitle}>{isNew ? "Nuevo proveedor" : "Editar proveedor"}</h2>
              <button onClick={() => setEditing(null)} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.modalForm}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Persona de contacto</label>
                <input
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles["form-grid"]}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Teléfono</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Dirección</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label className={styles["checkbox-label"]}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Activo
                </label>
              </div>

              <div className={styles["form-actions"]}>
                <button
                  type="submit"
                  className={`${styles.primaryBtn} ${styles["btn-fit"]}`}
                  disabled={submitting}
                >
                  {submitting ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className={styles.secondaryBtn}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar proveedor"
        message="¿Estás seguro de que querés eliminar este proveedor? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (deleteTarget) remove(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
