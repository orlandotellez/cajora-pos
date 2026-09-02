import { useEffect, useState } from "react";
import { clientsApi, type CreateClientPayload, type UpdateClientPayload } from "@/api/clients";
import type { Client } from "@/api";
import { useCachedCrudList } from "@/hooks/useCachedCrudList";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { useToast } from "@/components/common/ui/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ClientTable } from "@/components/pages/clients/ClientTable";
import { Header } from "@/components/pages/clients/Header";
import { Filter } from "@/components/pages/clients/Filter";
import { EditClientModal } from "@/components/pages/clients/EditClientModal";
import { ClientDetailModal } from "@/components/pages/clients/ClientDetailModal";
import styles from "./Clients.module.css";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function Clients() {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  const {
    items: clients,
    total,
    page,
    q,
    loading,
    refreshing,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
  } = useCachedCrudList<Client>({
    namespace: "clients",
    hydrate: () =>
      fetchAllPages((page, limit) =>
        clientsApi
          .list({ page, limit })
          .then((res) => ({ items: res.clients, total: res.total })),
      ),
    searchFn: (c, query) =>
      c.name.toLowerCase().includes(query) ||
      (c.phone?.toLowerCase().includes(query) ?? false) ||
      (c.email?.toLowerCase().includes(query) ?? false),
    pollMs: 10_000,
    realtimeEvents: ["client.created", "client.updated", "client.deleted"],
  });

  const [editing, setEditing] = useState<Client | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
      phone: editing.phone ?? "",
      email: editing.email ?? "",
      address: editing.address ?? "",
      notes: editing.notes ?? "",
      is_active: editing.is_active,
    });
  }, [editing, isNew]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: CreateClientPayload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        is_active: form.is_active,
      };
      if (isNew) {
        await clientsApi.create(data);
      } else if (editing) {
        await clientsApi.update(editing.id, data as UpdateClientPayload);
      }
      setEditing(null);
      refreshImmediate();
      toast(
        isNew ? "Cliente creado correctamente" : "Cliente actualizado correctamente",
        "success",
      );
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      toast((err as Error)?.message || "Error al guardar cliente", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    try {
      await clientsApi.delete(id);
      refreshImmediate();
      toast("Cliente eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      toast((err as Error)?.message || "Error al eliminar cliente", "error");
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
      await clientsApi.bulkDelete([...selectedIds]);
      refreshImmediate();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Clientes eliminados correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar clientes:", err);
      toast((err as Error)?.message || "Error al eliminar clientes", "error");
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
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "cliente seleccionado" : "clientes seleccionados"}`
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

      <ClientTable
        clients={clients}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(c) => setEditing(c)}
        dimmed={false}
        refreshing={refreshing}
        selectable={editMode && isAdmin}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {editing && (
        <EditClientModal
          isNew={isNew}
          setEditing={() => setEditing(null)}
          handleSave={handleSave}
          form={form}
          setForm={setForm}
          submitting={submitting}
        />
      )}

      {typeof editing === "object" && editing && (
        <ClientDetailModal
          clientId={editing.id}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setEditing(null);
            setDeleteTarget({ id: editing.id, name: editing.name });
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar cliente"
        message={`¿Estás seguro de que querés eliminar al cliente "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (deleteTarget) remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Eliminar clientes"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "cliente" : "clientes"}? Esta acción no se puede deshacer.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
