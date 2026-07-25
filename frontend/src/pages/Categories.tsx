import { useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { categoriesApi, type Category, type CreateCategoryPayload, type UpdateCategoryPayload } from "@/api/categories";
import { cacheGet, cacheSet, cacheClear, cacheKey } from "@/lib/simple-cache";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { CategoryTable } from "@/components/pages/categories/CategoryTable";
import { PAGE_LIMIT as LIMIT } from "@/lib/constants";
import styles from "./Categories.module.css";

const emptyForm = { name: "", description: "" };

export default function Categories() {
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = cacheGet<Category[]>(cacheKey("categories", 1, ""));
    return cached ?? [];
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNew = typeof editing === "string";

  useEffect(() => {
    if (!editing) return;
    if (isNew) {
      setForm(emptyForm);
      return;
    }
    setForm({ name: editing.name, description: editing.description ?? "" });
  }, [editing]);

  useEffect(() => {
    const key = cacheKey("categories", page, q);
    const cached = cacheGet<{ categories: Category[]; total: number }>(key);
    if (cached) {
      setCategories(cached.categories);
      setTotal(cached.total);
    }
    setLoading(!cached);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      categoriesApi
        .listPaginated({ page, limit: LIMIT, search: q || undefined })
        .then((res) => {
          setCategories(res.categories);
          setTotal(res.total);
          cacheSet(key, { categories: res.categories, total: res.total });
        })
        .catch((err) => console.warn("Error al listar categorías:", err))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [page, q]);

  function handleSearch(value: string) {
    setQ(value);
    setPage(1);
  }

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
      // También limpiamos el cache de products porque el dropdown reusa listPaginated no, pero list sí
      const res = await categoriesApi.listPaginated({ page, limit: LIMIT, search: q || undefined });
      setCategories(res.categories);
      setTotal(res.total);
      cacheSet(cacheKey("categories", page, q), { categories: res.categories, total: res.total });
      toast(isNew ? "Categoría creada correctamente" : "Categoría actualizada correctamente", "success");
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
      const res = await categoriesApi.listPaginated({ page, limit: LIMIT, search: q || undefined });
      setCategories(res.categories);
      setTotal(res.total);
      cacheSet(cacheKey("categories", page, q), { categories: res.categories, total: res.total });
      toast("Categoría eliminada", "success");
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      toast((err as Error)?.message ?? "Error al eliminar categoría", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Categorías</h1>
          <p className={styles.subtitle}>{total} categorías registradas</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nueva categoría
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            className={styles.searchInput}
          />
        </div>
      </div>

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

      {editing && (
        <div className={styles.overlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isNew ? "Nueva categoría" : "Editar categoría"}</h2>
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
                <label className={styles.fieldLabel}>Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={styles.textarea}
                  rows={3}
                />
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
