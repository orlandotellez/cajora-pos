import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  Store,
  Users,
  Loader2,
  Star,
  AlertTriangle,
} from "lucide-react";
import {
  superAdminApi,
  type SuperAdminStoreRow,
  type SuperAdminStoreUser,
} from "@/api/super-admin";
import { initials, hueFromString } from "./helpers";
import { RoleBadge, UserStatusBadge } from "./Badges";
import styles from "./SuperAdmin.module.css";

export default function Stores() {
  const [stores, setStores] = useState<SuperAdminStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usersByStore, setUsersByStore] = useState<Record<string, SuperAdminStoreUser[]>>({});
  const [usersLoading, setUsersLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await superAdminApi.getStores();
      setStores(res.stores);
    } catch (err) {
      setError((err as Error)?.message || "Error al cargar tiendas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <>
      <div className={styles.sectionActions}>
        <span className={styles.cardCount}>{stores.length} tiendas</span>
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
                : stores.length === 0 ? (
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
                ) : stores.map((s) => (
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
    </>
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
                            <div className={styles.userName}>
                              {u.name}
                              {u.is_owner && (
                                <span className={styles.ownerBadge}>
                                  <Star size={10} fill="currentColor" /> Propietario
                                </span>
                              )}
                            </div>
                            <div className={styles.userEmail}>{u.email}</div>
                          </div>
                          <RoleBadge role={u.role} />
                        </div>
                        <div className={styles.userMeta}>
                          <UserStatusBadge user={u} />
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
