import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PAYMENT_METHODS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { SaleReport } from "@/api";
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from "./chartTooltipStyle";
import styles from "./CashCloseCard.module.css";

const METHOD_COLORS: Record<string, string> = {
  efectivo: "#22c55e",
  tarjeta: "#3b82f6",
  transferencia: "#a855f7",
  credito: "#f59e0b",
};

interface CashCloseCardProps {
  report: SaleReport | null;
  rangeLabel: string;
}

export function CashCloseCard({ report, rangeLabel }: CashCloseCardProps) {
  const bm = report?.sales_by_payment_method ?? {};
  const total = report?.total_revenue ?? 0;
  const paymentMethods = [...PAYMENT_METHODS];

  const chartData = paymentMethods
    .map((pm) => ({
      name: pm.label,
      value: (bm as Record<string, number>)[pm.value] ?? 0,
      color: METHOD_COLORS[pm.value] ?? "#94a3b8",
    }))
    .filter((d) => d.value > 0);

  return (
    <div className={styles["close-card"]}>
      <h3 className={styles["close-card-title"]}>Cierre de caja — {rangeLabel}</h3>

      {chartData.length > 0 ? (
        <div className={styles["close-card-donut"]}>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((d, i) => (
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
          <div className={styles["close-card-total-center"]}>
            <span className={styles["close-card-total-center-label"]}>Total</span>
            <span className={styles["close-card-total-center-value"]}>{money(total)}</span>
          </div>
        </div>
      ) : (
        <div className={styles["close-card-empty"]}>Sin ventas en este periodo</div>
      )}

      <div className={styles["close-card-body"]}>
        {paymentMethods.map((pm) => (
          <div key={pm.value} className={styles["close-card-row"]}>
            <span className={styles["close-card-label"]}>
              <span
                className={styles["close-card-dot"]}
                style={{ background: METHOD_COLORS[pm.value] ?? "#94a3b8" }}
              />
              {pm.label}
            </span>
            <span>{money((bm as Record<string, number>)[pm.value] ?? 0)}</span>
          </div>
        ))}
        <div className={styles["close-card-divider"]} />
        <div className={styles["close-card-total-row"]}>
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </div>
  );
}
