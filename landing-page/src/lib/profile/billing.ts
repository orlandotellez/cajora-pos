import { formatDate } from './format';
import { renderCountdown } from './countdown';

const apiUrl = import.meta.env.PUBLIC_API_URL;

interface BillingPayment {
  amount?: number;
  currency?: string;
  paid_at?: string | null;
}

interface BillingData {
  next_payment_at?: string | null;
  payments?: BillingPayment[];
  total_paid?: number;
  currency?: string;
  status?: string;
  days_overdue?: number | null;
  overdue_since?: string | null;
  cancel_at_period_end?: boolean;
}

const OVERDUE_HINT = 'Tu período venció y no pudimos cobrar la renovación.';
const CANCELED_HINT =
  'Tu suscripción está cancelada: mantenés el acceso hasta esa fecha y no se renueva.';
// Copia original del estado vacío: el catch la pisa con el error y, como la tarjeta
// se re-renderiza, hay que poder devolverla a su lugar.
const EMPTY_HINT = 'Todavía no hay cobros. Tu primer pago se registrará acá al activar la suscripción.';

// Evita apilar intervalos si la facturación se vuelve a renderizar.
let stopCountdown: (() => void) | null = null;

export async function renderBilling(fetchOpts: { headers?: Record<string, string>; credentials?: RequestCredentials }): Promise<void> {
  const billingNext = document.querySelector<HTMLElement>('[data-billing-next]')!;
  const billingNextLabel = document.querySelector<HTMLElement>('[data-billing-next-label]')!;
  const billingNextDate = document.querySelector<HTMLElement>('[data-billing-next-date]')!;
  const billingCountdown = document.querySelector<HTMLElement>('[data-billing-countdown]')!;
  const billingLoading = document.querySelector<HTMLElement>('[data-billing-loading]')!;
  const billingEmpty = document.querySelector<HTMLElement>('[data-billing-empty]')!;
  const billingTable = document.querySelector<HTMLElement>('[data-billing-table]')!;
  const billingBody = document.querySelector<HTMLElement>('[data-billing-body]')!;
  const billingTotal = document.querySelector<HTMLElement>('[data-billing-total]')!;
  const billingTotalAmount = document.querySelector<HTMLElement>('[data-billing-total-amount]')!;

  try {
    const res = await fetch(`${apiUrl}/subscriptions/billing`, fetchOpts);
    if (!res.ok) throw new Error('No se pudo cargar la facturación.');
    const data = (await res.json()) as BillingData;

    billingLoading.hidden = true;

    // Esta tarjeta se vuelve a renderizar después de cancelar o reactivar, así que
    // primero se limpia lo que pintó la pasada anterior: si no, quedan restos (el
    // aviso de vencido, las filas viejas o el "todavía no hay cobros").
    billingNext.hidden = true;
    const hint = billingNext.querySelector<HTMLElement>('[data-billing-next-hint]');
    if (hint) {
      hint.hidden = true;
      hint.textContent = '';
    }
    billingEmpty.hidden = true;
    billingEmpty.textContent = EMPTY_HINT;
    billingTable.hidden = true;
    billingBody.innerHTML = '';
    billingTotal.hidden = true;

    stopCountdown?.();
    stopCountdown = null;
    billingCountdown.hidden = true;
    billingCountdown.textContent = '';

    // El backend manda `next_payment_at: null` cuando el período ya venció, y
    // `overdue_since` con la fecha en que terminó. Antes se pintaba esa fecha como
    // "Próxima fecha de pago" aunque fuera un mes vieja.
    const overdue = data.status === 'expired' && Boolean(data.overdue_since);
    if (overdue) {
      billingNext.hidden = false;
      billingNext.classList.add('is-overdue');
      billingNextLabel.textContent = 'Período vencido';
      billingNextDate.textContent = formatDate(data.overdue_since!);
      if (hint) {
        hint.textContent = OVERDUE_HINT;
        hint.hidden = false;
      }
    } else if (data.next_payment_at) {
      billingNext.hidden = false;
      billingNext.classList.remove('is-overdue');
      // Con la cancelación programada la fecha deja de ser una renovación: pasa a ser el
      // fin del ACCESO. La etiqueta y el aviso lo dicen explícitamente, porque una fecha
      // suelta se lee como si la suscripción todavía fuera a renovarse.
      if (data.cancel_at_period_end) {
        billingNextLabel.textContent = 'Acceso hasta';
        if (hint) {
          hint.textContent = CANCELED_HINT;
          hint.hidden = false;
        }
      } else {
        billingNextLabel.textContent = 'Próxima fecha de pago';
      }
      billingNextDate.textContent = formatDate(data.next_payment_at);
      // Solo cuando el cobro está al día: en past_due el texto de la tarjeta ya dice
      // que el pago falló, y anunciar una renovación lo contradiría.
      if (data.status === 'active') {
        stopCountdown = renderCountdown(
          billingCountdown,
          data.next_payment_at,
          data.cancel_at_period_end ? 'cancela' : 'renueva',
        );
      }
    }

    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (payments.length === 0) {
      billingEmpty.hidden = false;
      return;
    }

    billingTable.hidden = false;
    for (const p of payments) {
      const tr = document.createElement('tr');
      const tdDate = document.createElement('td');
      tdDate.textContent = formatDate(p.paid_at);
      const tdConcept = document.createElement('td');
      tdConcept.textContent = 'Suscripción Cloud — mensual';
      const tdAmount = document.createElement('td');
      tdAmount.className = 'profile__billing-align-right profile__billing-amount';
      tdAmount.textContent = `${Number(p.amount).toFixed(2)} ${p.currency}`;
      tr.append(tdDate, tdConcept, tdAmount);
      billingBody.appendChild(tr);
    }

    if (data.total_paid) {
      billingTotal.hidden = false;
      billingTotalAmount.textContent = `${Number(data.total_paid).toFixed(2)} ${data.currency}`;
    }
  } catch (err) {
    billingLoading.hidden = true;
    billingEmpty.hidden = false;
    billingEmpty.textContent =
      err instanceof Error ? err.message : 'No se pudo cargar la facturación.';
  }
}
