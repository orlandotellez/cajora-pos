import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  subscriptionsApi,
  type SubscriptionMine,
  type SubscriptionBilling,
} from "@/api/subscriptions";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import { openCheckout } from "@/lib/checkout-url";
import styles from "./Subscription.module.css";

type ConfirmAction = "cancel" | "reactivate" | "logout" | null;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface SubView {
  badgeLabel: string;
  badgeClass: string;
  statusText: string;
  showPeriod: boolean;
  showCancelRow: boolean;
  cancelDate: string | null;
  cta: { label: string; to: string } | null;
  payLink: boolean;
  dangerCancel: boolean;
  dangerScheduled: boolean;
  dangerScheduledText: string;
}

function viewFor(mine: SubscriptionMine): SubView {
  switch (mine.status) {
    case "pending":
      return {
        badgeLabel: "Pendiente de pago",
        badgeClass: "is-past-due",
        statusText: "Tu suscripción está pendiente. Completá el pago para activar tu tienda.",
        showPeriod: false,
        showCancelRow: false,
        cancelDate: null,
        cta: null,
        payLink: true,
        dangerCancel: false,
        dangerScheduled: false,
        dangerScheduledText: "",
      };
    case "active":
      if (mine.mode === "self_hosted") {
        return {
          badgeLabel: "Sin suscripción Cloud",
          badgeClass: "is-self-hosted",
          statusText:
            "No tenés una suscripción Cloud activa. Activá tu plan para empezar a usar la nube.",
          showPeriod: false,
          showCancelRow: false,
          cancelDate: null,
          cta: null,
          payLink: true,
          dangerCancel: false,
          dangerScheduled: false,
          dangerScheduledText: "",
        };
      }
      if (mine.cancel_at_period_end) {
        return {
          badgeLabel: "Activa",
          badgeClass: "is-active",
          statusText:
            "Tu suscripción se cancelará al final del período pagado. Seguís con acceso hasta esa fecha.",
          showPeriod: true,
          showCancelRow: true,
          cancelDate: mine.current_period_end,
          cta: { label: "Ir a mi tienda", to: "/pos" },
          payLink: false,
          dangerCancel: false,
          dangerScheduled: true,
          dangerScheduledText: `Se cancelará el ${formatDate(mine.current_period_end)}. ¿Cambiaste de opinión?`,
        };
      }
      return {
        badgeLabel: "Activa",
        badgeClass: "is-active",
        statusText:
          "Tu suscripción está activa. Podés cancelarla cuando quieras (sigue activa hasta fin de mes).",
        showPeriod: true,
        showCancelRow: false,
        cancelDate: null,
        cta: { label: "Ir a mi tienda", to: "/pos" },
        payLink: false,
        dangerCancel: true,
        dangerScheduled: false,
        dangerScheduledText: "",
      };
    case "past_due":
      return {
        badgeLabel: "Pago pendiente",
        badgeClass: "is-past-due",
        statusText:
          "Hubo un problema con el cobro. Revisá tu método de pago para no perder el acceso.",
        showPeriod: true,
        showCancelRow: false,
        cancelDate: null,
        cta: { label: "Revisar pago", to: "" },
        payLink: false,
        dangerCancel: false,
        dangerScheduled: false,
        dangerScheduledText: "",
      };
    case "canceled":
    case "expired":
      return {
        badgeLabel: mine.status === "canceled" ? "Cancelada" : "Vencida",
        badgeClass: "is-canceled",
        statusText:
          "Tu suscripción no está activa. Volvé a suscribirte para seguir usando el modo Cloud.",
        showPeriod: true,
        showCancelRow: false,
        cancelDate: null,
        cta: { label: "Suscribirme de nuevo", to: "" },
        payLink: false,
        dangerCancel: false,
        dangerScheduled: false,
        dangerScheduledText: "",
      };
    default:
      return {
        badgeLabel: "—",
        badgeClass: "is-self-hosted",
        statusText: "No se pudo determinar el estado.",
        showPeriod: false,
        showCancelRow: false,
        cancelDate: null,
        cta: null,
        payLink: false,
        dangerCancel: false,
        dangerScheduled: false,
        dangerScheduledText: "",
      };
  }
}

