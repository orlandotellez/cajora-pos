import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { servicesApi, type CreateServicePayload } from "@/api/services";
import { productsApi } from "@/api/products";
import type { Service, Product } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ServiceTable } from "@/components/pages/services/ServiceTable";
import { ServiceFormModal } from "@/components/services/ServiceFormModal";
import styles from "./Services.module.css";

export default function Services() {
  const { toast } = useToast();

  const {
    items: services,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refresh,
  } = useCrudPagination<Service>({
    fetcher: ({ page, limit, search }) =>
      servicesApi
        .list({ page, limit, search: search || undefined })
        .then((res) => ({ items: res.services, total: res.total })),
    cacheNamespace: "services",
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    productsApi
      .list({ active: true, limit: 100 })
      .then((res) => setProducts(res.products))
      .catch((err) => console.warn("Error al cargar productos:", err));
  }, []);

  async function handleSave(
    payload: CreateServicePayload,
    isNew: boolean,
    editingService: Service | null,
  ) {
    if (isNew) {
      await servicesApi.create(payload);
    } else if (editingService) {
      await servicesApi.update(editingService.id, payload);
    }
    setEditing(null);
    cacheClear("services");
    refresh();
    toast("Servicio guardado correctamente", "success");
  }

  async function remove(id: string) {
    try {
      await servicesApi.delete(id);
      cacheClear("services");
      refresh();
      toast("Servicio eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar servicio:", err);
      toast("Error al eliminar servicio", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Servicios</h1>
          <p className={styles.subtitle}>{total} servicios en catálogo</p>
        </div>
        <button onClick={() => setEditing("new")} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className={styles.searchInput}
          />
        </div>
      </div>

      <ServiceTable
        services={services}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(s) => setEditing(s)}
        onDelete={(s) => setDeleteTarget(s.id)}
        dimmed={false}
      />

      <ServiceFormModal
        editing={editing}
        products={products}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar servicio"
        message="¿Estás seguro de que querés eliminar este servicio? Esta acción no se puede deshacer."
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
