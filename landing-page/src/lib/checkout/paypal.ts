import { readSession, saveSession } from "../session";

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);

interface PaypalButtonsOptions {
  fundingSource?: string;
  style?: { label?: string; shape?: string; layout?: string; height?: number };
  createSubscription?: () => Promise<string>;
  onApprove?: (data: { subscriptionID?: string }) => void | Promise<void>;
  onError?: () => void;
  onCancel?: () => void;
}

interface Paypal {
  Buttons?: (options: PaypalButtonsOptions) => { render: (target: string) => Promise<void> };
}

declare global {
  interface Window {
    paypal?: Paypal;
  }
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el: HTMLElement): void {
  el.hidden = true;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar PayPal."));
    document.head.appendChild(s);
  });
}

export interface PaypalContext {
  mount: () => Promise<void>;
  activate: (subscriptionID: string) => Promise<void>;
}

export function createPaypal(opts: {
  apiUrl: string;
  clientId: string | undefined;
  posUrl: string;
  sandbox: boolean;
  getToken: () => string | null;
  onReset: () => void;
  onActivated: (subscriptionID: string) => void;
}): PaypalContext {
  const payButtons = $("[data-pay-buttons]")!;
  const payLoading = $("[data-pay-loading]")!;
  const payError = $("[data-pay-error]")!;

  const isNativeApp = "__TAURI__" in window;

  async function activate(subscriptionID: string): Promise<void> {
    hideError(payError);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const fetchOpts: RequestInit = {};
    if (isNativeApp && opts.getToken()) {
      headers.Authorization = `Bearer ${opts.getToken()}`;
    } else if (!isNativeApp) {
      fetchOpts.credentials = "include";
    }

    try {
      const res = await fetch(`${opts.apiUrl}/subscriptions/activate`, {
        method: "POST",
        ...fetchOpts,
        headers,
        body: JSON.stringify({ paypal_subscription_id: subscriptionID }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        throw new Error(
          data?.message ?? "El pago se acreditó, pero hubo un problema al activar. Nuestro equipo lo revisa.",
        );
      }

      saveSession({ ...(readSession() ?? {}), paid: true });
      opts.onActivated(subscriptionID);
    } catch (err) {
      showError(payError, (err as { message?: string } | null)?.message ?? "");
    }
  }

  async function mount(): Promise<void> {
    payButtons.innerHTML = "";
    payLoading.hidden = false;

    if (!opts.clientId) {
      const btn = document.createElement("a");
      btn.className = "btn-primary checkout__submit";
      btn.href = opts.posUrl;
      btn.textContent = "Ir a mi tienda";
      payButtons.appendChild(btn);
      payLoading.hidden = true;
      return;
    }

    try {
      const checkoutHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const checkoutFetchOpts: RequestInit = {};
      if (isNativeApp && opts.getToken()) {
        checkoutHeaders.Authorization = `Bearer ${opts.getToken()}`;
      } else if (!isNativeApp) {
        checkoutFetchOpts.credentials = "include";
      }

      const checkoutRes = await fetch(`${opts.apiUrl}/subscriptions/checkout`, {
        method: "POST",
        ...checkoutFetchOpts,
        headers: checkoutHeaders,
        body: JSON.stringify({
          return_url: window.location.href,
          cancel_url: window.location.href,
        }),
      });
      const checkoutData = (await checkoutRes.json().catch(() => null)) as {
        paypalSubscriptionId?: string;
        message?: string;
      } | null;

      if (!checkoutRes.ok) {
        if (checkoutRes.status === 401 || checkoutRes.status === 403) {
          opts.onReset();
          return;
        }
        throw new Error(checkoutData?.message ?? "No se pudo iniciar el pago.");
      }

      const paypalSubscriptionId = checkoutData?.paypalSubscriptionId ?? "";

      const sdkUrl = `https://${opts.sandbox ? "www.sandbox.paypal.com" : "www.paypal.com"}/sdk/js?client-id=${encodeURIComponent(opts.clientId)}&intent=subscription&vault=true&currency=USD`;

      await loadScript(sdkUrl);

      const paypal = window.paypal;
      if (!paypal?.Buttons) {
        throw new Error("No se pudo cargar el método de pago. Intentalo de nuevo.");
      }

      const render = (fundingSource: string, targetId: string): Promise<void> => {
        if (!paypal.Buttons) return Promise.resolve();
        return paypal
          .Buttons({
            fundingSource,
            style: { label: "subscribe", shape: "rect", layout: "vertical", height: 45 },
            createSubscription: () => Promise.resolve(paypalSubscriptionId),
            onApprove: async (data) => {
              const subscriptionID = data?.subscriptionID ?? paypalSubscriptionId;
              await activate(subscriptionID);
            },
            onError: () => {
              showError(payError, "Ocurrió un error con PayPal. Intentalo de nuevo.");
            },
            onCancel: () => {
            },
          })
          .render(targetId);
      };

      const cardRender = render("card", "#paypal-buttons");

      const sep = document.createElement("p");
      sep.className = "pay__sep";
      sep.textContent = "o";
      payButtons.appendChild(sep);

      const paypalContainer = document.createElement("div");
      paypalContainer.id = "paypal-buttons-account";
      payButtons.appendChild(paypalContainer);

      const paypalRender = render("paypal", "#paypal-buttons-account");

      // Los botones recién existen cuando .render() resolvió.
      await Promise.all([cardRender, paypalRender]);
      payLoading.hidden = true;
    } catch (err) {
      payLoading.hidden = true;
      showError(payError, (err as { message?: string } | null)?.message ?? "");
    }
  }

  return { mount, activate };
}