export default function Subscription() {
  useAdminGuard();
  const { user, logout } = useAuth();

  if (user && !user.is_owner) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Suscripción</h1>
        <div className={styles.errorBox}>
          <p className={styles.errorText}>Solo el propietario de la tienda puede gestionar la suscripción.</p>
        </div>
      </div>
    );
  }

  const [mine, setMine] = useState<SubscriptionMine | null>(null);
  const [billing, setBilling] = useState<SubscriptionBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([subscriptionsApi.mine(), subscriptionsApi.billing()])
      .then(([m, b]) => {
        if (cancelled) return;
        setMine(m);
        setBilling(b);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar tu suscripción.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const [m, b] = await Promise.all([subscriptionsApi.mine(), subscriptionsApi.billing()]);
      setMine(m);
      setBilling(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar tu suscripción.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === "cancel") {
        setMine(await subscriptionsApi.cancel());
      } else if (confirm === "reactivate") {
        setMine(await subscriptionsApi.reactivate());
      } else {
        logout();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const view = mine ? viewFor(mine) : null;
  const planLabel = "Mensual ($15.99/mes)";
  const payments = billing?.payments ?? [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Suscripción</h1>

      {loading && <p className={styles.note}>Consultando tu suscripción…</p>}

      {!loading && error && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button type="button" className={styles.retryButton} onClick={handleRetry}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && mine && view && (
        <>
          {/* Suscripción */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Suscripción</h2>

            <span className={`${styles.badge} ${styles[view.badgeClass]}`}>
              {view.badgeLabel}
            </span>

            <dl className={styles.list}>
              <div className={styles.row}>
                <dt>Plan</dt>
                <dd>{planLabel}</dd>
              </div>
              <div className={styles.row}>
                <dt>Precio</dt>
                <dd>$15.99/mes</dd>
              </div>
              {view.showPeriod && (
                <div className={styles.row}>
                  <dt>Próxima renovación</dt>
                  <dd>{formatDate(mine.current_period_end)}</dd>
                </div>
              )}
              {view.showCancelRow && (
                <div className={styles.row}>
                  <dt>Cancelación</dt>
                  <dd>{formatDate(view.cancelDate)}</dd>
                </div>
              )}
            </dl>

            <p className={styles.statusText}>{view.statusText}</p>

            <div className={styles.actions}>
              {view.cta &&
                (view.cta.to ? (
                  <Link to={view.cta.to} className={styles.primaryButton}>
                    {view.cta.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void openCheckout()}
                  >
                    {view.cta.label}
                  </button>
                ))}
              {view.payLink && (
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => void openCheckout()}
                >
                  Pagar ahora — $15.99/mes
                </button>
              )}
            </div>
          </section>

          {/* Facturación */}
          <section className={`${styles.card} ${styles.billing}`} aria-label="Facturación">
            <h2 className={styles.cardTitle}>Facturación</h2>
            <p className={styles.billingNote}>
              Cobros mensuales de tu suscripción Cloud. Acá ves cuándo se pagó cada mes y cuándo
              vence el período actual.
            </p>

            {billing?.next_payment_at && (
              <div className={styles.billingNext}>
                <span className={styles.billingNextLabel}>Próxima fecha de pago</span>
                <strong>{formatDate(billing.next_payment_at)}</strong>
              </div>
            )}

            {payments.length === 0 ? (
              <p className={styles.billingNote}>
                Todavía no hay cobros. Tu primer pago se registrará acá al activar la suscripción.
              </p>
            ) : (
              <>
                <table className={styles.billingTable}>
                  <thead>
                    <tr>
                      <th>Fecha de pago</th>
                      <th>Concepto</th>
                      <th className={styles.alignRight}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.paid_at)}</td>
                        <td>Suscripción Cloud — mensual</td>
                        <td className={`${styles.alignRight} ${styles.amount}`}>
                          {Number(p.amount).toFixed(2)} {p.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={styles.billingTotal}>
                  Total pagado:{" "}
                  <strong>
                    {Number(billing?.total_paid ?? 0).toFixed(2)} {billing?.currency}
                  </strong>
                </div>
              </>
            )}
          </section>

          {/* Zona de peligro */}
          <section className={styles.danger} aria-label="Zona de peligro">
            <h2 className={styles.dangerTitle}>Zona de peligro</h2>

            {view.dangerCancel && (
              <div className={styles.dangerRow}>
                <div>
                  <p className={styles.dangerName}>Cancelar suscripción</p>
                  <p className={styles.dangerDesc}>
                    Se cancela al final del período ya pagado. Seguís con acceso hasta esa fecha.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={() => setConfirm("cancel")}
                >
                  Cancelar suscripción
                </button>
              </div>
            )}

            {view.dangerScheduled && (
              <div className={styles.dangerRow}>
                <div>
                  <p className={styles.dangerName}>Cancelación programada</p>
                  <p className={styles.dangerDesc}>{view.dangerScheduledText}</p>
                </div>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={() => setConfirm("reactivate")}
                >
                  Reactivar suscripción
                </button>
              </div>
            )}

            <div className={styles.dangerRow}>
              <div>
                <p className={styles.dangerName}>Cerrar sesión</p>
                <p className={styles.dangerDesc}>Cierra tu sesión en este dispositivo.</p>
              </div>
              <button type="button" className={styles.dangerBtn} onClick={() => setConfirm("logout")}>
                Cerrar sesión
              </button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancelar suscripción"
        message="¿Cancelar tu suscripción? Se cancelará al final del período ya pagado y seguirás con acceso hasta esa fecha."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "reactivate"}
        title="Reactivar suscripción"
        message="Se va a reabrir el flujo de pago. La suscripción queda pendiente hasta que completes el pago."
        confirmLabel="Sí, reactivar"
        cancelLabel="Volver"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "logout"}
        title="Cerrar sesión"
        message="¿Seguro que querés cerrar sesión?"
        confirmLabel="Sí, salir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {busy && <div className={styles.busyOverlay}>…</div>}
    </div>
  );
}
