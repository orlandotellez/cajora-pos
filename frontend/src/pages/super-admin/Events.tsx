import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  Filter,
} from "lucide-react";
import {
  superAdminApi,
  type SubscriptionHealthEvent,
} from "@/api/super-admin";
import { formatEventAction } from "./helpers";
import { SubStatusBadge } from "./Badges";
import styles from "./SuperAdmin.module.css";

const ACTION_FILTERS = [
  { value: "", label: "Todos" },
  { value: "webhook_payment_failed", label: "Pago fallido" },
  { value: "webhook_suspended", label: "Suspendida" },
  { value: "webhook_cancelled", label: "Cancelada" },
  { value: "webhook_expired", label: "Expirada" },
  { value: "webhook_activated", label: "Activada" },
  { value: "webhook_sale_completed", label: "Pago completado" },
  { value: "checkout", label: "Checkout" },
  { value: "activate", label: "Activación" },
  { value: "cancel", label: "Cancelación" },
  { value: "reactivate", label: "Reactivación" },
];

export default function Events() {
  const [events, setEvents] = useState<SubscriptionHealthEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/super-admin/subscription-events?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar eventos");
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error)?.message || "Error al cargar eventos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className={styles.sectionActions}>
        <div className={styles.filterGroup}>
          <Filter size={15} />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className={styles.filterSelect}
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <span className={styles.cardCount}>{total} eventos</span>
        <button
          className={styles.refreshBtn}
          onClick={() => load(true)}
          disabled={refreshing || loading}
        >
          <RefreshCw size={15} className={refreshing ? styles.spin : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className={styles.errorCard}>
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => load()}>Reintentar</button>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tienda</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} style={{ padding: "14px 20px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22, borderRadius: 5 }} />
                    </td>
                  </tr>
                ))
                : events.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className={styles.empty}>
                        <span className={styles.emptyIcon}>
                          <Clock size={22} />
                        </span>
                        <span className={styles.emptyText}>No hay eventos que mostrar</span>
                      </div>
                    </td>
                  </tr>
                ) : events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className={styles.storeName}>{ev.store_name ?? ev.store_id ?? "—"}</span>
                    </td>
                    <td>
                      <div className={styles.userText}>
                        <div className={styles.userName}>{ev.user_name ?? "Sistema"}</div>
                        {ev.user_email && <div className={styles.userEmail}>{ev.user_email}</div>}
                      </div>
                    </td>
                    <td>
                      <SubStatusBadge
                        status={ev.action.includes("payment_failed") ? "past_due" : ev.action.includes("cancelled") ? "canceled" : ev.action.includes("expired") ? "expired" : ev.action.includes("activated") || ev.action.includes("sale_completed") ? "active" : "pending"}
                      />
                      <span className={styles.userDate} style={{ marginLeft: 8 }}>{formatEventAction(ev.action)}</span>
                    </td>
                    <td className={styles.userDate}>
                      {new Date(ev.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </button>
            <span className={styles.pageInfo}>
              Página {page + 1} de {totalPages}
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </>
  );
}
