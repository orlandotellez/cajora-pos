import { create } from "zustand"
import type { Product, Service } from "@/api"
import { productsApi } from "@/api/products"
import { servicesApi } from "@/api/services"
import { fetchAllPages } from "@/lib/fetch-all-pages"

interface CatalogoState {
  products: Record<string, Product>
  services: Record<string, Service>
  loaded: boolean
  loading: boolean
  error: string | null
  hydratedAt: number | null
  version: number

  hydrate: (force?: boolean) => Promise<void>
  fetchProduct: (id: string) => Promise<void>
  fetchService: (id: string) => Promise<void>
  applyProductUpdate: (product: Product) => void
  removeProduct: (id: string) => void
  applyServiceUpdate: (service: Service) => void
  removeService: (id: string) => void
  applyStockChange: (productId: string, stock: number) => void
  clear: () => void
}

export const useCatalogoStore = create<CatalogoState>()((set, get) => ({
  products: {},
  services: {},
  loaded: false,
  loading: false,
  error: null,
  hydratedAt: null,
  version: 0,

  hydrate: async (force = false) => {
    // Idempotente: no re-hidratar si ya cargó (salvo que se pida force).
    if (get().loaded && !force) return
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const [products, services] = await Promise.all([
        // Solo productos activos (los que se venden en el POS).
        fetchAllPages((page, limit) =>
          productsApi
            .list({ active: true, page, limit })
            .then((res) => ({ items: res.products, total: res.total })),
        ),
        fetchAllPages((page, limit) =>
          servicesApi
            .list({ active: true, page, limit })
            .then((res) => ({ items: res.services, total: res.total })),
        ),
      ])

      const productMap: Record<string, Product> = {}
      for (const p of products) productMap[p.id] = p
      const serviceMap: Record<string, Service> = {}
      for (const s of services) serviceMap[s.id] = s

      set((s) => ({
        products: productMap,
        services: serviceMap,
        loaded: true,
        hydratedAt: Date.now(),
        version: s.version + 1,
      }))
    } catch (err) {
      set({ error: (err as Error)?.message || "Error al cargar el catálogo" })
    } finally {
      set({ loading: false })
    }
  },

  fetchProduct: async (id) => {
    try {
      const product = await productsApi.getById(id)
      get().applyProductUpdate(product)
    } catch {
      // Si el producto se eliminó o no existe, quitarlo del caché.
      get().removeProduct(id)
    }
  },

  fetchService: async (id) => {
    try {
      const service = await servicesApi.getById(id)
      get().applyServiceUpdate(service)
    } catch {
      get().removeService(id)
    }
  },

  applyProductUpdate: (product) => {
    set((s) => ({
      products: { ...s.products, [product.id]: product },
      version: s.version + 1,
    }))
  },

  removeProduct: (id) => {
    set((s) => {
      if (!(id in s.products)) return s
      const products = { ...s.products }
      delete products[id]
      return { products, version: s.version + 1 }
    })
  },

  applyServiceUpdate: (service) => {
    set((s) => ({
      services: { ...s.services, [service.id]: service },
      version: s.version + 1,
    }))
  },

  removeService: (id) => {
    set((s) => {
      if (!(id in s.services)) return s
      const services = { ...s.services }
      delete services[id]
      return { services, version: s.version + 1 }
    })
  },

  applyStockChange: (productId, stock) => {
    set((s) => {
      const current = s.products[productId]
      if (!current || current.stock === stock) return s
      return {
        products: { ...s.products, [productId]: { ...current, stock } },
        version: s.version + 1,
      }
    })
  },

  clear: () =>
    set({ products: {}, services: {}, loaded: false, loading: false, error: null, hydratedAt: null, version: 0 }),
}))


export function getCatalogProduct(id: string): Product | undefined {
  return useCatalogoStore.getState().products[id]
}

export function getCatalogService(id: string): Service | undefined {
  return useCatalogoStore.getState().services[id]
}

export function isCatalogLoaded(): boolean {
  return useCatalogoStore.getState().loaded
}
