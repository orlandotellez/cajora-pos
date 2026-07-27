import { useCallback, useState } from "react";
import { salesApi, type CreateSalePayload } from "@/api/sales";
import { printersApi } from "@/api/printers";
import { ApiError } from "@/api/client";
import { money } from "@/lib/format";
import { type PaymentMethod } from "@/lib/constants";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  total: number;
  change: number;
}

export interface CompletedSale {
  saleId: string;
  userName: string;
  cart: CartItem[];
  totals: CheckoutTotals;
  payment: string;
  received: string;
  discountPct: number;
}

export interface StoreSettingsSnapshot {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeFooter: string;
}

export interface UseCheckoutOptions {
  cart: CartItem[];
  totals: CheckoutTotals;
  payment: string;
  received: string;
  manualAmount: boolean;
  currency: string;
  discountPct: number;
  userName: string;
  storeSettings: StoreSettingsSnapshot;
  showAlert: (message: string) => void;
  setCheckingOut: (value: boolean) => void;
  clearCart: () => void;
}

export interface UseCheckoutReturn {
  completedSale: CompletedSale | null;
  checkout: () => Promise<void>;
  handlePrintTicket: (saleId: string, saleUserName: string) => void;
  finalizeSale: () => void;
}

/**
 * Hook que encapsula el flujo de "cobrar" del POS:
 *
 *   - `checkout()`: arma el payload (productos + servicios + payment +
 *     received), POST a `salesApi.create`, marca `completedSale`. Valida
 *     monto recibido >= total antes de tocar la API.
 *
 *   - `handlePrintTicket(saleId, userName)`: imprime el ticket (via
 *     `printTicket`) y llama a `finalizeSale()`. Se invoca desde
 *     `<PosCompletedSaleModal onPrint>`.
 *
 *   - `finalizeSale()`: limpia `completedSale`, vacía el carrito y baja
 *     `checkingOut`. Se invoca desde el botón "cerrar" del modal de venta
 *     completada; componentes que necesiten ocultar UI propia al finalizar
 *     deben envolverlo en un wrapper local (e.g. `setShowMobileCheckout(false)`).
 *
 * **Por qué `checkout` lee `checkingOut` desde `usePosStore.getState()`**:
 * el closure de `checkout` lee el valor "en vivo" al momento de invocarse,
 * evitando closures stale cuando `checkingOut` cambia entre renders.
 */
export function useCheckout(opts: UseCheckoutOptions): UseCheckoutReturn {
  const {
    cart,
    totals,
    payment,
    received,
    manualAmount,
    currency,
    discountPct,
    userName,
    storeSettings,
    showAlert,
    setCheckingOut,
    clearCart,
  } = opts;

  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  const finalizeSale = useCallback(() => {
    setCompletedSale(null);
    clearCart();
    setCheckingOut(false);
  }, [clearCart, setCheckingOut]);

  const handlePrintTicket = useCallback(
    async (saleId: string, saleUserName: string) => {
      if (!completedSale) return;
      try {
        const res = await printersApi.list();
        const defaultPrinter = res.printers.find(
          (p) => p.is_default && p.is_active
        );
        if (!defaultPrinter) {
          showAlert(
            "No hay una impresora predeterminada configurada. Configurá una en Ajustes > Impresoras."
          );
          return;
        }
        const result = await printersApi.printReceipt(defaultPrinter.id, saleId, 1);
        if (result.success) {
          finalizeSale();
        } else {
          showAlert(
            result.error ||
              "No se pudo imprimir el recibo. Verificá la conexión con la impresora."
          );
        }
      } catch (err) {
        showAlert(
          `Error al imprimir: ${(err as ApiError).message}`
        );
      }
    },
    [completedSale, finalizeSale, showAlert],
  );

  const checkout = useCallback(async () => {
    if (!cart.length) return;
    if (usePosStore.getState().checkingOut) return;

    const rcvd = parseFloat(received);
    if ((payment === "efectivo" || manualAmount) && (!Number.isFinite(rcvd) || rcvd < totals.total)) {
      showAlert(
        `El monto recibido (${money(Number.isFinite(rcvd) ? rcvd : 0, currency)}) es menor al total (${money(totals.total, currency)}).`,
      );
      return;
    }

    setCheckingOut(true);

    try {
      const productItems = cart
        .filter((x): x is ProductCartItem => x._type === "product")
        .map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.price * item.quantity,
        }));

      const serviceItems = cart
        .filter((x): x is ServiceCartItem => x._type === "service")
        .map((item) => {
          const svcQty = item.quantity;
          const customProducts = item.products.map((sp) => ({
            product_id: sp.product_id,
            product_name: sp.product_name,
            quantity: sp.quantity * svcQty,
            unit_price: sp.unit_price,
            line_total: sp.unit_price * sp.quantity * svcQty,
            affects_price: sp.affects_price,
          }));
          const additiveTotal = customProducts
            .filter((p) => p.affects_price)
            .reduce((s, p) => s + p.line_total, 0);
          return {
            service_id: item.service_id,
            service_name: item.name,
            base_price: item.base_price,
            line_total: item.base_price * svcQty + additiveTotal,
            products: customProducts,
          };
        });

      const shouldSendAmount = payment === "efectivo" || manualAmount;

      const payload: CreateSalePayload = {
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        payment_method: payment as PaymentMethod,
        amount_received: shouldSendAmount && Number.isFinite(rcvd) ? rcvd : undefined,
        change_given: shouldSendAmount ? totals.change : undefined,
        user_name: userName,
        items: productItems.length > 0 ? productItems : undefined,
        service_items: serviceItems.length > 0 ? serviceItems : undefined,
      };

      const sale = await salesApi.create(payload);
      setCompletedSale({
        saleId: sale.id,
        userName: sale.user_name,
        cart: [...cart],
        totals: { ...totals },
        payment,
        received,
        discountPct,
      });
    } catch (err) {
      console.error("Error al crear venta:", err);
      showAlert("Error al procesar la venta. Intenta de nuevo.");
      setCheckingOut(false);
    }
  }, [
    cart,
    totals,
    payment,
    received,
    manualAmount,
    currency,
    discountPct,
    userName,
    showAlert,
    setCheckingOut,
  ]);

  return { completedSale, checkout, handlePrintTicket, finalizeSale };
}
