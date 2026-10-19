import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
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
import { DataTable, type Column } from "@/components/common/DataTable";
import { PAGE_LIMIT } from "@/lib/constants";
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
  const [page, setPage] = useState(1);
  const limit = PAGE_LIMIT;

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
  const pageUsers = filtered.slice((page - 1) * limit, page * limit);

  // Igual que el resto de listados: si la data se achica, no dejamos la
  // paginación apuntando a una página fuera de rango.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const columns: Column<UserWithStore>[] = [
    {
      key: "user",
      label: "Usuario",
      render: (u) => {
        const hue = hueFromString(u.name);
        return (
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
        );
      },
    },
    {
      key: "store",
      label: "Tienda",
      render: (u) => <span className={styles.storeName}>{u.store_name}</span>,
    },
    {
      key: "role",
      label: "Rol",
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: "status",
      label: "Estado",
      render: (u) => <UserStatusBadge user={u} />,
    },
    {
      key: "access",
      label: "Acceso",
      render: (u) => (
        <AccessSelect
          userId={u.id}
          role={u.role}
          accessStatus={u.access_status ?? "enabled"}
          disabled={!!u.deleted_at}
          onChange={handleAccessChange}
        />
      ),
    },
    {
      key: "created_at",
      label: "Registro",
      align: "right",
      render: (u) => (
        <span className={styles.userDate}>
          {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className={styles.sectionActions}>
        <div className={styles.searchBox}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o tienda…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

      <DataTable
        columns={columns}
        data={pageUsers}
        loading={loading}
        total={filtered.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowClassName={(u) => (u.deleted_at ? styles.userDeleted : undefined)}
        refreshing={refreshing}
        emptyMessage={search ? "No se encontraron usuarios" : "Todavía no hay usuarios"}
        skeletonCols={[
          { width: "240px" },
          { width: "120px" },
          { width: "90px" },
          { width: "100px" },
          { width: "140px" },
          { width: "90px", align: "right" },
        ]}
      />
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
