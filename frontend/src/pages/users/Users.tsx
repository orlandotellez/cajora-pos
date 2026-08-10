import { useEffect, useState } from "react";
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from "@/api/users";
import type { UserResponse } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { UserTable } from "@/components/pages/users/UserTable";
import { EditUserModal } from "@/components/pages/users/EditUserModal";
import { Header } from "@/components/pages/users/Header";
import { Filter } from "@/components/pages/users/Filter";
import styles from "./Users.module.css";

const emptyForm = { name: "", email: "", password: "", role: "cajero" as string, phone: "" };

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
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
  } = useCrudPagination<UserResponse>({
    fetcher: ({ page, limit, search }) =>
      usersApi
        .list({ page, limit, search: search || undefined })
        .then((res) => ({ items: res.users, total: res.total })),
    pollMs: 60_000,
  });

  const [editing, setEditing] = useState<UserResponse | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isNew = typeof editing === "string";

  useEffect(() => {
    if (!editing) return;
    if (isNew) { setForm(emptyForm); return; }
    setForm({ name: editing.name, email: editing.email, password: "", role: editing.role, phone: editing.phone ?? "" });
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
          phone: form.phone || undefined,
        };
        await usersApi.create(payload);
      } else if (editing) {
        const payload: UpdateUserPayload = {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role as "admin" | "cajero",
        };
        await usersApi.update(editing.id, payload);
      }
      setEditing(null);
      refreshImmediate();
      toast("Usuario guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      toast("Error al guardar usuario", "error");
    } finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    try {
      await usersApi.delete(id);
      refreshImmediate();
      toast("Usuario eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      toast("Error al eliminar usuario", "error");
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} onNew={() => setEditing("new")} />

      <Filter q={q} setSearch={setSearch} />

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
        dimmed={false}
      />

      {editing &&
        <EditUserModal
          isNew={isNew}
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
    </div>
  );
}
