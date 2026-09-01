import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { suppliersApi, type CreateSupplierPayload, type UpdateSupplierPayload } from "@/api/suppliers";
import type { Supplier } from "@/api/suppliers";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { SupplierTable } from "@/components/pages/suppliers/SupplierTable";
import { Header } from "@/components/pages/suppliers/Header";
import { Filter } from "@/components/pages/suppliers/Filter";
import { EditSupplierModal } from "@/components/pages/suppliers/EditSupplierModal";
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
  const { isAdmin } = usePermissions();

  const {
    items: suppliers,
    total,
    page,
    q,
    loading,
    refreshing,
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
    pollMs: 10_000,
    realtimeEvents: ["supplier.created", "supplier.updated", "supplier.deleted"],
  });

  const [editing, setEditing] = useState<Supplier | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
      toast((err as Error)?.message || "Error al guardar proveedor", "error");
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
      toast((err as Error)?.message || "Error al eliminar proveedor", "error");
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
      await suppliersApi.bulkDelete([...selectedIds]);
      cacheClear("suppliers");
      refresh();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Proveedores eliminados correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar proveedores:", err);
      toast((err as Error)?.message || "Error al eliminar proveedores", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header
        total={total}
        onNew={() => setEditing("new")}
        loading={loading}
        showEditMode={isAdmin}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
      />

      <Filter q={q} setSearch={setSearch} />

      {editMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size > 0
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "proveedor seleccionado" : "proveedores seleccionados"}`
              : `Modo edición activo`}
          </span>
          {selectedIds.size > 0 && (
            <div className={styles.bulkActions}>
              <button
                className={styles.bulkDeleteBtn}
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={bulkDeleting}
              >
                Eliminar {selectedIds.size}
              </button>
            </div>
          )}
        </div>
      )}

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
        refreshing={refreshing}
        selectable={editMode && isAdmin}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {editing && (
        <EditSupplierModal
          isNew={isNew}
          setEditing={() => setEditing(null)}
          handleSave={handleSave}
          form={form}
          setForm={setForm}
          submitting={submitting}
        />
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

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Eliminar proveedores"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "proveedor" : "proveedores"}? Esta acción no se puede deshacer.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
