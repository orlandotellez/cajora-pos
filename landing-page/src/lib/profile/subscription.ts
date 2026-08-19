import { formatDate, daysLeft } from './format';

export interface Subscription {
  plan: string;
  status: string;
  mode?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

const apiUrl = import.meta.env.PUBLIC_API_URL;
const posUrl = import.meta.env.PUBLIC_POS_URL;
const checkoutUrl = import.meta.env.BASE_URL + 'checkout';

function setBadge(label: string, cls: string): void {
  const badge = document.querySelector<HTMLElement>('[data-profile-badge]')!;
  badge.textContent = label;
  badge.className = `profile__badge ${cls}`;
  badge.hidden = false;
}

export function renderSub(sub: Subscription): void {
  const planEl = document.querySelector<HTMLElement>('[data-profile-plan]')!;
  const textEl = document.querySelector<HTMLElement>('[data-profile-text]')!;
  const ctaEl = document.querySelector<HTMLAnchorElement>('[data-profile-cta]')!;
  const payLinkEl = document.querySelector<HTMLAnchorElement>('[data-profile-pay]')!;
  const rowPeriodEl = document.querySelector<HTMLElement>('[data-profile-row-period]')!;
  const periodLabelEl = document.querySelector<HTMLElement>('[data-profile-period-label]')!;
  const periodValueEl = document.querySelector<HTMLElement>('[data-profile-period]')!;
  const rowTrialEl = document.querySelector<HTMLElement>('[data-profile-row-trial]')!;
  const trialValueEl = document.querySelector<HTMLElement>('[data-profile-trial]')!;
  const rowCancelEl = document.querySelector<HTMLElement>('[data-profile-row-cancel]')!;
  const cancelDateEl = document.querySelector<HTMLElement>('[data-profile-cancel-date]')!;
  const dangerCancelEl = document.querySelector<HTMLElement>('[data-danger-cancel]')!;
  const dangerScheduledEl = document.querySelector<HTMLElement>('[data-danger-scheduled]')!;
  const dangerScheduledTextEl = document.querySelector<HTMLElement>('[data-danger-scheduled-text]')!;

  planEl.textContent = sub.plan === 'annual' ? 'Anual' : 'Mensual ($15.99/mes)';
  rowPeriodEl.hidden = sub.status === 'trial';
  rowTrialEl.hidden = sub.status !== 'trial';
  rowCancelEl.hidden = true;
  dangerCancelEl.hidden = true;
  dangerScheduledEl.hidden = true;

  ctaEl.hidden = true;
  payLinkEl.hidden = true;

  switch (sub.status) {
    case 'trial': {
      const days = daysLeft(sub.trial_ends_at);
      trialValueEl.textContent = `${formatDate(sub.trial_ends_at)} (${days} día${days === 1 ? '' : 's'} restantes)`;
      setBadge('Prueba gratis', 'is-trial');
      textEl.textContent =
        'Tu prueba está activa. Al suscribirte pagás $15.99/mes y podés cancelar cuando quieras.';
      payLinkEl.hidden = false;
      break;
    }
    case 'active': {
      // Sin fila de suscripción el backend devuelve un default
      // { mode: "self_hosted", status: "active" } (subscription.service
      // getByStore) — NO es una suscripción real. Distinguirlo evita
      // mostrar un falso "Activa" a una tienda que nunca pagó.
      if (sub.mode === 'self_hosted') {
        rowPeriodEl.hidden = true;
        setBadge('Sin suscripción Cloud', 'is-self-hosted');
        textEl.textContent =
          'No tenés una suscripción Cloud activa. Activá tu plan para empezar a usar la nube.';
        payLinkEl.hidden = false;
        break;
      }
      periodLabelEl.textContent = 'Próxima renovación';
      periodValueEl.textContent = formatDate(sub.current_period_end);
      setBadge('Activa', 'is-active');
      if (sub.cancel_at_period_end) {
        textEl.textContent =
          'Tu suscripción se cancelará al final del período pagado. Seguís con acceso hasta esa fecha.';
        cancelDateEl.textContent = formatDate(sub.current_period_end);
        rowCancelEl.hidden = false;
        dangerScheduledTextEl.textContent =
          `Se cancelará el ${formatDate(sub.current_period_end)}. ¿Cambiaste de opinión?`;
        dangerScheduledEl.hidden = false;
      } else {
        textEl.textContent =
          'Tu suscripción está activa. Podés cancelarla cuando quieras (sigue activa hasta fin de mes).';
        dangerCancelEl.hidden = false;
      }
      ctaEl.hidden = false;
      ctaEl.textContent = 'Ir a mi tienda';
      ctaEl.href = posUrl;
      break;
    }
    case 'past_due': {
      periodLabelEl.textContent = 'Próxima renovación';
      periodValueEl.textContent = formatDate(sub.current_period_end);
      setBadge('Pago pendiente', 'is-past-due');
      textEl.textContent =
        'Hubo un problema con el cobro. Revisá tu método de pago para no perder el acceso.';
      ctaEl.hidden = false;
      ctaEl.textContent = 'Revisar pago';
      ctaEl.href = checkoutUrl;
      break;
    }
    case 'canceled':
    case 'expired': {
      setBadge(sub.status === 'canceled' ? 'Cancelada' : 'Vencida', 'is-canceled');
      textEl.textContent =
        'Tu suscripción no está activa. Volvé a suscribirte para seguir usando el modo Cloud.';
      ctaEl.hidden = false;
      ctaEl.textContent = 'Suscribirme de nuevo';
      ctaEl.href = checkoutUrl;
      break;
    }
    default:
      setBadge('—', 'is-trial');
      textEl.textContent = 'No se pudo determinar el estado.';
  }
}

export function initSubscriptionActions(authHeaders: Record<string, string>): void {
  const cancelBtn = document.querySelector<HTMLElement>('[data-profile-cancel]')!;
  cancelBtn.addEventListener('click', async () => {
    if (
      !window.confirm(
        '¿Cancelar tu suscripción? Se cancelará al final del período ya pagado y seguirás con acceso hasta esa fecha.',
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/subscriptions/cancel`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('No se pudo cancelar la suscripción.');
      renderSub((await res.json()) as Subscription);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo cancelar la suscripción.');
    }
  });

  const reactivateBtn = document.querySelector<HTMLElement>('[data-profile-reactivate]')!;
  reactivateBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`${apiUrl}/subscriptions/reactivate`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('No se pudo reactivar la suscripción.');
      renderSub((await res.json()) as Subscription);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo reactivar la suscripción.');
    }
  });
}