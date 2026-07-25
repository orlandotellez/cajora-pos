import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { salesApi, type SaleReport, type RevenueTrendItem } from "@/api/sales";
import { money } from "@/lib/format";
import styles from "./ChartsSection.module.css";

type ChartRange = "7d" | "30d" | "4w" | "1y";

const CHART_RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "4w", label: "Ultimas 4 semanas" },
  { value: "1y", label: "Ano" },
];

const CHART_BAR_FILL = "#3b82f6";
const CHART_LINE_COLOR = "#3b82f6";

/**
 * Sección de gráficos de la página de Reportes.
 *
 * Muestra dos charts lado a lado: ingresos (line chart) por rango de tiempo
 * + productos más vendidos por ingreso (bar chart horizontal).
 *
 * Extraído de `pages/Reports.tsx` (Fase 1 de la refactorización) — sin
 * cambios de comportamiento, solo se mueve fuera del page-level component.
 */
export function ChartsSection({ report }: { report: SaleReport | null }) {
  const [chartRange, setChartRange] = useState<ChartRange>("7d");
  const [trendData, setTrendData] = useState<RevenueTrendItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    let start: Date;
    let groupBy: "day" | "week" | "month";

    switch (chartRange) {
      case "7d":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        groupBy = "day";
        break;
      case "30d":
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        groupBy = "day";
        break;
      case "4w":
        start = new Date(now);
        start.setDate(start.getDate() - 28);
        groupBy = "week";
        break;
      case "1y":
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        groupBy = "month";
        break;
    }

    setTrendLoading(true);
    salesApi
      .revenueTrend({
        start_date: start!.toISOString(),
        end_date: now.toISOString(),
        group_by: groupBy!,
      })
      .then(setTrendData)
      .catch((err) => console.error("Error al cargar tendencia:", err))
      .finally(() => setTrendLoading(false));
  }, [chartRange]);

  const productData = (report?.top_products ?? []).map((p) => ({
    name: p.product_name,
    revenue: p.revenue,
  }));
  const hasProducts = productData.length > 0;

  function formatXLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (chartRange === "1y") return d.toLocaleDateString("es-MX", { month: "short" });
    if (chartRange === "4w") return `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }

  function periodLabel() {
    switch (chartRange) {
      case "7d":
        return "dia";
      case "30d":
        return "dia";
      case "4w":
        return "semana";
      case "1y":
        return "mes";
    }
  }

  const totalRevenue = trendData.reduce((sum, i) => sum + i.revenue, 0);
  const avgRevenue = trendData.length > 0 ? totalRevenue / trendData.length : 0;
  const maxItem = trendData.reduce(
    (best, i) => (i.revenue > best.revenue ? i : best),
    { date: "", revenue: 0 },
  );

  return (
    <div className={styles.chartsGrid}>
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h2 className={styles.cardTitle}>Ingresos</h2>
          <select
            value={chartRange}
            onChange={(e) => setChartRange(e.target.value as ChartRange)}
            className={styles.select}
          >
            {CHART_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
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
                labelFormatter={(dateStr) =>
                  new Date(dateStr as string).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                }
                formatter={(v) => [money(v as number), "Ingresos"]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={CHART_LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 4, fill: CHART_LINE_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: CHART_LINE_COLOR, strokeWidth: 2, stroke: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : trendLoading ? (
          <div className={styles.chartEmpty}>Cargando...</div>
        ) : (
          <div className={styles.chartEmpty}>Sin datos en este periodo</div>
        )}
        {trendData.length > 0 && (
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
              <span className={styles.summaryValue}>{trendData.length}</span>
            </div>
          </div>
        )}
      </div>
      <div className={styles.chartCard}>
        <h2 className={styles.cardTitle}>Productos mas vendidos por ingreso</h2>
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
                tickFormatter={(v) => money(v as number)}
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
              <Tooltip formatter={(v) => money(v as number)} />
              <Bar dataKey="revenue" fill={CHART_BAR_FILL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>Sin datos en este periodo</div>
        )}
      </div>
    </div>
  );
}
