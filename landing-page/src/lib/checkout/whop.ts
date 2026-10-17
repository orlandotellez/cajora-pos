// Checkout embebido de Whop (proveedor primario de la suscripción Cloud).
//
// El embed usa Whop Elements con el `plan_...` público del producto: el precio lo
// define el plan del lado de Whop, así que acá no hay API key ni monto.
//
// La habilitación de la suscripción la escribe SOLO el webhook del backend: este
// módulo nunca marca el pago ni da por acreditado nada.

const WHOP_ELEMENTS_URL = "https://cdn.whop.com/elements/amber/elements.js";

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);

interface WhopCheckoutConfig {
  plan: string;
  metadata: { ref: string };
  returnUrl: string;
  onComplete?: () => void;
}

interface WhopCheckoutElement {
  create: (type: string) => { mount: (selector: string) => unknown };
}

interface WhopElementsClient {
  checkout: {
    create: (config: WhopCheckoutConfig) => WhopCheckoutElement;
  };
}

declare global {
  interface Window {
    WhopElements?: () => WhopElementsClient;
  }
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el: HTMLElement): void {
  el.hidden = true;
}

// Whop Elements se inyecta una sola vez. El tag lleva `data-whop-elements` para
// reconocerlo si ya está presente y no agregar un segundo script.
let whopScriptPromise: Promise<void> | null = null;

function loadWhopScript(): Promise<void> {
  if (whopScriptPromise) return whopScriptPromise;

  whopScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-whop-elements]");
    if (existing) return resolve();

    const s = document.createElement("script");
    s.src = WHOP_ELEMENTS_URL;
    s.async = true;
    s.setAttribute("data-whop-elements", "");
    s.onload = () => resolve();
    s.onerror = () => {
      whopScriptPromise = null;
      reject(new Error("No se pudo cargar Whop."));
    };
    document.head.appendChild(s);
  });

  return whopScriptPromise;
}

export interface WhopContext {
  mount: () => Promise<void>;
}

export function createWhop(opts: {
  apiUrl: string;
  planId: string | undefined;
  posBaseUrl: string;
  getToken: () => string | null;
  onReset: () => void;
  onError?: (message: string) => void;
}): WhopContext {
  const isNativeApp = "__TAURI__" in window;

  async function mount(): Promise<void> {
    const whopBlock = $("[data-whop-block]");
    const whopTarget = $("#whop-checkout");
    const whopLoading = $("[data-whop-loading]");
    const whopPending = $("[data-whop-pending]");
    const payError = $("[data-pay-error]");

    if (payError) hideError(payError);
    if (whopPending) whopPending.hidden = true;
    if (whopTarget) whopTarget.hidden = true;
    if (whopBlock) whopBlock.hidden = false;
    if (whopLoading) whopLoading.hidden = false;

    // Sin `plan_...` no se puede embeber: mismo fallback que PayPal sin client id.
    if (!opts.planId) {
      if (whopLoading) whopLoading.hidden = true;
      if (whopTarget) {
        const btn = document.createElement("a");
        btn.className = "btn-primary checkout__submit";
        btn.href = opts.posBaseUrl;
        btn.textContent = "Ir a mi tienda";
        whopTarget.appendChild(btn);
        whopTarget.hidden = false;
      }
      return;
    }

    try {
      // Mismo manejo de auth que paypal.ts: cookies en web, Bearer bajo Tauri.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const fetchOpts: RequestInit = {};
      if (isNativeApp && opts.getToken()) {
        headers.Authorization = `Bearer ${opts.getToken()}`;
      } else if (!isNativeApp) {
        fetchOpts.credentials = "include";
      }

      const intentRes = await fetch(`${opts.apiUrl}/subscriptions/whop/intent`, {
        method: "POST",
        ...fetchOpts,
        headers,
      });
      const intent = (await intentRes.json().catch(() => null)) as {
        planId?: string;
        ref?: string;
        message?: string;
      } | null;

      if (!intentRes.ok) {
        if (intentRes.status === 401 || intentRes.status === 403) {
          opts.onReset();
          return;
        }
        // 422 (plan sin configurar) y 409 (tienda ya suscrita) explican qué pasó.
        throw new Error(intent?.message ?? "No se pudo iniciar el pago.");
      }

      // Sin referencia no se puede vincular la compra a la tienda: montar el embed
      // igual cobraría y dejaría al cliente pagando por algo que nunca se activa.
      if (!intent?.ref) {
        throw new Error("No se pudo iniciar el pago. Intentalo de nuevo.");
      }

      await loadWhopScript();

      const elements = window.WhopElements;
      if (typeof elements !== "function") {
        throw new Error("No se pudo cargar el método de pago. Intentalo de nuevo.");
      }

      // `BASE_URL` respeta el `base` de Astro. Whop agrega `payment` y `status`
      // a esta URL; un paso off-site exitoso vuelve con `status=succeeded`.
      const returnUrl = `${window.location.origin}${import.meta.env.BASE_URL}checkout?whop=1`;

      elements()
        .checkout.create({
          plan: intent?.planId ?? opts.planId,
          metadata: { ref: intent.ref },
          returnUrl,
          // `onComplete` es solo una señal de UI/analítica del navegador y NO es
          // prueba de pago. La suscripción la habilita únicamente el webhook de
          // Whop en el backend (resuelve `metadata.ref` → tienda). Acá nunca se
          // marca el pago.
          onComplete: () => {},
        })
        .create("checkout")
        .mount("#whop-checkout");

      if (whopLoading) whopLoading.hidden = true;
      if (whopTarget) whopTarget.hidden = false;
    } catch (err) {
      const message =
        (err as { message?: string } | null)?.message ?? "No se pudo iniciar el pago.";
      if (whopLoading) whopLoading.hidden = true;
      if (whopBlock) whopBlock.hidden = true;
      if (payError) showError(payError, message);
      opts.onError?.(message);
    }
  }

  return { mount };
}
