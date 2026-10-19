import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Cloud,
  Server,
  Search,
  Filter,
} from "lucide-react";
import {
  superAdminApi,
  type SubscriptionHealthResponse,
  type SubscriptionRow,
} from "@/api/super-admin";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PAGE_LIMIT } from "@/lib/constants";
import { initials, hueFromString, timeUntil } from "./helpers";
import { SubStatusBadge, SUB_STATUS_OPTIONS, subStatusIcon } from "./Badges";
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
  const [page, setPage] = useState(1);
  const limit = PAGE_LIMIT;

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
      const listRes = await superAdminApi.getSubscriptionsList({
        status: statusFilter || undefined,
        mode: modeFilter || undefined,
        search: search || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setSubs(listRes.subscriptions);
      setTotal(listRes.total);
    } catch (err) {
      setError((err as Error)?.message || "Error al cargar suscripciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, modeFilter, search, page]);

  // El resumen de salud es global: se carga una sola vez al montar.
  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // La lista (con filtros/paginación) recarga ante cada cambio.
  useEffect(() => {
    loadList();
  }, [loadList]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Si la página queda fuera de rango (p. ej. un filtro redujo el total), el
  // listado vuelve a la primera página en vez de mostrar una tabla vacía.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

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

  const columns: Column<SubscriptionRow>[] = [
    {
      key: "store",
      label: "Tienda",
      render: (sub) => {
        const hue = hueFromString(sub.store_name);
        return (
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
        );
      },
    },
    {
      key: "owner",
      label: "Owner",
      render: (sub) => (
        <div className={styles.userText}>
          <div className={styles.userName}>{sub.owner_name ?? "—"}</div>
          <div className={styles.userEmail}>{sub.owner_email ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "mode",
      label: "Modo",
      render: (sub) => (
        <span className={`${styles.subBadge} ${sub.mode === "cloud" ? styles.subActive : styles.subCanceled}`}>
          {sub.mode === "cloud" ? <Cloud size={11} /> : <Server size={11} />}
          {sub.mode === "cloud" ? "Cloud" : "Self-hosted"}
        </span>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      render: (sub) => <span className={styles.userDate}>{sub.plan}</span>,
    },
    {
      key: "status",
      label: "Estado",
      render: (sub) => (
        <StatusSelect
          storeId={sub.store_id}
          currentStatus={sub.status}
          onChange={handleStatusChange}
        />
      ),
    },
    {
      key: "period_end",
      label: "Fin del período",
      render: (sub) => (
        <span className={styles.userDate}>
          {sub.current_period_end
            ? new Date(sub.current_period_end).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
            : "—"}
        </span>
      ),
    },
    {
      key: "days_left",
      label: "Días restantes",
      align: "right",
      render: (sub) => {
        const remaining = timeUntil(sub.current_period_end);
        if (!remaining) return <span className={styles.userDate}>—</span>;
        const cls =
          remaining.tone === "expired"
            ? styles.expiryExpired
            : remaining.tone === "urgent"
              ? styles.expiryUrgent
              : styles.expiryOk;
        return <span className={cls}>{remaining.text}</span>;
      },
    },
  ];

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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <Filter size={15} />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={styles.filterSelect}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={modeFilter}
            onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
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
          onClick={() => { loadHealth(); loadList(true); }}
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

      <DataTable
        columns={columns}
        data={subs}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        refreshing={refreshing}
        emptyMessage={
          search || statusFilter || modeFilter
            ? "No se encontraron suscripciones con estos filtros"
            : "Todavía no hay suscripciones"
        }
        skeletonCols={[
          { width: "160px" },
          { width: "140px" },
          { width: "80px" },
          { width: "60px" },
          { width: "130px" },
          { width: "90px" },
          { width: "60px", align: "right" },
        ]}
      />
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
  const Icon = subStatusIcon(currentStatus);

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
    // El <select> nativo no puede renderizar componentes dentro de sus <option>
    // (solo texto), así que el icono va al lado y refleja el valor actual.
    <span className={styles.selectWithIcon}>
      <Icon size={13} className={styles[`stateIcon_${currentStatus}`] ?? ""} />
      <select
        className={`${styles.statusSelect} ${styles[`statusSelect_${currentStatus}`] ?? ""}`}
        value={currentStatus}
        onChange={(e) => handleChange(e.target.value)}
        disabled={changing}
      >
        {SUB_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
