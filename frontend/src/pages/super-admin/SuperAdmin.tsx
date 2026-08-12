import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  Store,
  Users,
  Package,
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

/** Iniciales (máx. 2 letras) derivadas del nombre, sin datos extra. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Color determinístico por nombre para los avatares. */
function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function RoleBadge({ role }: { role: string }) {
  const isSuper = role === "super_admin";
  const isAdmin = role === "admin";
  const Icon = isSuper ? Crown : isAdmin ? Shield : ShieldOff;
  const cls = isSuper ? styles.roleSuper : isAdmin ? styles.roleAdmin : styles.roleCashier;
  return (
    <span className={`${styles.roleBadge} ${cls}`}>
      <Icon size={12} />
      {isSuper ? "Super Admin" : isAdmin ? "Admin" : "Cajero"}
    </span>
  );
}

function StatusBadge({ user }: { user: SuperAdminStoreUser }) {
  if (user.deleted_at) {
    return (
      <span className={`${styles.statusBadge} ${styles.statusDeleted}`}>
        <UserX size={11} />
        Eliminado
      </span>
    );
  }
  if (user.email_verified) {
    return (
      <span className={`${styles.statusBadge} ${styles.statusVerified}`}>
        <CheckCircle2 size={11} />
        Verificado
      </span>
    );
  }
  return (
    <span className={`${styles.statusBadge} ${styles.statusUnverified}`}>
      <AlertTriangle size={11} />
      Sin verificar
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>
              <Shield size={18} />
            </span>
            <h1 className={styles.title}>Panel Super Admin</h1>
          </div>
          <p className={styles.subtitle}>Vista global de todas las tiendas y sus métricas</p>
        </div>
        <div className={styles.headerActions}>
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

      {/* Tabla de tiendas */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeading}>
            <span className={styles.cardIcon}>
              <Store size={15} />
            </span>
            <h2 className={styles.cardTitle}>Tiendas</h2>
          </div>
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
                    <td colSpan={5} style={{ padding: "14px 20px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22, borderRadius: 5 }} />
                    </td>
                  </tr>
                ))
                : stores.length === 0
                  ? (
                    <tr>
                      <td colSpan={5}>
                        <div className={styles.empty}>
                          <span className={styles.emptyIcon}>
                            <Store size={22} />
                          </span>
                          <span className={styles.emptyText}>Todavía no hay tiendas registradas</span>
                        </div>
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
  const storeHue = hueFromString(store.name);
  return (
    <>
      <tr
        className={`${styles.storeRow} ${expanded ? styles.storeRowOpen : ""}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <td>
          <div className={styles.storeCell}>
            <span
              className={styles.storeAvatar}
              style={{
                background: `oklch(0.72 0.1 ${storeHue})`,
                color: `oklch(0.22 0.03 ${storeHue})`,
              }}
            >
              {initials(store.name)}
            </span>
            <div className={styles.storeText}>
              <div className={styles.storeName}>{store.name}</div>
              {(store.address || store.phone) && (
                <div className={styles.storeSub}>{[store.address, store.phone].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          </div>
        </td>
        <td className={styles.tdNum}>{store.users_count}</td>
        <td className={styles.tdNum}>{store.products_count}</td>
        <td className={styles.tdNum}>{store.services_count}</td>
        <td className={styles.tdChevron}>
          <span className={`${styles.chevronBtn} ${expanded ? styles.chevronBtnOpen : ""}`}>
            <ChevronDown size={16} />
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={5} className={styles.expandedCell}>
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
                <div className={styles.usersEmpty}>Sin usuarios en esta tienda</div>
              ) : (
                <div className={styles.userList}>
                  {users.map((u) => {
                    const hue = hueFromString(u.name);
                    return (
                      <div key={u.id} className={`${styles.userRow} ${u.deleted_at ? styles.userDeleted : ""}`}>
                        <div className={styles.userInfo}>
                          <span
                            className={styles.userAvatar}
                            style={{
                              background: `oklch(0.72 0.1 ${hue})`,
                              color: `oklch(0.22 0.03 ${hue})`,
                            }}
                          >
                            {initials(u.name)}
                          </span>
                          <div className={styles.userText}>
                            <div className={styles.userName}>{u.name}</div>
                            <div className={styles.userEmail}>{u.email}</div>
                          </div>
                          <RoleBadge role={u.role} />
                        </div>
                        <div className={styles.userMeta}>
                          <StatusBadge user={u} />
                          <span className={styles.userDate}>
                            {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
