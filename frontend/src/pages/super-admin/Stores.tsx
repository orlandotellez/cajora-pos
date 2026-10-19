import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  Loader2,
  Star,
  AlertTriangle,
  X,
  MapPin,
  Phone,
  Mail,
  Tag,
  Boxes,
  Wrench,
  Calendar,
  CreditCard,
  Crown,
} from "lucide-react";
import {
  superAdminApi,
  type SuperAdminStoreRow,
  type SuperAdminStoreUser,
} from "@/api/super-admin";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PAGE_LIMIT } from "@/lib/constants";
import { initials, hueFromString } from "./helpers";
import { RoleBadge, UserStatusBadge, SubStatusBadge } from "./Badges";
import styles from "./SuperAdmin.module.css";

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Stores() {
  const [stores, setStores] = useState<SuperAdminStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStore, setSelectedStore] = useState<SuperAdminStoreRow | null>(null);
  const [usersByStore, setUsersByStore] = useState<Record<string, SuperAdminStoreUser[]>>({});
  const [usersLoading, setUsersLoading] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const limit = PAGE_LIMIT;

  // DataTable pagina desde 1; el resto de paneles del producto usa el mismo
  // contrato, así que el panel super admin se alinea con ellos.
  const totalPages = Math.max(1, Math.ceil(stores.length / limit));
  const pageStores = stores.slice((page - 1) * limit, page * limit);

  // Igual que el resto de listados: si la data se achica, no dejamos la
  // paginación apuntando a una página fuera de rango.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

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

  const openStore = useCallback(
    async (store: SuperAdminStoreRow) => {
      setSelectedStore(store);
      if (!usersByStore[store.id]) {
        setUsersLoading((prev) => ({ ...prev, [store.id]: true }));
        try {
          const res = await superAdminApi.getStoreUsers(store.id);
          setUsersByStore((prev) => ({ ...prev, [store.id]: res.users }));
        } catch (err) {
          console.error("Error al cargar usuarios de la tienda:", err);
        } finally {
          setUsersLoading((prev) => ({ ...prev, [store.id]: false }));
        }
      }
    },
    [usersByStore],
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

      <DataTable
        columns={STORE_COLUMNS}
        data={pageStores}
        loading={loading}
        total={stores.length}
        page={page}
        totalPages={totalPages}
        onPageChange={(next) => {
          setSelectedStore(null);
          setPage(next);
        }}
        onRowClick={(s) => void openStore(s)}
        rowClassName={(s) => (selectedStore?.id === s.id ? styles.storeRowOpen : undefined)}
        refreshing={refreshing}
        emptyMessage="Todavía no hay tiendas registradas"
        skeletonCols={STORE_SKELETON_COLS}
      />

      {selectedStore && (
        <StoreDrawer
          store={selectedStore}
          users={usersByStore[selectedStore.id] ?? []}
          usersLoading={!!usersLoading[selectedStore.id]}
          onClose={() => setSelectedStore(null)}
        />
      )}
    </>
  );
}

