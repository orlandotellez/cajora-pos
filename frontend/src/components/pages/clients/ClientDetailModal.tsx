import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { clientsApi, type ClientDetailResponse } from "@/api/clients";
import { money } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import styles from "./ClientDetailModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface ClientDetailModalProps {
  clientId: string;
  onClose: () => void;
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

export function ClientDetailModal({ clientId, onClose }: ClientDetailModalProps) {
  useModalBack(onClose);
  const currency = usePosStore((s) => s.currency);
  const [client, setClient] = useState<ClientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    clientsApi
      .getById(clientId)
      .then((data) => {
        if (!cancelled) setClient(data);
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
                </div>
              </section>

              {/* Recent Sales */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Últimas compras</h3>
                {client.recent_sales.length === 0 ? (
                  <p className={styles.emptyText}>Este cliente aún no tiene compras registradas.</p>
                ) : (
                  <table className={styles.salesTable}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Pago</th>
                        <th className={styles.alignRight}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.recent_sales.map((sale) => (
                        <tr key={sale.id}>
                          <td>{formatDate(sale.created_at)}</td>
                          <td>{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</td>
                          <td className={`${styles.alignRight} ${styles.amount}`}>
                            {money(sale.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
