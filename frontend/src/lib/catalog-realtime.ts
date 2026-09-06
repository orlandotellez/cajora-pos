import { useCatalogoStore } from "@/store/catalogoStore";
import { usePosStore } from "@/store/posStore";
import { toastGlobal } from "@/components/common/ui/Toast";
import { subscribeRealtime } from "@/lib/realtime";
import { inventoryApi } from "@/api/inventory";

async function resolveBatchProductIds(batchId: string): Promise<string[]> {
  try {
    const batch = await inventoryApi.batchGetById(batchId);
    return (batch.items ?? []).map((i) => i.product_id);
  } catch {
    return [];
  }
}

export async function applyCatalogRealtimeEvent(event: string, data: unknown): Promise<void> {
  const store = useCatalogoStore.getState();

  switch (event) {
    case "product.created":
    case "product.updated": {
      const id = (data as { id?: string }).id;
      if (id) await store.fetchProduct(id);
      break;
    }
    case "product.deleted": {
      const payload = (data as { id?: string; ids?: string[] }) ?? {};
      const ids = Array.isArray(payload.ids) && payload.ids.length > 0
        ? payload.ids
        : payload.id
          ? [payload.id]
          : [];
      for (const id of ids) {
        store.removeProduct(id);
        const removed = usePosStore.getState().purgeProduct(id);
        if (removed) {
          toastGlobal(
            removed.fromService
              ? `"${removed.name}" (de "${removed.fromService}") fue eliminado del catálogo y se quitó del carrito`
              : `"${removed.name}" fue eliminado del catálogo y se quitó del carrito`,
            "info",
          );
        }
      }
      break;
    }
    case "service.created":
    case "service.updated": {
      const id = (data as { id?: string }).id;
      if (id) await store.fetchService(id);
      break;
    }
    case "service.deleted": {
      const id = (data as { id?: string }).id;
      if (id) store.removeService(id);
      break;
    }
    case "sale.created": {
      const productIds = (data as { product_ids?: string[] }).product_ids ?? [];
      await Promise.allSettled(productIds.map((id) => store.fetchProduct(id)));
      break;
    }
    case "inventory.movement.created": {
      const productId = (data as { product_id?: string }).product_id;
      if (productId) await store.fetchProduct(productId);
      break;
    }
    case "inventory.batch.created": {
      const id = (data as { id?: string }).id;
      if (!id) break;
      const productIds = await resolveBatchProductIds(id);
      await Promise.allSettled(productIds.map((pid) => store.fetchProduct(pid)));
      break;
    }
  }
}

export function subscribeCatalogRealtime(): () => void {
  return subscribeRealtime((event, data) => {
    void applyCatalogRealtimeEvent(event, data);
  });
}
