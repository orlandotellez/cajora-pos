import { useEffect, useState } from "react";
import { X, Loader2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { clientsApi, type ClientDetailResponse } from "@/api/clients";
import { creditsApi } from "@/api/credits";
import { money } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import styles from "./ClientDetailModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface ClientDetailModalProps {
  clientId: string;
  onClose: () => void;
  /** Callback para eliminar el cliente. Si no se provee, no se muestra la danger zone. */
  onDelete?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
};

export function ClientDetailModal({ clientId, onClose, onDelete }: ClientDetailModalProps) {
  useModalBack(onClose);
  const currency = usePosStore((s) => s.currency);
  const [client, setClient] = useState<ClientDetailResponse | null>(null);
  const [clientDebt, setClientDebt] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      clientsApi.getById(clientId),
      creditsApi.getClientDebt(clientId).catch(() => null),
    ])
      .then(([clientData, debtData]) => {
        if (!cancelled) {
          setClient(clientData);
          setClientDebt(debtData?.client?.total_debt ?? 0);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Error al cargar el cliente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalle del cliente</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading && (
            <div className={styles.loadingState}>
              <Loader2 size={20} className={styles.spinner} />
              <span>Cargando…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorState}>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && client && (
            <>
              {/* Client Info */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Información</h3>
                <dl className={styles.infoList}>
                  <div className={styles.infoRow}>
                    <dt>Nombre</dt>
                    <dd>{client.name}</dd>
                  </div>
                  {client.phone && (
                    <div className={styles.infoRow}>
                      <dt>Teléfono</dt>
                      <dd>{client.phone}</dd>
                    </div>
                  )}
                  {client.email && (
                    <div className={styles.infoRow}>
                      <dt>Email</dt>
                      <dd>{client.email}</dd>
                    </div>
                  )}
                  {client.address && (
                    <div className={styles.infoRow}>
                      <dt>Dirección</dt>
                      <dd>{client.address}</dd>
                    </div>
                  )}
                  {client.notes && (
                    <div className={styles.infoRow}>
                      <dt>Notas</dt>
                      <dd>{client.notes}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Stats */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Estadísticas</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>{client.sale_count ?? 0}</div>
                    <div className={styles.statLabel}>Compras</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>
                      {money(client.total_spent ?? 0, currency)}
                    </div>
                    <div className={styles.statLabel}>Total gastado</div>
                  </div>
                  <div className={`${styles.statCard} ${clientDebt > 0 ? styles.statCardDebt : ""}`}>
                    <div className={`${styles.statValue} ${clientDebt > 0 ? styles.statValueDebt : ""}`}>
                      {money(clientDebt, currency)}
                    </div>
                    <div className={styles.statLabel}>Deuda pendiente</div>
                  </div>
                </div>
              </section>

              {/* Recent Sales */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Últimas compras</h3>
                {client.recent_sales.length === 0 ? (
                  <p className={styles.emptyText}>Este cliente aún no tiene compras registradas.</p>
                ) : (
                  <div className={styles.salesList}>
                    {client.recent_sales.map((sale) => {
                      const allItems = [...sale.items, ...sale.service_items];
                      const isExpanded = expandedSale === sale.id;
                      return (
                        <div key={sale.id} className={styles.saleCard}>
                          <button
                            type="button"
                            className={styles.saleRow}
                            onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                          >
                            <span className={styles.saleArrow}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <span className={styles.saleDate}>{formatDate(sale.created_at)}</span>
                            <span className={styles.salePayment}>{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</span>
                            <span className={styles.saleTotal}>{money(sale.total, currency)}</span>
                          </button>
                          {isExpanded && allItems.length > 0 && (
                            <div className={styles.saleItems}>
                              {sale.items.map((item, i) => (
                                <div key={`p-${i}`} className={styles.saleItem}>
                                  <span className={styles.saleItemName}>{item.quantity}× {item.name}</span>
                                  <span className={styles.saleItemPrice}>{money(item.line_total, currency)}</span>
                                </div>
                              ))}
                              {sale.service_items.map((item, i) => (
                                <div key={`s-${i}`} className={styles.saleItem}>
                                  <span className={styles.saleItemName}>{item.quantity}× {item.name}</span>
                                  <span className={styles.saleItemPrice}>{money(item.line_total, currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {onDelete && (
            <section className={styles.dangerZone}>
              <h3 className={styles.dangerTitle}>Zona de peligro</h3>
              <p className={styles.dangerHint}>
                Eliminar este cliente es una acción permanente y no se puede deshacer.
              </p>
              <button onClick={onDelete} className={styles.dangerBtn}>
                <Trash2 size={14} />
                Eliminar cliente
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
