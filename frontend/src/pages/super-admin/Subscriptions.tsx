import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import {
  superAdminApi,
  type SubscriptionHealthResponse,
  type SubscriptionRow,
} from "@/api/super-admin";
import { initials, hueFromString, formatEventAction } from "./helpers";
import { SubStatusBadge } from "./Badges";
import styles from "./SuperAdmin.module.css";

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activas" },
  { value: "past_due", label: "Pago fallido" },
  { value: "canceled", label: "Canceladas" },
  { value: "expired", label: "Expiradas" },
  { value: "pending", label: "Pendientes" },
];

const MODE_FILTERS = [
  { value: "", label: "Todos" },
  { value: "cloud", label: "Cloud" },
  { value: "self_hosted", label: "Self-hosted" },
];

export default function Subscriptions() {
  // Health summary
  const [health, setHealth] = useState<SubscriptionHealthResponse | null>(null);

  // Full list
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadHealth = useCallback(async () => {
    try {
      const res = await superAdminApi.getSubscriptionHealth();
      setHealth(res);
    } catch {
      // silently fail, health is optional
    }
  }, []);

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [healthRes, listRes] = await Promise.all([
        loadHealth().then(() => superAdminApi.getSubscriptionHealth()),
        superAdminApi.getSubscriptionsList({
          status: statusFilter || undefined,
          mode: modeFilter || undefined,
          search: search || undefined,
          limit,
          offset: page * limit,
        }),
      ]);
      setHealth(healthRes);
      setSubs(listRes.subscriptions);
      setTotal(listRes.total);
    } catch (err) {
      setError((err as Error)?.message || "Error al cargar suscripciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, modeFilter, search, page]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const totalPages = Math.ceil(total / limit);

  const handleStatusChange = useCallback(
    async (storeId: string, newStatus: string) => {
      try {
        await superAdminApi.updateSubscriptionStatus(storeId, newStatus);
        // Actualizar localmente
        setSubs((prev) =>
          prev.map((s) =>
            s.store_id === storeId ? { ...s, status: newStatus } : s,
          ),
        );
        // Refrescar el resumen
        loadHealth();
      } catch (err) {
        setError((err as Error)?.message || "Error al cambiar estado");
      }
    },
    [loadHealth],
  );

  return (
    <>
      {/* Resumen rápido */}
      {health && (
        <div className={styles.kpiGrid}>
          {[
            { label: "Activas", value: String(health.summary.active), tone: styles.kpiToneGreen, warn: false },
            { label: "Pago fallido", value: String(health.summary.past_due), tone: styles.kpiToneRed, warn: health.summary.past_due > 0 },
            { label: "Canceladas", value: String(health.summary.canceled), tone: styles.kpiToneGray, warn: false },
            { label: "Expiradas", value: String(health.summary.expired), tone: styles.kpiToneOrange, warn: health.summary.expired > 0 },
            { label: "Pendientes", value: String(health.summary.pending), tone: styles.kpiToneAmber, warn: false },
            { label: "Total", value: String(health.summary.total), tone: styles.kpiToneBlue, warn: false },
          ].map((k) => (
            <div key={k.label} className={`${styles.kpiCard} ${k.warn ? styles.kpiCardWarn : ""}`}>
              <div className={`${styles.kpiIconChip} ${k.tone}`}>
                <span className={styles.kpiValueSmall}>{k.value}</span>
              </div>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className={styles.sectionActions}>
        <div className={styles.searchBox}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar tienda o owner…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <Filter size={15} />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className={styles.filterSelect}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={modeFilter}
            onChange={(e) => { setModeFilter(e.target.value); setPage(0); }}
            className={styles.filterSelect}
          >
            {MODE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <span className={styles.cardCount}>{total} suscripciones</span>
        <button
          className={styles.refreshBtn}
          onClick={() => loadList(true)}
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
          <button onClick={() => loadList()}>Reintentar</button>
        </div>
      )}

      {/* Tabla completa de suscripciones */}
      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tienda</th>
                <th>Owner</th>
                <th>Modo</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Fin del período</th>
                <th className={styles.thNum}>Días restantes</th>
              </tr>
            </thead>
            <tbody>
              {loading && subs.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} style={{ padding: "14px 20px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22, borderRadius: 5 }} />
                    </td>
                  </tr>
                ))
                : subs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.empty}>
                        <span className={styles.emptyIcon}>
                          <Clock size={22} />
                        </span>
                        <span className={styles.emptyText}>
                          {search || statusFilter || modeFilter
                            ? "No se encontraron suscripciones con estos filtros"
                            : "Todavía no hay suscripciones"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : subs.map((sub) => {
                  const hue = hueFromString(sub.store_name);
                  return (
                    <tr key={sub.id}>
                      <td>
                        <div className={styles.storeCell}>
                          <span
                            className={styles.storeAvatar}
                            style={{
                              background: `oklch(0.72 0.1 ${hue})`,
                              color: `oklch(0.22 0.03 ${hue})`,
                            }}
                          >
                            {initials(sub.store_name)}
                          </span>
                          <div className={styles.storeText}>
                            <div className={styles.storeName}>{sub.store_name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.userText}>
                          <div className={styles.userName}>{sub.owner_name ?? "—"}</div>
                          <div className={styles.userEmail}>{sub.owner_email ?? "—"}</div>
                        </div>
                      </td>
                      <td>
                        <span className={sub.mode === "cloud" ? styles.subActive : styles.subCanceled}>
                          {sub.mode === "cloud" ? "☁️ Cloud" : "🖥️ Self-hosted"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.userDate}>{sub.plan}</span>
                      </td>
                      <td>
                        <StatusSelect
                          storeId={sub.store_id}
                          currentStatus={sub.status}
                          onChange={handleStatusChange}
                        />
                      </td>
                      <td>
                        <span className={styles.userDate}>
                          {sub.current_period_end
                            ? new Date(sub.current_period_end).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </span>
                      </td>
                      <td className={styles.tdNum}>
                        {sub.days_until_expiry !== null ? (
                          <span className={
                            sub.days_until_expiry <= 0
                              ? styles.expiryExpired
                              : sub.days_until_expiry <= 3
                                ? styles.expiryUrgent
                                : styles.expiryOk
                          }>
                            {sub.days_until_expiry <= 0 ? "Expirado" : `${sub.days_until_expiry}d`}
                          </span>
                        ) : (
                          <span className={styles.userDate}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

function StatusSelect({
  storeId,
  currentStatus,
  onChange,
}: {
  storeId: string;
  currentStatus: string;
  onChange: (storeId: string, status: string) => void;
}) {
  const [changing, setChanging] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setChanging(true);
    try {
      await onChange(storeId, newStatus);
    } finally {
      setChanging(false);
    }
  };

  return (
    <select
      className={`${styles.statusSelect} ${styles[`statusSelect_${currentStatus}`] ?? ""}`}
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={changing}
    >
      <option value="active">✅ Activa</option>
      <option value="past_due">⚠️ Pago fallido</option>
      <option value="pending">🕐 Pendiente</option>
      <option value="canceled">❌ Cancelada</option>
      <option value="expired">⏰ Expirada</option>
    </select>
  );
}
