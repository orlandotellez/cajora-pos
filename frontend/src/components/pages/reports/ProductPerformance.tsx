import { useEffect, useState } from "react";
import { salesApi, type ProductPerformanceItem } from "@/api/sales";
import { money } from "@/lib/format";
import { toLocalISOString, type Range } from "@/lib/date-range";
import { rangeStart, rangeEnd } from "@/lib/date-range";
import styles from "./ChartsSection.module.css";

type SortKey = "revenue" | "quantity" | "product_name" | "last_sale_date";

export function ProductPerformance({ range }: { range: Range }) {
  const [data, setData] = useState<ProductPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const startIso = toLocalISOString(rangeStart(range));
    const endIso = toLocalISOString(rangeEnd(range));
    setLoading(true);
    salesApi
      .productPerformance({ start_date: startIso, end_date: endIso })
      .then(setData)
      .catch((err) => console.error("Error al cargar rendimiento de productos:", err))
      .finally(() => setLoading(false));
  }, [range]);

  const filtered = data.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "product_name") {
      return sortAsc
        ? a.product_name.localeCompare(b.product_name)
        : b.product_name.localeCompare(a.product_name);
    }
    if (sortKey === "last_sale_date") {
      const cmp = new Date(a.last_sale_date).getTime() - new Date(b.last_sale_date).getTime();
      return sortAsc ? cmp : -cmp;
    }
    const cmp = a[sortKey] - b[sortKey];
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "product_name"); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className={styles.chartCard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>Rendimiento de productos</h2>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 5,
            fontSize: 12,
            background: "var(--background)",
            color: "var(--foreground)",
            width: 180,
          }}
        />
      </div>

      {loading ? (
        <div className={styles.chartEmpty}>Cargando...</div>
      ) : sorted.length === 0 ? (
        <div className={styles.chartEmpty}>Sin datos en este periodo</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 580, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>#</th>
                <th
                  style={{ padding: "8px 12px", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                  onClick={() => toggleSort("product_name")}
                >
                  Producto{sortIcon("product_name")}
                </th>
                <th
                  style={{ padding: "8px 12px", textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("quantity")}
                >
                  Unidades{sortIcon("quantity")}
                </th>
                <th
                  style={{ padding: "8px 12px", textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("revenue")}
                >
                  Ingresos{sortIcon("revenue")}
                </th>
                <th
                  style={{ padding: "8px 12px", textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("last_sale_date")}
                >
                  Última venta{sortIcon("last_sale_date")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.product_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--muted-foreground)" }}>{i + 1}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.product_name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{p.quantity}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{money(p.revenue)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{formatDate(p.last_sale_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
