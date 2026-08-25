import { formatDate } from './format';

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
}

export async function renderBilling(fetchOpts: { headers?: Record<string, string>; credentials?: RequestCredentials }): Promise<void> {
  const billingNext = document.querySelector<HTMLElement>('[data-billing-next]')!;
  const billingNextDate = document.querySelector<HTMLElement>('[data-billing-next-date]')!;
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

    if (data.next_payment_at) {
      billingNext.hidden = false;
      billingNextDate.textContent = formatDate(data.next_payment_at);
    }

    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (payments.length === 0) {
      billingEmpty.hidden = false;
      return;
    }

    billingTable.hidden = false;
    billingBody.innerHTML = '';
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
