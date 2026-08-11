import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  Store,
  Users,
  Package,
  Receipt,
  Shield,
  ShieldOff,
  Crown,
  Loader2,
  AlertTriangle,
  UserX,
  CheckCircle2,
} from "lucide-react";
import {
  superAdminApi,
  type SuperAdminStats,
  type SuperAdminStoreRow,
  type SuperAdminStoreUser,
} from "@/api/super-admin";
import { useSuperAdminGuard } from "@/hooks/useSuperAdminGuard";
import styles from "./SuperAdmin.module.css";

function RoleBadge({ role }: { role: string }) {
  const isSuper = role === "super_admin";
  const isAdmin = role === "admin";
  const Icon = isSuper ? Crown : isAdmin ? Shield : ShieldOff;
  return (
    <span
      className={styles.roleBadge}
      style={{
        background: isSuper
          ? "rgba(16,185,129,0.12)"
          : isAdmin
            ? "rgba(139,92,246,0.12)"
            : "rgba(59,130,246,0.12)",
        color: isSuper ? "#10b981" : isAdmin ? "#8b5cf6" : "#3b82f6",
      }}
    >
      <Icon size={12} />
      {isSuper ? "Super Admin" : isAdmin ? "Admin" : "Cajero"}
    </span>
  );
}

export default function SuperAdmin() {
  useSuperAdminGuard();

  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [stores, setStores] = useState<SuperAdminStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Usuarios por tienda (expansión lazy)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usersByStore, setUsersByStore] = useState<Record<string, SuperAdminStoreUser[]>>({});
  const [usersLoading, setUsersLoading] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [statsRes, storesRes] = await Promise.all([
        superAdminApi.getStats(),
        superAdminApi.getStores(),
      ]);
      setStats(statsRes);
      setStores(storesRes.stores);
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

  const toggleStore = useCallback(
    async (storeId: string) => {
      if (expandedId === storeId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(storeId);
      if (!usersByStore[storeId]) {
        setUsersLoading((prev) => ({ ...prev, [storeId]: true }));
        try {
          const res = await superAdminApi.getStoreUsers(storeId);
          setUsersByStore((prev) => ({ ...prev, [storeId]: res.users }));
        } catch (err) {
          console.error("Error al cargar usuarios de la tienda:", err);
        } finally {
          setUsersLoading((prev) => ({ ...prev, [storeId]: false }));
        }
      }
    },
    [expandedId, usersByStore],
  );

  const kpis = stats
    ? [
      {
        label: "Tiendas",
        value: String(stats.stores.total),
        icon: Store,
        sub: `${stats.stores.created_this_month} este mes`,
        warn: false,
      },
      {
        label: "Usuarios",
        value: String(stats.users.total),
        icon: Users,
        sub: `${stats.users.admins} admin · ${stats.users.cashiers} cajero`
          + (stats.users.super_admins > 0 ? ` · ${stats.users.super_admins} super` : ""),
        warn: false,
      },
      {
        label: "Productos",
        value: String(stats.products.total),
        icon: Package,
        sub: `${stats.products.active} activos · ${stats.products.low_stock} bajo stock`,
        warn: stats.products.low_stock > 0,
      },
    ]
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel Super Admin</h1>
          <p className={styles.subtitle}>Vista global de todas las tiendas y sus métricas</p>
        </div>
        <div className={styles.headerActions}>
          {lastUpdated && (
            <span className={styles.updatedAt}>
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
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span className={styles.kpiLabel}>{k.label}</span>
                  <Icon size={16} className={styles.kpiIcon} />
                </div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={`${styles.kpiSub} ${k.warn ? styles.kpiSubWarn : ""}`}>{k.sub}</div>
              </div>
            );
          })
          : Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.kpiCard}>
              <div className={styles.skeleton} style={{ width: "55%", height: 12 }} />
              <div className={styles.skeleton} style={{ width: "75%", height: 26, marginTop: 10 }} />
              <div className={styles.skeleton} style={{ width: "65%", height: 12, marginTop: 10 }} />
            </div>
          ))}
      </div>

      {/* Tabla de tiendas */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Tiendas</h2>
          <span className={styles.cardCount}>{stores.length} total</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tienda</th>
                <th className={styles.thNum}>Usuarios</th>
                <th className={styles.thNum}>Productos</th>
                <th className={styles.thNum}>Servicios</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && stores.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} style={{ padding: "10px 16px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22 }} />
                    </td>
                  </tr>
                ))
                : stores.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        Todavía no hay tiendas registradas
                      </td>
                    </tr>
                  )
                  : stores.map((s) => (
                    <StoreRows
                      key={s.id}
                      store={s}
                      expanded={expandedId === s.id}
                      users={usersByStore[s.id] ?? []}
                      usersLoading={!!usersLoading[s.id]}
                      onToggle={() => toggleStore(s.id)}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StoreRows({
  store,
  expanded,
  users,
  usersLoading,
  onToggle,
}: {
  store: SuperAdminStoreRow;
  expanded: boolean;
  users: SuperAdminStoreUser[];
  usersLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={styles.storeRow} onClick={onToggle}>
        <td>
          <div className={styles.storeName}>{store.name}</div>
          {(store.address || store.phone) && (
            <div className={styles.storeSub}>{[store.address, store.phone].filter(Boolean).join(" · ")}</div>
          )}
        </td>
        <td className={styles.tdNum}>{store.users_count}</td>
        <td className={styles.tdNum}>{store.products_count}</td>
        <td className={styles.tdNum}>{store.services_count}</td>
        <td>
          <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} />
        </td>
      </tr>
      {expanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={5}>
            <div className={styles.usersPanel}>
              <div className={styles.usersTitle}>
                <Users size={14} />
                Usuarios de {store.name}
              </div>
              {usersLoading ? (
                <div className={styles.usersLoading}>
                  <Loader2 size={16} className={styles.spin} />
                  Cargando usuarios…
                </div>
              ) : users.length === 0 ? (
                <div className={styles.empty}>Sin usuarios en esta tienda</div>
              ) : (
                <div className={styles.userList}>
                  {users.map((u) => (
                    <div key={u.id} className={`${styles.userRow} ${u.deleted_at ? styles.userDeleted : ""}`}>
                      <div className={styles.userMain}>
                        <span className={styles.userName}>{u.name}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                        <RoleBadge role={u.role} />
                      </div>
                      <div className={styles.userMeta}>
                        {u.deleted_at ? (
                          <span className={styles.statusBadge} style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                            <UserX size={11} />
                            Eliminado
                          </span>
                        ) : u.email_verified ? (
                          <span className={styles.statusBadge} style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                            <CheckCircle2 size={11} />
                            Verificado
                          </span>
                        ) : (
                          <span className={styles.statusBadge} style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                            <AlertTriangle size={11} />
                            Sin verificar
                          </span>
                        )}
                        <span className={styles.userDate}>
                          {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
