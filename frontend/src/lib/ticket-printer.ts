import type { Sale } from "@/api/sales";
import {
  buildTicketHtml,
  buildTicketProductRow,
  buildTicketServiceRows,
  printHtml,
} from "./print-ticket";

/**
 * Reimprime el ticket de una venta usando un iframe oculto.
 *
 * Esta función es la versión "pura" (sin React) que se usaba inline en
 * `pages/Sales.tsx`. Se extrae como utilidad para que cualquier página que
 * necesite reimprimir un ticket (e.g. `Sales`, futuro modal de detalles,
 * etc.) pueda reutilizarla sin duplicar la lógica de armado de HTML.
 */
export function printSaleTicket(
  sale: Sale,
  storeName: string,
  userName: string,
  storeAddress?: string,
  storePhone?: string,
  storeFooter?: string,
  clientName?: string,
): void {
  const date = new Date(sale.created_at).toLocaleString("es-MX");

  const productRows = (sale.items ?? [])
    .map((item) =>
      buildTicketProductRow({
        name: item.product_name,
        quantity: item.quantity,
        lineTotal: item.line_total,
      }),
    )
    .join("");
  const serviceRows = (sale.service_items ?? [])
    .map((svc) =>
      buildTicketServiceRows({
        displayName: svc.service_name,
        basePrice: svc.base_price,
        lineTotal: svc.line_total,
        products: svc.products.map((sp) => ({
          name: sp.product_name,
          quantity: sp.quantity,
          unitPrice: sp.unit_price,
          affectsPrice: sp.affects_price ?? false,
        })),
      }),
    )
    .join("");
  const rows = productRows + serviceRows;

  const html = buildTicketHtml({
    storeName: storeName || "Tienda",
    storeAddress,
    storePhone,
    storeFooter,
    saleId: sale.id,
    date,
    userName,
    clientName,
    rows,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.payment_method,
    amountReceived: sale.amount_received ?? sale.total,
    changeGiven: sale.change_given ?? 0,
  });

  printHtml(html);
}
