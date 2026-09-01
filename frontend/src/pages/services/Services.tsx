import { useEffect, useMemo, useState } from "react";
import { servicesApi, type CreateServicePayload } from "@/api/services";
import { productsApi } from "@/api/products";
import type { Service, Product } from "@/api";
import { cacheClear } from "@/lib/simple-cache";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { useToast } from "@/components/common/ui/Toast";
import { usePosStore } from "@/store/posStore";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { ServiceTable } from "@/components/pages/services/ServiceTable";
import styles from "./Services.module.css";
import { ServiceFormModal } from "@/components/pages/services/ServiceFormModal";
import { Header } from "@/components/pages/services/Header";
import { Filter } from "@/components/pages/services/Filter";

export default function Services() {
  const { toast } = useToast();
  const addToCart = usePosStore((s) => s.addToCart);
  const { has, isAdmin } = usePermissions();
  const canWrite = has("catalog_write");

  const {
    items: services,
    total,
    page,
    q,
    loading,
    refreshing,
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
    pollMs: 10_000,
    realtimeEvents: ["service.created", "service.updated", "service.deleted"],
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const cart = usePosStore((s) => s.cart);

  const blockedServiceIds = useMemo(() => {
    const blocked = new Set<string>();
    if (products.length === 0) return blocked;
    for (const s of services) {
      const inCart = cart.find((x) => x._type === "service" && x.service_id === s.id);
      const totalQty = (inCart?.quantity ?? 0) + 1;
      const shortage = s.products.some((sp) => {
        const product = products.find((p) => p.id === sp.product_id);
        return !product || sp.quantity * totalQty > product.stock;
      });
      if (shortage) blocked.add(s.id);
    }
    return blocked;
  }, [products, services, cart]);

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
    try {
      if (isNew) {
        await servicesApi.create(payload);
      } else if (editingService) {
        await servicesApi.update(editingService.id, payload);
      }
      setEditing(null);
      cacheClear("services");
      refresh();
      toast("Servicio guardado correctamente", "success");
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      toast((err as Error)?.message || "Error al guardar servicio", "error");
    }
  }

  async function remove(id: string) {
    try {
      await servicesApi.delete(id);
      cacheClear("services");
      refresh();
      toast("Servicio eliminado", "success");
    } catch (err) {
      console.error("Error al eliminar servicio:", err);
      toast((err as Error)?.message || "Error al eliminar servicio", "error");
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
      await servicesApi.bulkDelete([...selectedIds]);
      cacheClear("services");
      refresh();
      setEditMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast("Servicios eliminados correctamente", "success");
    } catch (err) {
      console.error("Error al eliminar servicios:", err);
      toast((err as Error)?.message || "Error al eliminar servicios", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleAddToCart(s: Service) {
    let productsList = products;
    if (productsList.length === 0) {
      try {
        const res = await productsApi.list({ active: true, limit: 100 });
        productsList = res.products;
      } catch {
        toast(`No se pudo verificar el stock de "${s.name}"`, "error");
        return;
      }
    }

    const inCart = usePosStore
      .getState()
      .cart.find((x) => x._type === "service" && x.service_id === s.id);
    const totalQty = (inCart?.quantity ?? 0) + 1;

    const stocks = new Map<string, number>();
    const shortages: string[] = [];
    for (const sp of s.products) {
      const product = productsList.find((p) => p.id === sp.product_id);
      if (!product) {
        shortages.push(`"${sp.product_name}" (no se pudo verificar stock)`);
        continue;
      }
      stocks.set(sp.product_id, product.stock);
      const required = sp.quantity * totalQty;
      if (required > product.stock) {
        shortages.push(
          `"${sp.product_name}": disponible ${product.stock}, requerido ${required} (${sp.quantity} × ${totalQty})`,
        );
      }
    }

    if (shortages.length > 0) {
      toast(`No hay stock suficiente para "${s.name}": ${shortages.join(" · ")}`, "error");
      return;
    }

    addToCart(
      {
        id: s.id,
        service_id: s.id,
        name: s.name,
        base_price: s.base_price,
        products: s.products,
      },
      stocks,
    );
    toast(`"${s.name}" agregado a la lista de venta`, "success");
  }

  return (
    <div className={styles.page}>
      <Header
        total={total}
        setEditing={() => setEditing("new")}
        loading={loading}
        showCreateButton={canWrite}
        showEditMode={isAdmin}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
      />

      <Filter q={q} setSearch={setSearch} />

      {editMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size > 0
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "servicio seleccionado" : "servicios seleccionados"}`
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

      <ServiceTable
        services={services}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={canWrite ? (s) => setEditing(s) : undefined!}
        onDelete={canWrite ? (s) => setDeleteTarget(s.id) : undefined!}
        onRowClick={undefined}
        onAddToCart={handleAddToCart}
        blockedIds={blockedServiceIds}
        dimmed={false}
        refreshing={refreshing}
        selectable={editMode && isAdmin}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {canWrite && (
        <ServiceFormModal
          editing={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

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

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Eliminar servicios"
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} ${selectedIds.size === 1 ? "servicio" : "servicios"}? Esta acción no se puede deshacer.`}
        confirmLabel={bulkDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        onConfirm={() => handleBulkDelete()}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
