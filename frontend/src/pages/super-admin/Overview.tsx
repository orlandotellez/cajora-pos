import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Store,
  Users,
  Package,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  PauseCircle,
} from "lucide-react";
import {
  superAdminApi,
  type SuperAdminStats,
  type SubscriptionHealthResponse,
} from "@/api/super-admin";
import styles from "./SuperAdmin.module.css";

export default function Overview() {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [subHealth, setSubHealth] = useState<SubscriptionHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [statsRes, healthRes] = await Promise.all([
        superAdminApi.getStats(),
        superAdminApi.getSubscriptionHealth(),
      ]);
      setStats(statsRes);
      setSubHealth(healthRes);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error al cargar el panel super admin:", err);
      setError((err as Error)?.message || "Error al cargar los datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const kpis = stats
    ? [
      {
        label: "Tiendas",
        value: String(stats.stores.total),
        icon: Store,
        sub: `${stats.stores.created_this_month} este mes`,
        tone: styles.kpiToneBlue,
        warn: false,
      },
      {
        label: "Usuarios",
        value: String(stats.users.total),
        icon: Users,
        sub: `${stats.users.admins} admin · ${stats.users.cashiers} cajero`
          + (stats.users.super_admins > 0 ? ` · ${stats.users.super_admins} super` : ""),
        tone: styles.kpiToneViolet,
        warn: false,
      },
      {
        label: "Productos",
        value: String(stats.products.total),
        icon: Package,
        sub: undefined,
        tone: styles.kpiToneAmber,
        warn: stats.products.low_stock > 0,
      },
    ]
    : null;

  const subKpis = subHealth
    ? [
      {
        label: "Activas",
        value: String(subHealth.summary.active),
        icon: CheckCircle2,
        sub: `${subHealth.summary.cloud_total} cloud · ${subHealth.summary.self_hosted_total} self-hosted`,
        tone: styles.kpiToneGreen,
        warn: false,
      },
      {
        label: "Pago fallido",
        value: String(subHealth.summary.past_due),
        icon: AlertCircle,
        sub: "Requieren atención",
        tone: styles.kpiToneRed,
        warn: subHealth.summary.past_due > 0,
      },
      {
        label: "Canceladas",
        value: String(subHealth.summary.canceled),
        icon: XCircle,
        sub: undefined,
        tone: styles.kpiToneGray,
        warn: false,
      },
      {
        label: "Expiradas",
        value: String(subHealth.summary.expired),
        icon: PauseCircle,
        sub: undefined,
        tone: styles.kpiToneOrange,
        warn: subHealth.summary.expired > 0,
      },
    ]
    : null;

  return (
    <>
      {/* Barra de acciones */}
      <div className={styles.sectionActions}>
        {lastUpdated && (
          <span className={styles.updatedAt}>
            <span className={styles.liveDot} />
            Actualizado {lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          className={styles.refreshBtn}
          onClick={() => loadAll(true)}
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
          <button onClick={() => loadAll()}>Reintentar</button>
        </div>
      )}

      {/* KPIs globales */}
      <div className={styles.kpiGrid}>
        {kpis
          ? kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`${styles.kpiCard} ${k.warn ? styles.kpiCardWarn : ""}`}>
                <div className={`${styles.kpiIconChip} ${k.tone}`}>
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                {k.sub && <div className={styles.kpiSub}>{k.sub}</div>}
              </div>
            );
          })
          : Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.kpiCard}>
              <div className={styles.skeleton} style={{ width: 40, height: 40, borderRadius: 5 }} />
              <div className={styles.skeleton} style={{ width: "55%", height: 12, marginTop: 14 }} />
              <div className={styles.skeleton} style={{ width: "75%", height: 26, marginTop: 8 }} />
            </div>
          ))}
      </div>

      {/* KPIs de suscripciones */}
      {subKpis && (
        <div className={styles.kpiGrid}>
          {subKpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`${styles.kpiCard} ${k.warn ? styles.kpiCardWarn : ""}`}>
                <div className={`${styles.kpiIconChip} ${k.tone}`}>
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                {k.sub && <div className={styles.kpiSub}>{k.sub}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
