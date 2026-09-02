import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { categoriesApi, type Category, type CreateCategoryPayload, type UpdateCategoryPayload } from "@/api/categories";
import { useCachedCrudList } from "@/hooks/useCachedCrudList";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { CategoryTable } from "@/components/pages/categories/CategoryTable";
import styles from "./Categories.module.css";
import { Header } from "@/components/pages/categories/Header";
import { Filter } from "@/components/pages/categories/Filter";
import { EditCategoryModal } from "@/components/pages/categories/EditCategoryModal";

const emptyForm = { name: "", description: "" };

export default function Categories() {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  const {
    items: categories,
    total,
    page,
    q,
    loading,
    refreshing,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
  } = useCachedCrudList<Category>({
    namespace: "categories",
    hydrate: () =>
      fetchAllPages((page, limit) =>
        categoriesApi
          .listPaginated({ page, limit })
          .then((res) => ({ items: res.categories, total: res.total })),
      ),
    searchFn: (c, query) =>
      c.name.toLowerCase().includes(query) ||
      (c.description?.toLowerCase().includes(query) ?? false),
    pollMs: 10_000,
    realtimeEvents: ["category.created", "category.updated", "category.deleted"],
  });

  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
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
    setForm({ name: editing.name, description: editing.description ?? "" });
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: CreateCategoryPayload = {
        name: form.name,
        description: form.description || undefined,
      };
      if (isNew) {
        await categoriesApi.create(data);
      } else if (editing) {
        await categoriesApi.update(editing.id, data as UpdateCategoryPayload);
      }
      setEditing(null);
      refreshImmediate();
      toast(
        isNew ? "Categoría creada correctamente" : "Categoría actualizada correctamente",
        "success",
      );
    } catch (err) {
      console.error("Error al guardar categoría:", err);
      toast((err as Error)?.message ?? "Error al guardar categoría", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    try {
      await categoriesApi.delete(id);
      refreshImmediate();
      toast("Categoría eliminada", "success");
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      toast((err as Error)?.message ?? "Error al eliminar categoría", "error");
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
      await categoriesApi.bulkDelete([...selectedIds]);
      refreshImmediate();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Categorías eliminadas correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar categorías:", err);
      toast((err as Error)?.message || "Error al eliminar categorías", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header
        total={total}
        setEditing={() => setEditing("new")}
        loading={loading}
        showEditMode={isAdmin}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
      />

      <Filter q={q} setSearch={(e) => setSearch(e.target.value)} />

      {editMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size > 0
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "categoría seleccionada" : "categorías seleccionadas"}`
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

      <CategoryTable
        categories={categories}
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

      {editing &&
        <EditCategoryModal
          isNew={isNew}
          setEditing={() => setEditing(null)}
          form={form}
          setForm={setForm}
          submitting={submitting}
          handleSave={handleSave}
          onDelete={() => {
            if (typeof editing !== "object" || !editing) return;
            setEditing(null);
            setDeleteTarget({ id: editing.id, name: editing.name });
          }}
        />
      }

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar categoría"
        message={`¿Estás seguro de que querés eliminar la categoría "${deleteTarget?.name}"? Los productos asociados no se eliminarán, pero quedarán sin categoría.`}
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
        title="Eliminar categorías"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "categoría" : "categorías"}? Los productos asociados no se eliminarán, pero quedarán sin categoría.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
