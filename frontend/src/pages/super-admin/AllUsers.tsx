import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  Loader2,
  Star,
  AlertTriangle,
  Search,
  ShieldCheck,
  Ban,
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
  const [page, setPage] = useState(0);
  const limit = 10;

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

  // El switch de acceso es del super admin: no lo toca el dueño de la tienda.
  // Se actualiza local para que el select responda al instante y se revierte si
  // el backend rechaza.
  const handleAccessChange = useCallback(
    async (userId: string, accessStatus: "enabled" | "restricted") => {
      const previous = users;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, access_status: accessStatus } : u)),
      );
      try {
        await superAdminApi.updateUserAccess(userId, accessStatus);
      } catch (err) {
        setUsers(previous);
        setError((err as Error)?.message || "No se pudo cambiar el acceso");
      }
    },
    [users],
  );

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageUsers = filtered.slice(page * limit, page * limit + limit);

  return (
    <>
      <div className={styles.sectionActions}>
        <div className={styles.searchBox}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o tienda…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
                <th>Acceso</th>
                <th className={styles.thNum}>Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: "14px 20px" }}>
                      <div className={styles.skeleton} style={{ width: "100%", height: 22, borderRadius: 5 }} />
                    </td>
                  </tr>
                ))
                : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
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
                ) : pageUsers.map((u) => {
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
                      <td>
                        <AccessSelect
                          userId={u.id}
                          role={u.role}
                          accessStatus={u.access_status ?? "enabled"}
                          disabled={!!u.deleted_at}
                          onChange={handleAccessChange}
                        />
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

/**
 * Select de acceso a la plataforma. Escribe `access_status` vía el endpoint del
 * super admin, no el `is_active` que maneja el dueño de la tienda.
 *
 * Los super admins se muestran deshabilitados: la restricción no aplica a quien
 * administra la plataforma (el backend también lo rechaza con 409).
 */
function AccessSelect({
  userId,
  role,
  accessStatus,
  disabled,
  onChange,
}: {
  userId: string;
  role: string;
  accessStatus: "enabled" | "restricted";
  disabled: boolean;
  onChange: (userId: string, accessStatus: "enabled" | "restricted") => void;
}) {
  const [changing, setChanging] = useState(false);

  const handleChange = async (next: string) => {
    if (next === accessStatus) return;
    setChanging(true);
    try {
      await onChange(userId, next as "enabled" | "restricted");
    } finally {
      setChanging(false);
    }
  };

  if (role === "super_admin") {
    return <span className={styles.userDate}>—</span>;
  }

  return (
    // El <select> nativo no puede renderizar componentes dentro de sus <option>
    // (solo texto), así que el icono va al lado y refleja el valor actual.
    <span className={styles.selectWithIcon}>
      {accessStatus === "enabled" ? (
        <ShieldCheck size={13} className={styles.stateIcon_enabled} />
      ) : (
        <Ban size={13} className={styles.stateIcon_restricted} />
      )}
      <select
        className={`${styles.statusSelect} ${styles.accessSelect} ${styles[`accessSelect_${accessStatus}`] ?? ""}`}
        value={accessStatus}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={changing || disabled}
        title={disabled ? "Usuario eliminado" : "Restringir o habilitar el acceso a la plataforma"}
      >
        <option value="enabled">Con acceso</option>
        <option value="restricted">Sin acceso</option>
      </select>
    </span>
  );
}
