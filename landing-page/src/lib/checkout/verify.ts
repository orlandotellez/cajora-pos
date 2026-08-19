import { readSession, saveSession, type SessionData } from "../session";

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);

let apiUrl = "";

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el: HTMLElement): void {
  el.hidden = true;
}

function syncVerifySubmit(
  submit: HTMLButtonElement | null,
  input: HTMLInputElement | null,
  hint: HTMLElement | null,
): void {
  if (!submit || !input || !hint) return;
  submit.disabled = !input.checkValidity();
  hint.hidden = input.checkValidity();
}

async function sendCode(): Promise<void> {
  const session = readSession();
  if (!session?.email) return;
  const errorEl = $("[data-verify-error]");
  if (errorEl) hideError(errorEl);
  const res = await fetch(`${apiUrl}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: session.email }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "No se pudo enviar el código. Intentalo de nuevo.");
  }
}

export function renderVerifyPanel(session: SessionData | null): void {
  const verified = session?.emailVerified === true;
  const success = $("[data-verify-success]");
  const form = $("[data-verify-form]");
  if (success) success.hidden = !verified;
  if (form) form.hidden = verified;
}

// Prepara el panel de confirmación de correo y (opcionalmente) reenvía el código.
export async function enterVerifyPanel(email: string, autoSend: boolean): Promise<void> {
  const emailLabel = $("[data-verify-email]");
  const errorEl = $("[data-verify-error]");
  const form = $("[data-verify-form]") as HTMLFormElement | null;
  const input = $("[data-verify-input]") as HTMLInputElement | null;
  const submit = $("[data-verify-submit]") as HTMLButtonElement | null;
  const hint = $("[data-verify-hint]");

  if (emailLabel) emailLabel.textContent = email;
  if (errorEl) hideError(errorEl);
  form?.reset();
  if (input) input.value = "";
  syncVerifySubmit(submit, input, hint);

  if (autoSend) {
    try {
      await sendCode();
    } catch (err) {
      const el = $("[data-verify-error]");
      if (el) {
        showError(
          el,
          (err as { message?: string } | null)?.message ?? "No se pudo enviar el código. Intentalo de nuevo.",
        );
      }
    }
  }
}

export function initVerify(opts: {
  apiUrl: string;
  onVerified: (updatedSession: SessionData) => void;
  onNoSession: () => void;
}): void {
  apiUrl = opts.apiUrl;

  const verifyForm = $("[data-verify-form]") as HTMLFormElement | null;
  const verifySubmit = $("[data-verify-submit]") as HTMLButtonElement | null;
  const verifyInput = $("[data-verify-input]") as HTMLInputElement | null;
  const verifyError = $("[data-verify-error]");
  const verifyHint = $("[data-verify-hint]");
  if (!verifyForm || !verifySubmit || !verifyInput || !verifyError || !verifyHint) return;

  syncVerifySubmit(verifySubmit, verifyInput, verifyHint);
  verifyInput.addEventListener("input", () => syncVerifySubmit(verifySubmit, verifyInput, verifyHint));

  [...document.querySelectorAll<HTMLButtonElement>("[data-resend-code]")].forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Enviando...";
      try {
        await sendCode();
        showError(verifyError, "Código reenviado — revisá tu bandeja de entrada.");
      } catch (err) {
        showError(
          verifyError,
          (err as { message?: string } | null)?.message ?? "No se pudo enviar el código.",
        );
      }
      btn.disabled = false;
      btn.textContent = original;
    });
  });

  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(verifyError);
    verifySubmit.disabled = true;
    verifySubmit.textContent = "Verificando...";

    const session = readSession();
    if (!session?.email) {
      opts.onNoSession();
      return;
    }

    try {
      const res = await fetch(`${opts.apiUrl}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: session.email,
          code: verifyInput.value.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        accessToken?: string;
        refreshToken?: string;
        message?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.message ?? "Código incorrecto. Intentalo de nuevo.");
      }

      // El backend rota los tokens al verificar → actualizar la sesión local.
      const updated: SessionData = { ...(readSession() ?? {}), emailVerified: true };
      if (data?.accessToken) updated.accessToken = data.accessToken;
      if (data?.refreshToken) updated.refreshToken = data.refreshToken;
      saveSession(updated);

      opts.onVerified(updated);
    } catch (err) {
      showError(
        verifyError,
        (err as { message?: string } | null)?.message ?? "No se pudo verificar el código.",
      );
      verifySubmit.disabled = false;
      verifySubmit.textContent = "Verificar correo";
    }
  });
}