const STORE_COLUMNS: Column<SuperAdminStoreRow>[] = [
  {
    key: "store",
    label: "Tienda",
    render: (store) => {
      const storeHue = hueFromString(store.name);
      return (
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
              <div className={styles.storeSub}>
                {[store.address, store.phone].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    key: "users",
    label: "Usuarios",
    align: "right",
    render: (store) => <span className={styles.tdNum}>{store.users_count}</span>,
  },
  {
    key: "products",
    label: "Productos",
    align: "right",
    render: (store) => <span className={styles.tdNum}>{store.products_count}</span>,
  },
  {
    key: "services",
    label: "Servicios",
    align: "right",
    render: (store) => <span className={styles.tdNum}>{store.services_count}</span>,
  },
  {
    key: "open",
    label: "",
    align: "right",
    width: "56px",
    render: () => (
      <span className={styles.chevronBtn}>
        <i className={styles.chevronArrow}>›</i>
      </span>
    ),
  },
];

const STORE_SKELETON_COLS = [
  { width: "40%" },
  { width: "56px", align: "right" as const },
  { width: "56px", align: "right" as const },
  { width: "56px", align: "right" as const },
  { width: "28px", align: "right" as const },
];

function StoreDrawer({
  store,
  users,
  usersLoading,
  onClose,
}: {
  store: SuperAdminStoreRow;
  users: SuperAdminStoreUser[];
  usersLoading: boolean;
  onClose: () => void;
}) {
  const storeHue = hueFromString(store.name);

  const infoItems = [
    { icon: MapPin, label: "Dirección", value: store.address || "—" },
    { icon: Phone, label: "Teléfono", value: store.phone || "—" },
    { icon: Mail, label: "Email propietario", value: store.owner_email || "—" },
    { icon: Crown, label: "Propietario", value: store.owner_name || "—" },
    { icon: CreditCard, label: "Plan", value: store.subscription_plan || "—" },
    { icon: Tag, label: "Modo", value: store.subscription_mode || "—" },
  ];

  return (
    <>
      {/* Overlay */}
      <div className={styles.drawerOverlay} onClick={onClose} />

      {/* Panel */}
      <div className={styles.drawer} role="dialog" aria-label={`Detalles de ${store.name}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderStore}>
            <span
              className={styles.storeAvatarLarge}
              style={{
                background: `oklch(0.72 0.1 ${storeHue})`,
                color: `oklch(0.22 0.03 ${storeHue})`,
              }}
            >
              {initials(store.name)}
            </span>
            <div className={styles.drawerTitleWrap}>
              <div className={styles.drawerStoreName}>{store.name}</div>
              {store.subscription_status && (
                <div className={styles.drawerStoreStatus}>
                  <SubStatusBadge status={store.subscription_status} />
                  {store.subscription_cancel_at_period_end && (
                    <span className={styles.cancelNotice}>Se cancela al vencer</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Métricas */}
          <div className={styles.drawerMetricsRow}>
            <DrawerMetric icon={Users} value={String(store.users_count)} label="Usuarios" />
            <DrawerMetric icon={Boxes} value={String(store.products_count)} label="Productos" />
            <DrawerMetric icon={Wrench} value={String(store.services_count)} label="Servicios" />
          </div>

          {/* Datos de negocio */}
          <DrawerSection title="Datos de la tienda">
            <ul className={styles.drawerInfoList}>
              {infoItems.map(({ icon: Icon, label, value }) => (
                <li key={label} className={styles.drawerInfoItem}>
                  <span className={styles.drawerInfoIcon}>
                    <Icon size={15} />
                  </span>
                  <div className={styles.drawerInfoText}>
                    <span className={styles.drawerInfoLabel}>{label}</span>
                    <span className={styles.drawerInfoValue}>{value}</span>
                  </div>
                </li>
              ))}
              <li className={styles.drawerInfoItem}>
                <span className={styles.drawerInfoIcon}>
                  <Calendar size={15} />
                </span>
                <div className={styles.drawerInfoText}>
                  <span className={styles.drawerInfoLabel}>Registrada</span>
                  <span className={styles.drawerInfoValue}>{formatDate(store.created_at)}</span>
                </div>
              </li>
            </ul>
          </DrawerSection>

          {/* Usuarios */}
          <DrawerSection title={`Usuarios (${users.length})`}>
            {usersLoading ? (
              <div className={styles.drawerLoading}>
                <Loader2 size={16} className={styles.spin} />
                Cargando usuarios…
              </div>
            ) : users.length === 0 ? (
              <div className={styles.drawerEmpty}>Sin usuarios en esta tienda</div>
            ) : (
              <div className={styles.drawerUserList}>
                {users.map((u) => {
                  const hue = hueFromString(u.name);
                  return (
                    <div key={u.id} className={`${styles.drawerUserRow} ${u.deleted_at ? styles.userDeleted : ""}`}>
                      <div className={styles.drawerUserMain}>
                        <span
                          className={styles.userAvatar}
                          style={{
                            background: `oklch(0.72 0.1 ${hue})`,
                            color: `oklch(0.22 0.03 ${hue})`,
                          }}
                        >
                          {initials(u.name)}
                        </span>
                        <div className={styles.drawerUserText}>
                          <div className={styles.drawerUserName}>
                            {u.name}
                            {u.is_owner && (
                              <span className={styles.ownerBadge}>
                                <Star size={10} fill="currentColor" /> Propietario
                              </span>
                            )}
                          </div>
                          <div className={styles.userEmail}>{u.email}</div>
                        </div>
                      </div>
                      <div className={styles.drawerUserMeta}>
                        <RoleBadge role={u.role} />
                        <UserStatusBadge user={u} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DrawerSection>
        </div>
      </div>
    </>
  );
}

function DrawerMetric({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; value: string; label: string }) {
  return (
    <div className={styles.drawerMetric}>
      <Icon size={16} className={styles.drawerMetricIcon} />
      <span className={styles.drawerMetricValue}>{value}</span>
      <span className={styles.drawerMetricLabel}>{label}</span>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.drawerSection}>
      <div className={styles.drawerSectionTitle}>{title}</div>
      {children}
    </div>
  );
}
