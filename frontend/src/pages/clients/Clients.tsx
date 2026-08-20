import { useEffect, useState } from "react";
import { clientsApi, type CreateClientPayload, type UpdateClientPayload } from "@/api/clients";
import type { Client } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
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
    refresh,
  } = useCrudPagination<Client>({
    fetcher: ({ page, limit, search }) =>
      clientsApi
        .list({ page, limit, search: search || undefined })
        .then((res) => ({ items: res.clients, total: res.total })),
    cacheNamespace: "clients",
    pollMs: 10_000,
    realtimeEvents: ["client.created", "client.updated", "client.deleted"],
  });

  const [editing, setEditing] = useState<Client | null | "new">(null);
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
      cacheClear("clients");
      refresh();
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
      cacheClear("clients");
      refresh();
      toast("Cliente eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      toast((err as Error)?.message || "Error al eliminar cliente", "error");
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} onNew={() => setEditing("new")} loading={loading} />

      <Filter q={q} setSearch={setSearch} />

      <ClientTable
        clients={clients}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(c) => setEditing(c)}
        onDelete={(c) => setDeleteTarget(c.id)}
        dimmed={false}
        refreshing={refreshing}
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
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar cliente"
        message="¿Estás seguro de que querés eliminar este cliente? Esta acción no se puede deshacer."
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
