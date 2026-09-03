import {
  salesApi,
  type ProductPerformanceItem,
  type RevenueByCategoryItem,
  type RevenueTrendItem,
  type Sale,
  type SaleReport,
} from "@/api/sales";
import {
  rangeEnd,
  rangeStart,
  rangeLabel,
  toLocalISOString,
  type Range,
} from "@/lib/date-range";
import type { WorkBook, WorkSheet } from "xlsx";

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
};

const RANGE_SLUG: Record<Range, string> = {
  today: "hoy",
  "7d": "7-dias",
  "30d": "30-dias",
  "1y": "1-ano",
};

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const pad = (n: number) => String(n).padStart(2, "0");

const round2 = (n: number) => Math.round(n * 100) / 100;

function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}

/** Convierte una fecha/hora ISO (con offset) a "dd/mm/aaaa hh:mm" local. */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Formatea una fecha "aaaa-mm-dd" (o ISO completo) a "dd/mm/aaaa" sin saltos de zona horaria. */
function fmtDateOnly(iso: string): string {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${pad(d)}/${pad(m)}/${y}`;
}

function dmy(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Descarga todas las ventas del rango (paginado). */
async function fetchAllSales(startIso: string, endIso: string): Promise<Sale[]> {
  const all: Sale[] = [];
  const limit = 100; // máximo permitido por la API de ventas
  let page = 1;
  let done = false;
  while (!done) {
    const res = await salesApi.list({ start_date: startIso, end_date: endIso, page, limit });
    all.push(...res.sales);
    if (res.sales.length === 0 || all.length >= res.total || page >= 100) done = true;
    else page += 1;
  }
  return all;
}

/** Crea una hoja desde encabezados + filas y le ajusta el ancho de columnas. */
function tableSheet(
  utils: typeof import("xlsx").utils,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
): WorkSheet {
  const ws = utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
  return ws;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Liberar la URL en el siguiente tick para no abortar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporta a un archivo .xlsx (multi-hoja) el resumen y detalle del rango:
 * Resumen (KPIs y métodos de pago), Ventas, Productos, Ventas por categoría
 * e Ingresos por período.
 */
export async function exportReportsToExcel(range: Range, report: SaleReport) {
  const XLSX = await import("xlsx");
  const { utils } = XLSX;

  const start = rangeStart(range);
  const end = rangeEnd(range);
  const startIso = toLocalISOString(start);
  const endIso = toLocalISOString(end);

  const [sales, performance, categories, trend] = await Promise.all([
    fetchAllSales(startIso, endIso),
    salesApi.productPerformance({ start_date: startIso, end_date: endIso }),
    salesApi.revenueByCategory({ start_date: startIso, end_date: endIso }),
    salesApi.revenueTrend({
      start_date: startIso,
      end_date: endIso,
      group_by: range === "1y" ? "month" : "day",
    }),
  ]);

  const wb: WorkBook = utils.book_new();

  // 1. Resumen del periodo (KPIs + desglose por método de pago).
  const paymentEntries = Object.entries(report.sales_by_payment_method ?? {});
  const resumenRows: (string | number)[][] = [
    [`Reporte — ${rangeLabel(range)}`, ""],
    [`${dmy(start)} — ${dmy(end)}`, ""],
    [],
    ["Métrica", "Valor"],
    ["Ventas (transacciones)", report.total_sales],
    ["Ingresos totales", round2(report.total_revenue)],
    ["Ticket promedio", round2(report.average_ticket)],
    ["Descuentos otorgados", round2(report.total_discount)],
  ];
  if (paymentEntries.length > 0) {
    resumenRows.push([], ["Ingresos por método de pago", ""]);
    for (const [method, value] of paymentEntries) {
      resumenRows.push([paymentLabel(method), round2(value)]);
    }
  }
  const wsResumen = utils.aoa_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 36 }, { wch: 18 }];
  utils.book_append_sheet(wb, wsResumen, "Resumen");

  // 2. Ventas detalladas (una fila por venta).
  const ventasRows: (string | number)[][] = sales.map((s) => [
    fmtDateTime(s.created_at),
    s.client_name ?? "",
    s.user_name,
    paymentLabel(s.payment_method),
    round2(s.subtotal),
    round2(s.discount),
    round2(s.total),
  ]);
  utils.book_append_sheet(
    wb,
    tableSheet(
      utils,
      ["Fecha", "Cliente", "Cajero", "Método de pago", "Subtotal", "Descuento", "Total"],
      ventasRows,
      [17, 22, 18, 16, 12, 12, 12],
    ),
    "Ventas",
  );

  // 3. Rendimiento de productos (todos, ordenados por ingresos).
  const sortedProducts = [...performance].sort((a, b) => b.revenue - a.revenue);
  const productRows: (string | number)[][] = sortedProducts.map((p: ProductPerformanceItem) => [
    p.product_name,
    p.quantity,
    round2(p.revenue),
    fmtDateOnly(p.last_sale_date),
  ]);
  utils.book_append_sheet(
    wb,
    tableSheet(
      utils,
      ["Producto", "Unidades", "Ingresos", "Última venta"],
      productRows,
      [34, 12, 14, 14],
    ),
    "Productos",
  );

  // 4. Ventas por categoría.
  const sortedCategories = [...categories].sort((a, b) => b.revenue - a.revenue);
  const categoryRows: (string | number)[][] = sortedCategories.map((c: RevenueByCategoryItem) => [
    c.category_name,
    c.quantity,
    round2(c.revenue),
  ]);
  utils.book_append_sheet(
    wb,
    tableSheet(
      utils,
      ["Categoría", "Unidades", "Ingresos"],
      categoryRows,
      [30, 12, 14],
    ),
    "Categorías",
  );

  // 5. Ingresos por período (día o mes según el rango).
  const trendRows: (string | number)[][] = trend.map((t: RevenueTrendItem) => [
    t.date,
    round2(t.revenue),
  ]);
  utils.book_append_sheet(
    wb,
    tableSheet(
      utils,
      ["Período", "Ingresos"],
      trendRows,
      [14, 14],
    ),
    "Ingresos por período",
  );

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: XLSX_MIME });

  const today = new Date();
  const filename =
    `reporte-${RANGE_SLUG[range]}-${today.getFullYear()}-` +
    `${pad(today.getMonth() + 1)}-${pad(today.getDate())}.xlsx`;
  downloadBlob(blob, filename);
}
