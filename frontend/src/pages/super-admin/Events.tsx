import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Filter,
} from "lucide-react";
import {
  superAdminApi,
  type SubscriptionHealthEvent,
} from "@/api/super-admin";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PAGE_LIMIT } from "@/lib/constants";
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
  const [page, setPage] = useState(1);
  const limit = PAGE_LIMIT;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await superAdminApi.getSubscriptionEvents({
        limit,
        offset: (page - 1) * limit,
        action: actionFilter || undefined,
      });
      setEvents(res.events);
      setTotal(res.total);
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

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Si la página queda fuera de rango (p. ej. un filtro redujo el total), el
  // listado vuelve a la primera página en vez de mostrar una tabla vacía.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const columns: Column<SubscriptionHealthEvent>[] = [
    {
      key: "store",
      label: "Tienda",
      render: (ev) => (
        <span className={styles.storeName}>{ev.store_name ?? ev.store_id ?? "—"}</span>
      ),
    },
    {
      key: "user",
      label: "Usuario",
      render: (ev) => (
        <div className={styles.userText}>
          <div className={styles.userName}>{ev.user_name ?? "Sistema"}</div>
          {ev.user_email && <div className={styles.userEmail}>{ev.user_email}</div>}
        </div>
      ),
    },
    {
      key: "action",
      label: "Acción",
      render: (ev) => (
        <>
          <SubStatusBadge
            status={ev.action.includes("payment_failed") ? "past_due" : ev.action.includes("cancelled") ? "canceled" : ev.action.includes("expired") ? "expired" : ev.action.includes("activate") || ev.action.includes("sale_completed") ? "active" : "pending"}
          />
          <span className={styles.userDate} style={{ marginLeft: 8 }}>{formatEventAction(ev.action)}</span>
        </>
      ),
    },
    {
      key: "created_at",
      label: "Fecha",
      render: (ev) => (
        <span className={styles.userDate}>
          {new Date(ev.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className={styles.sectionActions}>
        <div className={styles.filterGroup}>
          <Filter size={15} />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
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

      <DataTable
        columns={columns}
        data={events}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        refreshing={refreshing}
        emptyMessage="No hay eventos que mostrar"
        skeletonCols={[
          { width: "160px" },
          { width: "140px" },
          { width: "180px" },
          { width: "120px" },
        ]}
      />
    </>
  );
}
