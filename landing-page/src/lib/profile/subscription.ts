import { formatDate } from './format';
import { renderCountdown } from './countdown';

export interface Subscription {
  plan: string;
  status: string;
  mode?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  days_overdue?: number | null;
  grace_ends_at?: string | null;
}

/**
 * El backend ya resuelve el estado contra el reloj, así que `status === 'active'`
 * implica período vigente y `status === 'expired'` implica período vencido. Esta capa
 * no vuelve a calcular fechas: siaguera muestra "próxima" algo que ya pasó.
 */
function overdueCopy(daysOverdue: number | null, periodEnd: string | null): string {
  const when = periodEnd ? ` el ${formatDate(periodEnd)}` : '';
  const since = daysOverdue && daysOverdue > 0 ? ` (hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'})` : '';
  return `Tu período venció${when}${since} y no pudimos cobrar la renovación. Regularizá el pago para volver a usar el modo Cloud.`;
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

// `renderSub` se vuelve a llamar tras cancelar o reactivar: sin limpiar el intervalo
// anterior se apilan timers y el texto oscila entre "renueva" y "cancela".
let stopCountdown: (() => void) | null = null;

export function renderSub(sub: Subscription): void {
  const planEl = document.querySelector<HTMLElement>('[data-profile-plan]')!;
  const textEl = document.querySelector<HTMLElement>('[data-profile-text]')!;
  const ctaEl = document.querySelector<HTMLAnchorElement>('[data-profile-cta]')!;
  const payLinkEl = document.querySelector<HTMLAnchorElement>('[data-profile-pay]')!;
  const rowPeriodEl = document.querySelector<HTMLElement>('[data-profile-row-period]')!;
  const periodLabelEl = document.querySelector<HTMLElement>('[data-profile-period-label]')!;
  const periodValueEl = document.querySelector<HTMLElement>('[data-profile-period]')!;
  const countdownEl = document.querySelector<HTMLElement>('[data-profile-countdown]')!;
  const rowCancelEl = document.querySelector<HTMLElement>('[data-profile-row-cancel]')!;
  const cancelDateEl = document.querySelector<HTMLElement>('[data-profile-cancel-date]')!;
  const dangerCancelEl = document.querySelector<HTMLElement>('[data-danger-cancel]')!;
  const dangerScheduledEl = document.querySelector<HTMLElement>('[data-danger-scheduled]')!;
  const dangerScheduledTextEl = document.querySelector<HTMLElement>('[data-danger-scheduled-text]')!;

  planEl.textContent = sub.plan === 'annual' ? 'Anual' : 'Mensual ($15.99/mes)';
  rowPeriodEl.hidden = sub.status === 'pending';
  rowCancelEl.hidden = true;
  dangerCancelEl.hidden = true;
  dangerScheduledEl.hidden = true;

  ctaEl.hidden = true;
  ctaEl.target = '_self';
  ctaEl.rel = '';
  payLinkEl.hidden = true;

  stopCountdown?.();
  stopCountdown = null;
  countdownEl.hidden = true;
  countdownEl.textContent = '';

  switch (sub.status) {
    case 'pending': {
      setBadge('Pendiente de pago', 'is-past-due');
      textEl.textContent =
        'Tu suscripción está pendiente. Completá el pago para activar tu tienda.';
      payLinkEl.hidden = false;
      break;
    }
    case 'active': {
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
      // Si la cancelación ya está programada, la fecha deja de ser una renovación.
      stopCountdown = renderCountdown(
        countdownEl,
        sub.current_period_end,
        sub.cancel_at_period_end ? 'cancela' : 'renueva',
      );
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
      ctaEl.target = '_blank';
      ctaEl.rel = 'noopener';
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
      if (sub.status === 'canceled') {
        textEl.textContent =
          'Tu suscripción no está activa. Volvé a suscribirte para seguir usando el modo Cloud.';
        ctaEl.textContent = 'Suscribirme de nuevo';
      } else {
        periodLabelEl.textContent = 'Período vencido';
        periodValueEl.textContent = formatDate(sub.current_period_end);
        rowPeriodEl.hidden = false;
        textEl.textContent = overdueCopy(sub.days_overdue ?? null, sub.current_period_end ?? null);
        ctaEl.textContent = 'Regularizar mi pago';
      }
      ctaEl.hidden = false;
      ctaEl.href = checkoutUrl;
      break;
    }
    default:
      setBadge('—', 'is-self-hosted');
      textEl.textContent = 'No se pudo determinar el estado.';
  }
}

export function initSubscriptionActions(fetchOpts: { headers?: Record<string, string>; credentials?: RequestCredentials }): void {
  const cancelBtn = document.querySelector<HTMLElement>('[data-profile-cancel]')!;
  const cancelDialog = document.querySelector<HTMLDialogElement>('[data-cancel-dialog]')!;
  const cancelDismiss = document.querySelector<HTMLElement>('[data-cancel-dismiss]')!;
  const cancelConfirm = document.querySelector<HTMLElement>('[data-cancel-confirm]')!;

  cancelBtn.addEventListener('click', () => {
    cancelDialog.showModal();
  });
  cancelDismiss.addEventListener('click', () => {
    cancelDialog.close();
  });
  // Cerrar al hacer click fuera del dialog (en el backdrop)
  cancelDialog.addEventListener('click', (e) => {
    if (e.target === cancelDialog) cancelDialog.close();
  });
  cancelConfirm.addEventListener('click', async () => {
    cancelDialog.close();
    try {
      const res = await fetch(`${apiUrl}/subscriptions/cancel`, {
        method: 'POST',
        ...fetchOpts,
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
        ...fetchOpts,
      });
      if (!res.ok) throw new Error('No se pudo reactivar la suscripción.');
      renderSub((await res.json()) as Subscription);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo reactivar la suscripción.');
    }
  });
}
