import { useMemo, useState } from "react";
import type { SaleReport } from "@/api/sales";
import { money } from "@/lib/format";
import styles from "./ChartsSection.module.css";

export function TopProducts({ report }: { report: SaleReport | null }) {
  const [productMetric, setProductMetric] = useState<"revenue" | "quantity">("revenue");

  const topProducts = useMemo(() => {
    const list = (report?.top_products ?? []).slice();
    if (productMetric === "revenue") return list.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    return list.sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [report, productMetric]);

  if (!report?.top_products || report.top_products.length === 0) return null;

  return (
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
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>#</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Producto</th>
              {productMetric === "revenue" ? (
                <>
                  <th style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Ingresos</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Cantidad</th>
                </>
              ) : (
                <>
                  <th style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Cantidad</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Ingresos</th>
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
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{money(p.revenue)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{p.quantity}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{p.quantity}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{money(p.revenue)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
