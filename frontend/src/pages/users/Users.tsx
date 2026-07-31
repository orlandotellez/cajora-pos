import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from "@/api/users";
import type { UserResponse } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { UserTable } from "@/components/pages/users/UserTable";
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
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Usuarios</h1>
          <p className={styles.subtitle}>{total} usuario(s) en el sistema</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input value={q} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email…" className={styles.searchInput} />
        </div>
      </div>

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

      {editing && (
        <div className={styles.overlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isNew ? "Nuevo usuario" : "Editar usuario"}</h2>
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
                <label className={styles.fieldLabel}>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={styles.input} required />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Contraseña {isNew && <span className={styles["required-star"]}>*</span>}
                  {!isNew && <span className={styles["password-hint"]}>(dejar vacío para mantener)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={styles.input} required={isNew} minLength={isNew ? 8 : undefined} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={styles.select}>
                  <option value="cajero">Cajero</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={styles.input} />
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
