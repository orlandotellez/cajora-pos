import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { salesApi, type SaleReport, type RevenueTrendItem, type RevenueByCategoryItem } from "@/api/sales";
import { money } from "@/lib/format";
import { rangeStart, rangeEnd, toLocalISOString, type Range } from "@/lib/date-range";
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from "./chartTooltipStyle";
import styles from "./ChartsSection.module.css";

const CHART_LINE_COLOR = "#3b82f6";
const CATEGORY_PALETTE = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#06b4d6", "#8b5cf6", "#94a3b8"];

function groupByFor(range: Range): "day" | "month" {
  if (range === "1y") return "month";
  return "day";
}

function periodKey(d: Date, range: Range): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (range === "1y") return `${day.slice(0, 7)}-01`;
  return day;
}

function stepPeriod(d: Date, range: Range) {
  if (range === "1y") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 1);
}

// Completa todos los periodos del rango con 0, incluso sin ventas.
function fillTrendGaps(data: RevenueTrendItem[], range: Range): RevenueTrendItem[] {
  if (data.length === 0) return data;
  const map = new Map(data.map((i) => [periodKey(new Date(i.date), range), i.revenue]));
  const start = rangeStart(range);
  const end = new Date();
  const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const points: RevenueTrendItem[] = [];
  while (cursor <= end) {
    const key = periodKey(cursor, range);
    points.push({ date: key, revenue: map.get(key) ?? 0 });
    stepPeriod(cursor, range);
  }
  return points;
}

/**
 * Sección de gráficos de la página de Reportes.
 *
 */
export function ChartsSection({ report, range }: { report: SaleReport | null; range: Range }) {
  const [trendData, setTrendData] = useState<RevenueTrendItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [categoryData, setCategoryData] = useState<RevenueByCategoryItem[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    const startIso = toLocalISOString(rangeStart(range));
    const endIso = toLocalISOString(rangeEnd(range));

    setTrendLoading(true);
    salesApi
      .revenueTrend({ start_date: startIso, end_date: endIso, group_by: groupByFor(range) })
      .then(setTrendData)
      .catch((err) => console.error("Error al cargar tendencia:", err))
      .finally(() => setTrendLoading(false));

    setCategoryLoading(true);
    salesApi
      .revenueByCategory({ start_date: startIso, end_date: endIso })
      .then(setCategoryData)
      .catch((err) => console.error("Error al cargar ventas por categoría:", err))
      .finally(() => setCategoryLoading(false));
  }, [range]);

  // Tendencia con todos los periodos del rango (los sin ventas valen 0).
  const filledTrend = useMemo(() => fillTrendGaps(trendData, range), [trendData, range]);

  // Ventas por categoría: top 5 + "Otros"
  const categoryChartData = useMemo(() => {
    const mapped = categoryData.map((c, i) => ({
      name: c.category_name,
      value: c.revenue,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    }));
    if (mapped.length <= 5) return mapped;
    const top = mapped.slice(0, 5);
    const rest = mapped.slice(5).reduce((sum, c) => sum + c.value, 0);
    return [...top, { name: "Otros", value: rest, color: "#94a3b8" }];
  }, [categoryData]);
  const hasCategories = categoryData.some((c) => c.revenue > 0);

  function formatXLabel(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const local = new Date(y, m - 1, d);
    if (range === "1y") return local.toLocaleDateString("es-MX", { month: "short" });
    return local.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }

  function periodLabel() {
    if (range === "1y") return "mes";
    return "día";
  }

  const totalRevenue = filledTrend.reduce((sum, i) => sum + i.revenue, 0);
  const maxItem = filledTrend.reduce(
    (best, i) => (i.revenue > best.revenue ? i : best),
    { date: "", revenue: 0 },
  );

  const [productMetric, setProductMetric] = useState<"revenue" | "quantity">("revenue");

  const topProducts = useMemo(() => {
    const list = (report?.top_products ?? []).slice();
    if (productMetric === "revenue") return list.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    return list.sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [report, productMetric]);

  return (
    <div>
      <div className={styles.chartsHeader}>
        <h2 className={styles.sectionTitle}>Gráficos</h2>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Ingresos</h2>
          {filledTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={filledTrend} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXLabel}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => money(v as number)}
                  tick={{ fontSize: 10 }}
                  width={85}
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelFormatter={(dateStr) => {
                    const [y, m, d] = (dateStr as string).split("-").map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                  }}
                  formatter={(v) => [money(v as number), "Ingresos"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_LINE_COLOR}
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={filledTrend.length > 60 ? false : { r: 4, fill: CHART_LINE_COLOR, strokeWidth: 0 }}
                  activeDot={
                    filledTrend.length > 60
                      ? false
                      : { r: 6, fill: CHART_LINE_COLOR, strokeWidth: 2, stroke: "#fff" }
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          ) : trendLoading ? (
            <div className={styles.chartEmpty}>Cargando...</div>
          ) : (
            <div className={styles.chartEmpty}>Sin datos en este periodo</div>
          )}
          {filledTrend.length > 0 && (
            <div className={styles.chartSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total</span>
                <span className={styles.summaryValue}>{money(totalRevenue)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Mejor {periodLabel()}</span>
                <span className={styles.summaryValue}>{money(maxItem.revenue)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Periodos</span>
                <span className={styles.summaryValue}>{filledTrend.length}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Ventas por categoría</h2>
          {hasCategories ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {categoryChartData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(v) => money(v as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.categoryLegend}>
                {categoryChartData.map((d) => (
                  <div key={d.name} className={styles.categoryLegendRow}>
                    <span className={styles.categoryLegendName}>
                      <span className={styles.categoryLegendDot} style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className={styles.categoryLegendValue}>{money(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : categoryLoading ? (
            <div className={styles.chartEmpty}>Cargando...</div>
          ) : (
            <div className={styles.chartEmpty}>Sin datos en este periodo</div>
          )}
        </div>
      </div>

      {/* Tabla de productos más vendidos */}
      {report?.top_products && report.top_products.length > 0 && (
        <div className={styles.chartsGrid}>
          <div className={styles.chartCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>Productos más vendidos</h2>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segmentedBtn}${productMetric === "revenue" ? ` ${styles.segmentedActive}` : ""}`}
                  onClick={() => setProductMetric("revenue")}
                >
                  Ingresos
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedBtn}${productMetric === "quantity" ? ` ${styles.segmentedActive}` : ""}`}
                  onClick={() => setProductMetric("quantity")}
                >
                  Cantidad
                </button>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>#</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Producto</th>
                  {productMetric === "revenue" ? (
                    <>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Ingresos</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Cantidad</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Cantidad</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Ingresos</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.product_name} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--muted-foreground)" }}>{i + 1}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.product_name}</td>
                    {productMetric === "revenue" ? (
                      <>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{money(p.revenue)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.quantity}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{p.quantity}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{money(p.revenue)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
