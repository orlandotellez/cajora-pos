import { buildTicketHtml, buildTicketProductRow, buildTicketServiceRows, printHtml } from "./print-ticket";
import type { CartItem, ProductCartItem, ServiceCartItem } from "@/store/posStore";




export function printTicket(
  saleId: string,
  cart: CartItem[],
  totals: { subtotal: number; discount: number; total: number; change: number },
  payment: string,
  received: string,
  storeName: string,
  storeAddress: string,
  storePhone: string,
  storeFooter: string,
  discountPct: number
) {
  const date = new Date().toLocaleString("es-MX");

  const rows = cart.map((x) => {
    if (x._type === "product") {
      const p = x as ProductCartItem;
      return buildTicketProductRow({ name: p.name, quantity: p.quantity, lineTotal: p.price * p.quantity });
    }
    const svc = x as ServiceCartItem;
    const svcQty = svc.quantity;
    const baseTotal = svc.base_price * svcQty;
    const products = svc.products.map((sp) => ({
      name: sp.product_name,
      quantity: sp.quantity * svcQty,
      unitPrice: sp.unit_price,
      affectsPrice: sp.affects_price,
    }));
    const additiveTotal = products
      .filter((p) => p.affectsPrice)
      .reduce((s, p) => s + p.unitPrice * p.quantity, 0);
    const lineTotal = baseTotal + additiveTotal;
    return buildTicketServiceRows({
      displayName: `${svcQty}× ${svc.name}`,
      basePrice: baseTotal,
      lineTotal,
      products,
    });
  }).join("");

  const html = buildTicketHtml({
    storeName,
    storeAddress,
    storePhone,
    storeFooter,
    saleId,
    date,
    rows,
    subtotal: totals.subtotal,
    discount: totals.discount,
    discountPct,
    total: totals.total,
    paymentMethod: payment,
    amountReceived: payment === "efectivo" || received ? Number(received || 0) : totals.total,
    changeGiven: totals.change,
  });

  printHtml(html);
}
