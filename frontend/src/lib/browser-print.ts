/**
 * Imprime un recibo desde el navegador usando window.print().
 *
 * Funciona con cualquier impresora configurada en el sistema operativo
 * del usuario (USB, red, Bluetooth) — incluyendo impresoras térmicas.
 *
 * Solo se usa cuando NO estamos en Tauri (web plano).
 */

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isService?: boolean;
  isIncluded?: boolean;
  isAdditive?: boolean;
}

interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeFooter?: string;
  saleId: string;
  date: string;
  userName: string;
  clientName: string;
  items: ReceiptItem[];
  serviceItems?: {
    name: string;
    quantity: number;
    basePrice: number;
    lineTotal: number;
    products: ReceiptItem[];
  }[];
  subtotal: number;
  discount: number;
  discountPct?: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
}

function buildReceiptHTML(data: ReceiptData): string {
  const itemRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="text-align:left;padding:2px 0">${item.quantity}× ${item.name}</td>
          <td style="text-align:right;padding:2px 0;font-variant-numeric:tabular-nums">$${item.lineTotal.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const serviceRows =
    data.serviceItems
      ?.map((svc) => {
        let html = `<tr>
          <td style="text-align:left;padding:2px 0">${svc.quantity}× ${svc.name}</td>
          <td style="text-align:right;padding:2px 0;font-variant-numeric:tabular-nums">$${svc.basePrice.toFixed(2)}</td>
        </tr>`;
        svc.products
          .filter((sp) => sp.isIncluded)
          .forEach((sp) => {
            html += `<tr><td colspan="2" style="padding:1px 0 1px 8px;font-size:10px;color:#888">Incluye: ${sp.name} × ${sp.quantity}</td></tr>`;
          });
        svc.products
          .filter((sp) => sp.isAdditive)
          .forEach((sp) => {
            html += `<tr>
              <td style="padding:1px 0 1px 8px;font-size:10px;color:#888">+ ${sp.name} × ${sp.quantity}</td>
              <td style="text-align:right;padding:1px 0;font-size:10px;color:#888">$${sp.lineTotal.toFixed(2)}</td>
            </tr>`;
          });
        if (svc.products.some((sp) => sp.isAdditive)) {
          html += `<tr><td style="padding:4px 0 4px 4px;font-size:10px;border-top:1px dashed #ccc;font-weight:500">Total servicio</td><td style="text-align:right;padding:4px 0;font-size:10px;border-top:1px dashed #ccc;font-weight:500">$${svc.lineTotal.toFixed(2)}</td></tr>`;
        }
        return html;
      })
      .join("") ?? "";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Recibo</title>
<style>
  @page {
    size: 58mm auto;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    width: 48mm;
    padding: 2mm;
    color: #000;
    background: #fff;
  }
  .header { text-align: center; font-weight: 700; font-size: 14px; margin-bottom: 2px; }
  .address, .phone { text-align: center; font-size: 10px; color: #666; }
  .meta { text-align: center; font-size: 10px; color: #666; line-height: 1.6; margin: 4px 0; }
  .divider { border-top: 1px dashed #ccc; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 8px; }
  .total { font-weight: 700; font-size: 13px; padding: 4px 0; border-top: 2px solid #000; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">${data.storeName}</div>
  ${data.storeAddress ? `<div class="address">${data.storeAddress}</div>` : ""}
  ${data.storePhone ? `<div class="phone">${data.storePhone}</div>` : ""}

  <div class="meta">
    <div>${data.date}</div>
    <div>Ticket: ${data.saleId.slice(0, 8)}</div>
    <div>Atendido por: ${data.userName}</div>
    <div>Cliente: ${data.clientName}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tbody>
      ${itemRows}
      ${serviceRows}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="row"><span>Subtotal</span><span>$${data.subtotal.toFixed(2)}</span></div>
  ${data.discount > 0 ? `<div class="row"><span>Descuento${data.discountPct ? ` (${data.discountPct}%)` : ""}</span><span>-$${data.discount.toFixed(2)}</span></div>` : ""}
  <div class="total row"><span>TOTAL</span><span>$${data.total.toFixed(2)}</span></div>
  <div class="row"><span>Pago (${data.paymentMethod})</span><span>$${data.amountReceived.toFixed(2)}</span></div>
  ${data.change > 0 ? `<div class="row"><span>Cambio</span><span>$${data.change.toFixed(2)}</span></div>` : ""}
  ${data.storeFooter ? `<div class="divider"></div><div class="footer">${data.storeFooter}</div>` : ""}
</body>
</html>`;
}

/**
 * Genera el HTML del recibo y abre el diálogo de impresión del navegador.
 * El usuario puede seleccionar cualquier impresora (incluyendo térmicas).
 */
export function printReceiptBrowser(data: ReceiptData): void {
  const html = buildReceiptHTML(data);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: abrir en nueva ventana
    const w = window.open("", "_blank", "width=300,height=600");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Esperar a que cargue antes de imprimir
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Limpiar después de un rato
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 200);
  };
}
