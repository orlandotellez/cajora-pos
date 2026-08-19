import { useAuth } from "@/context/AuthContext";
import { usePaywallStore } from "@/store/paywallStore";
import { openCheckout } from "@/lib/checkout-url";
import { Lock, CreditCard, LogOut, ArrowUpRight } from "lucide-react";
import styles from "./PaywallOverlay.module.css";

/**
 * Muro de pago global.
 *
 * Aparece cuando el backend responde 402 Payment Required (licenseGuard):
 * la suscripción Cloud no está activa (estado pending, vencida o cancelada).
 * El pago vive en la landing page (/checkout) — este overlay solo guía al
 * usuario hacia ahí y le permite cerrar sesión si quiere cambiar de cuenta.
 */
export function PaywallOverlay() {
  const open = usePaywallStore((s) => s.open);
  const message = usePaywallStore((s) => s.message);
  const closePaywall = usePaywallStore((s) => s.closePaywall);
  const { logout } = useAuth();

  if (!open) return null;

  async function handlePay() {
    try {
      await openCheckout();
    } finally {
      closePaywall();
    }
  }

  async function handleLogout() {
    closePaywall();
    await logout();
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className={styles.card}>
        <div className={styles.icon}>
          <Lock size={28} />
        </div>
        <h2 id="paywall-title" className={styles.title}>Suscripción requerida</h2>
        <p className={styles.subtitle}>
          {message || "Tu suscripción Cloud no está activa."}
        </p>

        <ul className={styles.features}>
          <li>
            <CreditCard size={16} />
            <span>Activá tu suscripción en la web en menos de un minuto</span>
          </li>
          <li>
            <CreditCard size={16} />
            <span>$15.99/mes · cancelá cuando quieras</span>
          </li>
        </ul>

        <button type="button" className={styles.payButton} onClick={handlePay}>
          <CreditCard size={18} />
          Activar suscripción
          <ArrowUpRight size={16} className={styles.payButtonArrow} />
        </button>

        <button type="button" className={styles.logoutButton} onClick={handleLogout}>
          <LogOut size={16} />
          Cerrar sesión y cambiar de cuenta
        </button>
      </div>
    </div>
  );
}