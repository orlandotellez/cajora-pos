import { create } from "zustand";
import type { Product } from "@/api/products";
import type { ServiceProduct } from "@/api/services";
import type { CurrencyCode } from "@/lib/constants";
import { getStoredCurrency } from "@/lib/format";

// ---------------------------------------------------------------------------
// Tipos de items del carrito
// ---------------------------------------------------------------------------

export type ProductCartItem = Product & { _type: "product"; quantity: number };

/** Product inside a service cart item — cart-specific, not requiring API-only fields */
export interface ServiceCartProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  affects_price: boolean;
  stock: number;
}

export interface ServiceCartItem {
  _type: "service";
  id: string;
  service_id: string;
  name: string;
  base_price: number;
  quantity: number;
  products: ServiceCartProduct[];
}

export type CartItem = ProductCartItem | ServiceCartItem;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface PosState {
  cart: CartItem[];
  discountPct: number;
  payment: string;
  received: string;
  manualAmount: boolean;
  checkingOut: boolean;
  currency: CurrencyCode;

  addToCart: (
    item: Product | { id: string; service_id: string; name: string; base_price: number; products: ServiceProduct[] },
    stocks?: Map<string, number>,
  ) => void;
  setQty: (id: string, q: number) => void;
  updateServiceProductQty: (serviceId: string, productId: string, qty: number) => void;
  removeServiceProduct: (serviceId: string, productId: string) => void;
  addServiceProduct: (serviceId: string, product: Product, quantity?: number) => void;
  toggleServiceProductAffectsPrice: (serviceId: string, productId: string) => void;
  /**
   * Actualiza el stock de los productos del carrito (items regulares y
   * sub-productos de servicios) con valores frescos del server. Lo usa el POS
   * cuando llega un evento SSE de stock (`sale.created`, `product.updated`, ...)
   * para que el cajero nunca vea stock viejo.
   */
  syncStocks: (stocks: Record<string, number>) => void;
  clearCart: () => void;
  setDiscountPct: (pct: number) => void;
  setPayment: (method: string) => void;
  setReceived: (amount: string) => void;
  setManualAmount: (v: boolean) => void;
  setCheckingOut: (v: boolean) => void;
  setCurrency: (c: CurrencyCode) => void;
}

function isProduct(item: Product | { id: string; service_id: string; name: string; base_price: number; products: ServiceProduct[] }): item is Product {
  return "price" in item && typeof (item as Product).price === "number" && !("service_id" in item);
}

export const usePosStore = create<PosState>()((set) => ({
  cart: [],
  discountPct: 0,
  payment: "efectivo",
  received: "",
  manualAmount: false,
  checkingOut: false,
  currency: getStoredCurrency() as CurrencyCode,

  addToCart: (item, stocks) =>
    set((s) => {
      if (isProduct(item)) {
        // Product item
        const i = s.cart.findIndex((x) => x._type === "product" && x.id === item.id);
        if (i >= 0) {
          const copy = [...s.cart];
          copy[i] = { ...copy[i], quantity: (copy[i] as ProductCartItem).quantity + 1 };
          return { cart: copy };
        }
        const newItem: ProductCartItem = { ...item, _type: "product", quantity: 1 };
        return { cart: [newItem, ...s.cart] };
      } else {
        // Service item
        const i = s.cart.findIndex((x) => x._type === "service" && x.service_id === item.service_id);
        if (i >= 0) {
          const copy = [...s.cart];
          copy[i] = { ...copy[i], quantity: (copy[i] as ServiceCartItem).quantity + 1 };
          return { cart: copy };
        }
        const newItem: ServiceCartItem = {
          _type: "service",
          id: `svc-${item.service_id}`,
          service_id: item.service_id,
          name: item.name,
          base_price: item.base_price,
          quantity: 1,
          products: item.products.map((sp) => ({
            product_id: sp.product_id,
            product_name: sp.product_name,
            quantity: sp.quantity,
            unit_price: sp.product_price,
            affects_price: false,
            stock: stocks?.get(sp.product_id) ?? 0,
          })),
        };
        return { cart: [newItem, ...s.cart] };
      }
    }),

  setQty: (id, q) =>
    set((s) => ({
      cart: q <= 0
        ? s.cart.filter((x) => x.id !== id)
        : s.cart.map((x) => (x.id === id ? { ...x, quantity: q } : x)),
    })),

  updateServiceProductQty: (serviceId, productId, qty) =>
    set((s) => ({
      cart: s.cart.map((x) =>
        x._type === "service" && x.service_id === serviceId
          ? {
              ...(x as ServiceCartItem),
              products: qty <= 0
                ? (x as ServiceCartItem).products.filter((sp) => sp.product_id !== productId)
                : (x as ServiceCartItem).products.map((sp) =>
                    sp.product_id === productId ? { ...sp, quantity: qty } : sp
                  ),
            }
          : x
      ),
    })),

  removeServiceProduct: (serviceId, productId) =>
    set((s) => ({
      cart: s.cart.map((x) =>
        x._type === "service" && x.service_id === serviceId
          ? {
              ...(x as ServiceCartItem),
              products: (x as ServiceCartItem).products.filter((sp) => sp.product_id !== productId),
            }
          : x
      ),
    })),

  addServiceProduct: (serviceId, product, quantity = 1) =>
    set((s) => ({
      cart: s.cart.map((x) =>
        x._type === "service" && x.service_id === serviceId
          ? {
              ...(x as ServiceCartItem),
              products: [
                ...(x as ServiceCartItem).products,
                { product_id: product.id, product_name: product.name, quantity, unit_price: product.price, affects_price: false, stock: product.stock },
              ],
            }
          : x
      ),
    })),

  toggleServiceProductAffectsPrice: (serviceId, productId) =>
    set((s) => ({
      cart: s.cart.map((x) =>
        x._type === "service" && x.service_id === serviceId
          ? {
              ...(x as ServiceCartItem),
              products: (x as ServiceCartItem).products.map((sp) =>
                sp.product_id === productId ? { ...sp, affects_price: !sp.affects_price } : sp
              ),
            }
          : x
      ),
    })),

  syncStocks: (stocks) =>
    set((s) => ({
      cart: s.cart.map((x) => {
        if (x._type === "product") {
          const stock = stocks[x.id];
          return stock === undefined ? x : { ...(x as ProductCartItem), stock };
        }
        const svc = x as ServiceCartItem;
        const products = svc.products.map((sp) => {
          const stock = stocks[sp.product_id];
          return stock === undefined ? sp : { ...sp, stock };
        });
        return { ...svc, products };
      }),
    })),

  clearCart: () => set({ cart: [], discountPct: 0, received: "", manualAmount: false, payment: "efectivo" }),

  setDiscountPct: (discountPct) => set({ discountPct }),
  setPayment: (payment) => set({ payment, manualAmount: false, received: "" }),
  setReceived: (received) => set({ received }),
  setManualAmount: (manualAmount) => set({ manualAmount }),
  setCheckingOut: (checkingOut) => set({ checkingOut }),
  setCurrency: (currency) => set({ currency }),
}));
