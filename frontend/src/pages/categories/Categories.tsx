import { useEffect, useState } from "react";
import { categoriesApi, type Category, type CreateCategoryPayload, type UpdateCategoryPayload } from "@/api/categories";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
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

  const {
    items: categories,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refresh,
  } = useCrudPagination<Category>({
    fetcher: ({ page, limit, search }) =>
      categoriesApi
        .listPaginated({ page, limit, search: search || undefined })
        .then((res) => ({ items: res.categories, total: res.total })),
    cacheNamespace: "categories",
    pollMs: 60_000,
  });

  const [editing, setEditing] = useState<Category | null | "new">(null);
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
      cacheClear("categories");
      refresh();
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
      cacheClear("categories");
      refresh();
      toast("Categoría eliminada", "success");
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      toast((err as Error)?.message ?? "Error al eliminar categoría", "error");
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} setEditing={() => setEditing("new")} />

      <Filter q={q} setSearch={(e) => setSearch(e.target.value)} />

      <CategoryTable
        categories={categories}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(c) => setEditing(c)}
        onDelete={(c) => setDeleteTarget(c.id)}
        dimmed={false}
      />

      {editing &&
        <EditCategoryModal
          isNew={isNew}
          setEditing={() => setEditing(null)}
          form={form}
          setForm={setForm}
          submitting={submitting}
          handleSave={handleSave}

        />
      }

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar categoría"
        message="¿Estás seguro de que querés eliminar esta categoría? Los productos asociados no se eliminarán, pero quedarán sin categoría."
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
