import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  Loader2,
  Star,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  superAdminApi,
  type SuperAdminStoreRow,
  type SuperAdminStoreUser,
} from "@/api/super-admin";
import { initials, hueFromString } from "./helpers";
import { RoleBadge, UserStatusBadge } from "./Badges";
import styles from "./SuperAdmin.module.css";

interface UserWithStore extends SuperAdminStoreUser {
  store_name: string;
}

export default function AllUsers() {
  const [users, setUsers] = useState<UserWithStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const storesRes = await superAdminApi.getStores();
      const stores: SuperAdminStoreRow[] = storesRes.stores;

      // Cargar usuarios de todas las tiendas en paralelo
      const allUsers: UserWithStore[] = [];
      await Promise.all(
        stores.map(async (store) => {
          try {
            const res = await superAdminApi.getStoreUsers(store.id);
            for (const u of res.users) {
              allUsers.push({ ...u, store_name: store.name });
            }
          } catch {
            // Ignorar errores de tiendas individuales
          }
        }),
      );

      // Ordenar: owner primero, luego admin, luego cajero
      allUsers.sort((a, b) => {
        if (a.is_owner && !b.is_owner) return -1;
        if (!a.is_owner && b.is_owner) return 1;
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return a.name.localeCompare(b.name);
      });

      setUsers(allUsers);
    } catch (err) {
      setError((err as Error)?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.store_name.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className={styles.sectionActions}>
        <div className={styles.searchBox}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o tienda…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <span className={styles.cardCount}>{filtered.length} usuarios</span>
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
                <th>Usuario</th>
                <th>Tienda</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className={styles.thNum}>Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} style={{ padding: "14px 20px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22, borderRadius: 5 }} />
                    </td>
                  </tr>
                ))
                : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className={styles.empty}>
                        <span className={styles.emptyIcon}>
                          <Users size={22} />
                        </span>
                        <span className={styles.emptyText}>
                          {search ? "No se encontraron usuarios" : "Todavía no hay usuarios"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((u) => {
                  const hue = hueFromString(u.name);
                  return (
                    <tr key={u.id} className={u.deleted_at ? styles.userDeleted : ""}>
                      <td>
                        <div className={styles.storeCell}>
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
                                  <Star size={10} fill="currentColor" /> Owner
                                </span>
                              )}
                            </div>
                            <div className={styles.userEmail}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.storeName}>{u.store_name}</span>
                      </td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td>
                        <UserStatusBadge user={u} />
                      </td>
                      <td className={styles.tdNum}>
                        <span className={styles.userDate}>
                          {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
