import { useEffect, useState } from "react";
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from "@/api/users";
import type { UserResponse } from "@/api";
import type { Permission } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useCachedCrudList } from "@/hooks/useCachedCrudList";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { UserTable } from "@/components/pages/users/UserTable";
import { EditUserModal } from "@/components/pages/users/EditUserModal";
import { Header } from "@/components/pages/users/Header";
import { Filter } from "@/components/pages/users/Filter";
import styles from "./Users.module.css";

const emptyForm = { name: "", email: "", password: "", role: "cajero" as string, phone: "", permissions: [] as Permission[], is_active: true };

export default function Users() {
  const { user: currentUser } = useAuth();
  useAdminGuard();
  const { toast } = useToast();

  const {
    items: users,
    total,
    page,
    q,
    loading,
    refreshing,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
  } = useCachedCrudList<UserResponse>({
    namespace: "users",
    hydrate: () =>
      fetchAllPages((page, limit) =>
        usersApi
          .list({ page, limit })
          .then((res) => ({ items: res.users, total: res.total })),
      ),
    searchFn: (u, query) =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.phone?.toLowerCase().includes(query) ?? false),
    pollMs: 10_000,
    realtimeEvents: ["user.created", "user.updated", "user.deleted"],
  });

  const [editing, setEditing] = useState<UserResponse | null | "new">(null);
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
    if (isNew) { setForm(emptyForm); return; }
    setForm({ name: editing.name, email: editing.email, password: "", role: editing.role, phone: editing.phone ?? "", permissions: editing.permissions ?? [], is_active: editing.is_active });
  }, [editing, isNew]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isNew) {
        const payload: CreateUserPayload = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role as "admin" | "cajero",
          permissions: form.role === "cajero" ? form.permissions : undefined,
          phone: form.phone || undefined,
        };
        await usersApi.create(payload);
      } else if (editing) {
        const payload: UpdateUserPayload = {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role as "admin" | "cajero",
          permissions: form.role === "cajero" ? form.permissions : undefined,
        };
        await usersApi.update(editing.id, payload);
        // Si el estado cambió, llamamos al endpoint dedicado
        if (editing.is_active !== form.is_active) {
          await usersApi.toggleActive(editing.id, form.is_active);
        }
      }
      setEditing(null);
      refreshImmediate();
      toast("Usuario guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      toast((err as Error)?.message || "Error al guardar usuario", "error");
    } finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    try {
      await usersApi.delete(id);
      refreshImmediate();
      toast("Usuario eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      toast((err as Error)?.message || "Error al eliminar usuario", "error");
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
      await usersApi.bulkDelete([...selectedIds]);
      refreshImmediate();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Usuarios eliminados correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar usuarios:", err);
      toast((err as Error)?.message || "Error al eliminar usuarios", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleToggleActive(u: UserResponse) {
    try {
      const newStatus = !u.is_active;
      await usersApi.toggleActive(u.id, newStatus);
      refreshImmediate();
      toast(
        newStatus ? `${u.name} activado` : `${u.name} desactivado`,
        "success",
      );
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      toast((err as Error)?.message || "Error al cambiar estado del usuario", "error");
    }
  }

  return (
    <div className={styles.page}>
      <Header
        total={total}
        onNew={() => setEditing("new")}
        loading={loading}
        showEditMode={true}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
      />

      <Filter q={q} setSearch={setSearch} />

      {editMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size > 0
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "usuario seleccionado" : "usuarios seleccionados"}`
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

      <UserTable
        users={users}
        currentUserId={currentUser?.id}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(u) => setEditing(u)}
        onDelete={(u) => setDeleteTarget(u.id)}
        onToggleActive={handleToggleActive}
        dimmed={false}
        refreshing={refreshing}
        selectable={editMode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {editing &&
        <EditUserModal
          isNew={isNew}
          isOwner={typeof editing === "object" && editing?.is_owner}
          setEditing={() => setEditing(null)}
          handleSave={handleSave}
          form={form}
          setForm={setForm}
          submitting={submitting}
        />
      }

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar usuario"
        message="¿Estás seguro de que querés eliminar este usuario? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (deleteTarget) remove(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Eliminar usuarios"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "usuario" : "usuarios"}? Esta acción no se puede deshacer.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
