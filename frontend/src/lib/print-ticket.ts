import { money } from "./format";

export interface TicketProductRow {
  name: string;
  quantity: number;
  lineTotal: number;
}

export function buildTicketProductRow(item: TicketProductRow): string {
  return `<tr><td>${item.quantity}× ${item.name}</td><td style="text-align:right">${money(item.lineTotal)}</td></tr>`;
}


export interface TicketServiceProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  affectsPrice: boolean;
}

export function buildTicketServiceRows(svc: {
  displayName: string;
  basePrice: number;
  lineTotal: number;
  products: TicketServiceProduct[];
}): string {
  const included = svc.products
    .filter((p) => !p.affectsPrice && p.quantity > 0)
    .map((p) => `${p.name} × ${p.quantity}`);

  const additives = svc.products.filter((p) => p.affectsPrice && p.quantity > 0);

  const rows: string[] = [];
  rows.push(`<tr><td>${svc.displayName}</td><td style="text-align:right">${money(svc.basePrice)}</td></tr>`);

  if (included.length > 0) {
    rows.push(
      `<tr><td style="padding-left:8px;font-size:10px;color:#888" colspan="2">Incluye: ${included.join(", ")}</td></tr>`
    );
  }

  for (const p of additives) {
    rows.push(
      `<tr><td style="padding-left:8px;font-size:10px">+ ${p.name} × ${p.quantity}</td><td style="text-align:right;font-size:10px">${money(p.unitPrice * p.quantity)}</td></tr>`
    );
  }

  if (additives.length > 0) {
    rows.push(
      `<tr><td style="padding-left:8px;font-size:10px;border-top:1px dashed #ccc">Total servicio</td><td style="text-align:right;font-size:10px;border-top:1px dashed #ccc">${money(svc.lineTotal)}</td></tr>`
    );
  }

  return rows.join("");
}

export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 500);
}

export function buildTicketHtml(opts: {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeFooter?: string;
  saleId: string;
  userName: string;
  clientName?: string;
  date: string;
  rows: string;
  subtotal: number;
  discount: number;
  discountPct?: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  changeGiven: number;
}): string {
  const {
    storeName, storeAddress, storePhone, storeFooter,
    saleId, userName, clientName, date, rows,
    subtotal, discount, discountPct,
    total, paymentMethod, amountReceived, changeGiven,
  } = opts;

  return `
<html><head><title>Ticket</title>
<style>
body{font-family:ui-monospace,monospace;font-size:12px;padding:12px;max-width:300px}
h2{font-size:14px;margin:0 0 4px;text-align:center}
strong{font-size:14px;display:block;text-align:center;margin-bottom:4px}
.m{color:#666;text-align:center;font-size:11px;margin-bottom:2px}
table{width:100%;margin:12px 0;border-collapse:collapse}
td{padding:2px 0;vertical-align:top}
.line{border-top:1px dashed #999;margin:8px 0}
.tot{display:flex;justify-content:space-between}
.big{font-size:16px;font-weight:bold;margin:8px 0}
.f{color:#666;text-align:center;font-size:11px;margin-top:12px}
</style></head><body>
<h2>${storeName}</h2>
${storeAddress ? `<div class="m">${storeAddress}</div>` : ""}
${storePhone ? `<div class="m">${storePhone}</div>` : ""}
<div class="m">${date}</div>
<div class="m">Ticket: ${saleId.slice(0, 8)}</div>
<div class="m">Atendido por: ${userName}</div>
<div class="m">Cliente: ${clientName || "Cliente General"}</div>
<div class="line"></div>
<table>${rows}</table>
<div class="line"></div>
<div class="tot"><span>Subtotal</span><span>${money(subtotal)}</span></div>
${discount > 0
      ? `<div class="tot"><span>Descuento${discountPct != null ? ` (${discountPct}%)` : ""}</span><span>−${money(discount)}</span></div>`
      : `<div class="tot"><span>Descuento</span><span>${money(discount)}</span></div>`}
<div class="big tot"><span>TOTAL</span><span>${money(total)}</span></div>
<div class="tot"><span>Pago (${paymentMethod})</span><span>${money(amountReceived)}</span></div>
${changeGiven > 0 ? `<div class="tot"><span>Cambio</span><span>${money(changeGiven)}</span></div>` : ""}
<div class="line"></div>
<div class="f">${storeFooter || "¡Gracias por su compra!"}</div>
</body></html>`;
}
