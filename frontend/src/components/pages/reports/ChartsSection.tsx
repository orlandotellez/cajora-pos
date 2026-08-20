import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { salesApi, type SaleReport, type RevenueTrendItem, type RevenueByHourItem, type RevenueByCategoryItem } from "@/api/sales";
import { money } from "@/lib/format";
import { rangeStart, rangeEnd, type Range } from "@/lib/date-range";
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from "./chartTooltipStyle";
import styles from "./ChartsSection.module.css";

const CHART_BAR_FILL = "#3b82f6";
const CHART_LINE_COLOR = "#3b82f6";
const CATEGORY_PALETTE = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#06b4d6", "#8b5cf6", "#94a3b8"];

function groupByFor(range: Range): "day" | "week" | "month" {
  if (range === "4w") return "week";
  if (range === "1y") return "month";
  return "day";
}

// Clave de periodo que coincide con la truncación del backend
// (DATE_TRUNC en UTC): día → fecha, semana → lunes, mes → primer día.
function periodKey(d: Date, range: Range): string {
  const day = d.toISOString().slice(0, 10);
  if (range === "today" || range === "7d" || range === "30d") return day;
  if (range === "4w") {
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const diff = utc.getUTCDay() === 0 ? -6 : 1 - utc.getUTCDay();
    utc.setUTCDate(utc.getUTCDate() + diff);
    return utc.toISOString().slice(0, 10);
  }
  return `${day.slice(0, 7)}-01`;
}

function stepPeriod(d: Date, range: Range) {
  if (range === "1y") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (range === "4w") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCDate(d.getUTCDate() + 1);
}

// Completa todos los periodos del rango con 0, incluso sin ventas.
function fillTrendGaps(data: RevenueTrendItem[], range: Range): RevenueTrendItem[] {
  if (data.length === 0) return data;
  const map = new Map(data.map((i) => [periodKey(new Date(i.date), range), i.revenue]));
  const start = rangeStart(range);
  const end = new Date();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
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
  const [hourData, setHourData] = useState<RevenueByHourItem[]>([]);
  const [hourLoading, setHourLoading] = useState(false);
  const [categoryData, setCategoryData] = useState<RevenueByCategoryItem[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [productMetric, setProductMetric] = useState<"revenue" | "quantity">("revenue");

  useEffect(() => {
    const startIso = rangeStart(range).toISOString();
    const endIso = rangeEnd(range).toISOString();

    setTrendLoading(true);
    salesApi
      .revenueTrend({ start_date: startIso, end_date: endIso, group_by: groupByFor(range) })
      .then(setTrendData)
      .catch((err) => console.error("Error al cargar tendencia:", err))
      .finally(() => setTrendLoading(false));

    setHourLoading(true);
    salesApi
      .revenueByHour({ start_date: startIso, end_date: endIso })
      .then(setHourData)
      .catch((err) => console.error("Error al cargar ventas por hora:", err))
      .finally(() => setHourLoading(false));

    setCategoryLoading(true);
    salesApi
      .revenueByCategory({ start_date: startIso, end_date: endIso })
      .then(setCategoryData)
      .catch((err) => console.error("Error al cargar ventas por categoría:", err))
      .finally(() => setCategoryLoading(false));
  }, [range]);

  // Tendencia con todos los periodos del rango (los sin ventas valen 0).
  const filledTrend = useMemo(() => fillTrendGaps(trendData, range), [trendData, range]);

  // Top productos: toggle Cantidad / Ingresos (re-ordenados según la métrica)
  const productData = useMemo(() => {
    const data = (report?.top_products ?? []).map((p) => ({
      name: p.product_name,
      revenue: p.revenue,
      quantity: p.quantity,
    }));
    return [...data].sort((a, b) =>
      productMetric === "revenue" ? b.revenue - a.revenue : b.quantity - a.quantity,
    );
  }, [report, productMetric]);
  const hasProducts = productData.length > 0;
  const productMetricKey = productMetric === "revenue" ? "revenue" : "quantity";

  // Ventas por hora: completar las 24 horas con ceros
  const hourChartData = useMemo(() => {
    const map = new Map(hourData.map((h) => [h.hour, h]));
    return Array.from({ length: 24 }, (_, i) => map.get(i) ?? { hour: i, revenue: 0, sales: 0 });
  }, [hourData]);
  const hasHours = hourChartData.some((h) => h.revenue > 0);

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
    switch (range) {
      case "4w":
        return "semana";
      case "1y":
        return "mes";
      default:
        return "dia";
    }
  }

  const totalRevenue = filledTrend.reduce((sum, i) => sum + i.revenue, 0);
  const avgRevenue = filledTrend.length > 0 ? totalRevenue / filledTrend.length : 0;
  const maxItem = filledTrend.reduce(
    (best, i) => (i.revenue > best.revenue ? i : best),
    { date: "", revenue: 0 },
  );

  const metricFormatter = (v: number | string) =>
    productMetric === "revenue" ? money(v as number) : `${v} und.`;

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
                  tick={{ fontSize: 11 }}
                  width={70}
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
                <span className={styles.summaryLabel}>Promedio por {periodLabel()}</span>
                <span className={styles.summaryValue}>{money(avgRevenue)}</span>
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
          <div className={styles.chartHeader}>
            <h2 className={styles.cardTitle}>Productos más vendidos</h2>
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
          {hasProducts ? (
            <ResponsiveContainer width="100%" height={Math.max(200, productData.length * 40)}>
              <BarChart
                data={productData}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={metricFormatter}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) =>
                    (v as string).length > 18 ? (v as string).slice(0, 16) + "..." : (v as string)
                  }
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(v) => metricFormatter(v as number)}
                />
                <Bar dataKey={productMetricKey} fill={CHART_BAR_FILL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.chartEmpty}>Sin datos en este periodo</div>
          )}
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Ventas por hora del día</h2>
          {hasHours ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${String(h as number).padStart(2, "0")}:00`}
                  tick={{ fontSize: 10 }}
                  interval={2}
                />
                <YAxis tickFormatter={(v) => money(v as number)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  labelFormatter={(h) => `${String(h as number).padStart(2, "0")}:00`}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as RevenueByHourItem;
                    return (
                      <div className={styles.chartTooltip}>
                        <div className={styles.chartTooltipTitle}>
                          {`${String(label as number).padStart(2, "0")}:00`}
                        </div>
                        <div className={styles.chartTooltipRow}>
                          <span>Ingresos</span>
                          <strong>{money(item.revenue)}</strong>
                        </div>
                        <div className={styles.chartTooltipRow}>
                          <span>Ventas</span>
                          <strong>{item.sales}</strong>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" fill={CHART_BAR_FILL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : hourLoading ? (
            <div className={styles.chartEmpty}>Cargando...</div>
          ) : (
            <div className={styles.chartEmpty}>Sin datos en este periodo</div>
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
    </div>
  );
}
