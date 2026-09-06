import { saveSession } from "../session";
import { loginUser } from "../auth/login";

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

interface RegisterResponse {
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  store?: { name?: string } | null;
  user?: { email?: string; email_verified?: boolean; is_owner?: boolean; role?: string } | null;
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el: HTMLElement): void {
  el.hidden = true;
}

function mapAuthError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid credentials": "Email o contraseña incorrectos.",
    "Email already registered": "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.",
    "A store with this name already exists": "Ya existe una tienda con ese nombre. Elegí otro nombre.",
    "User not found": "No encontramos una cuenta con ese email.",
    "Account has been deactivated": "La cuenta está desactivada. Contactanos para reactivarla.",
  };
  return map[msg] ?? msg;
}

export function initRegister(opts: {
  apiUrl: string;
  onAuth: (storeName: string | null, email: string, emailVerified: boolean, sendCodeOnEnter: boolean) => void;
  onSummaryChange: (storeName: string | null, email: string | null) => void;
  onToken: (token: string) => void;
}): void {
  const registerForm = $("[data-register-form]") as HTMLFormElement | null;
  const registerSubmit = $("[data-register-submit]") as HTMLButtonElement | null;
  const registerError = $("[data-register-error]");
  const registerHint = $("[data-register-hint]");
  const loginForm = $("[data-login-form]") as HTMLFormElement | null;
  const loginPanel = $("[data-login-panel]");
  const loginError = $("[data-login-error]");
  const registerPanel = registerForm?.closest<HTMLElement>("[data-step-panel]");

  if (
    !registerForm ||
    !registerSubmit ||
    !registerError ||
    !registerHint ||
    !loginForm ||
    !loginPanel ||
    !loginError ||
    !registerPanel
  ) {
    return;
  }

  const syncRegisterSubmit = (): void => {
    const fields = [...registerForm.querySelectorAll("input")];
    const valid = fields.every((el) => el.checkValidity());
    registerSubmit.disabled = !valid;
    registerHint.hidden = valid;
  };
  registerForm.addEventListener("input", () => {
    syncRegisterSubmit();
    // Refleja tienda/email en el resumen mientras se escribe.
    const fd = new FormData(registerForm);
    const name = String(fd.get("storeName") ?? "").trim();
    const email = String(fd.get("adminEmail") ?? "").trim();
    opts.onSummaryChange(name || "—", email || "—");
  });
  syncRegisterSubmit();

  // Alternar entre "Crear cuenta" y "Iniciá sesión".
  $$("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      hideError(registerError);
      hideError(loginError);
      const isLogin = btn.dataset.toggle === "login";
      registerPanel.hidden = isLogin;
      loginPanel.hidden = !isLogin;
    });
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(registerError);
    registerSubmit.disabled = true;
    registerSubmit.textContent = "Creando cuenta...";

    const fd = new FormData(registerForm);
    const payload = {
      storeName: String(fd.get("storeName") ?? ""),
      adminName: String(fd.get("adminName") ?? ""),
      adminEmail: String(fd.get("adminEmail") ?? ""),
      adminPassword: String(fd.get("adminPassword") ?? ""),
    };

    const isNativeApp = "__TAURI__" in window;

    try {
      const res = await fetch(`${opts.apiUrl}/auth/register-store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: isNativeApp ? undefined : "include",
      });
      const data = (await res.json().catch(() => null)) as RegisterResponse | null;

      if (!res.ok) {
        const raw = data?.message ?? "";
        const msg = mapAuthError(raw);
        if (res.status === 409 && raw === "Email already registered") {
          // El email ya tiene cuenta → pasamos a login con el email precargado
          // y un mensaje visible que explica por qué.
          const emailInput = loginForm.querySelector<HTMLInputElement>('input[name="email"]');
          if (emailInput) emailInput.value = payload.adminEmail;
          loginPanel.hidden = false;
          registerPanel.hidden = true;
          showError(loginError, "Ya existe una cuenta con ese email. Iniciá sesión para continuar.");
        } else {
          // Cualquier otro error (incluido conflicto de NOMBRE de tienda) → se muestra
          // en el panel de registro, SIN ocultarlo, y el usuario decide qué hacer.
          showError(registerError, msg || "No se pudo crear la cuenta. Intentalo de nuevo.");
        }
        registerSubmit.disabled = false;
        registerSubmit.textContent = "Crear cuenta y continuar";
        return;
      }

      const body = data as RegisterResponse;
      const emailVerified = body.user?.email_verified ?? false;
      saveSession({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        storeName: body.store?.name ?? payload.storeName,
        email: body.user?.email ?? payload.adminEmail,
        emailVerified,
      });
      if (body.accessToken) opts.onToken(body.accessToken);
      opts.onAuth(
        body.store?.name ?? payload.storeName,
        body.user?.email ?? payload.adminEmail,
        emailVerified,
        false, // el backend ya envió el código al registrar la tienda
      );
    } catch (err) {
      showError(
        registerError,
        mapAuthError((err as { message?: string } | null)?.message ?? "") || "No se pudo crear la cuenta. Intentalo de nuevo.",
      );
      registerSubmit.disabled = false;
      registerSubmit.textContent = "Crear cuenta y continuar";
    }
  });
}

// Login del checkout: panel entrelazado con el de registro, usa loginUser compartido.
export function initCheckoutLogin(opts: {
  apiUrl: string;
  onAuth: (storeName: string | null, email: string, emailVerified: boolean, sendCodeOnEnter: boolean) => void;
  onToken: (token: string) => void;
}): void {
  const loginForm = $("[data-login-form]") as HTMLFormElement | null;
  const loginSubmit = $("[data-login-submit]") as HTMLButtonElement | null;
  const loginError = $("[data-login-error]");
  if (!loginForm || !loginSubmit || !loginError) return;

  const syncLoginSubmit = (): void => {
    const fields = [...loginForm.querySelectorAll("input")];
    loginSubmit.disabled = !fields.every((el) => el.checkValidity());
  };
  loginForm.addEventListener("input", syncLoginSubmit);
  syncLoginSubmit();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(loginError);
    loginSubmit.disabled = true;
    loginSubmit.textContent = "Ingresando...";

    const fd = new FormData(loginForm);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    try {
      const data = await loginUser(email, password);

      // Solo el propietario (owner) de la tienda puede iniciar sesión desde la landing page.
      if (data?.user && !data.user.is_owner && data.user.role !== "super_admin") {
        throw new Error("Solo el propietario de la tienda puede iniciar sesión desde aquí.");
      }

      const emailVerified = data.user?.email_verified ?? false;
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        storeName: data.store?.name ?? null,
        email: data.user?.email ?? email,
        emailVerified,
      });
      if (data.accessToken) opts.onToken(data.accessToken);
      opts.onAuth(
        data.store?.name ?? null,
        data.user?.email ?? email,
        emailVerified,
        true, // el login no envía código → lo enviamos nosotros
      );
    } catch (err) {
      showError(
        loginError,
        mapAuthError((err as { message?: string } | null)?.message ?? "") || "No se pudo iniciar sesión.",
      );
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Iniciar sesión y continuar";
    }
  });

  // ─── Recuperación de contraseña (forgot → reset) ───
  const forgotTrigger = $("[data-forgot-trigger]");
  const forgotPanel = $("[data-forgot-panel]");
  const forgotForm = $("[data-forgot-form]") as HTMLFormElement | null;
  const forgotSubmit = $("[data-forgot-submit]") as HTMLButtonElement | null;
  const forgotError = $("[data-forgot-error]");
  const forgotOk = $("[data-forgot-ok]");

  if (forgotTrigger && forgotPanel && forgotForm && forgotSubmit && forgotError && forgotOk) {
    const currentEmail = (): string => {
      const fd = new FormData(loginForm);
      return String(fd.get("email") ?? "").trim();
    };

    forgotTrigger.addEventListener("click", async () => {
      hideError(forgotError);
      forgotOk.hidden = true;

      const email = currentEmail();
      if (!email) {
        showError(forgotError, "Escribí tu email arriba y volvé a intentarlo.");
        return;
      }

      forgotTrigger.disabled = true;
      forgotTrigger.textContent = "Enviando...";
      try {
        const res = await fetch(`${opts.apiUrl}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "__TAURI__" in window ? undefined : "include",
        });
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        if (!res.ok) {
          throw new Error(data?.message ?? "No se pudo enviar el código.");
        }
        forgotPanel.hidden = false;
        forgotOk.textContent = "Te enviamos un código a tu email. Revisá tu bandeja de entrada.";
        forgotOk.hidden = false;
      } catch (err) {
        showError(
          forgotError,
          (err as { message?: string } | null)?.message ?? "No se pudo enviar el código.",
        );
      } finally {
        forgotTrigger.disabled = false;
        forgotTrigger.textContent = "¿Olvidaste tu contraseña?";
      }
    });

    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError(forgotError);
      forgotOk.hidden = true;
      forgotSubmit.disabled = true;
      forgotSubmit.textContent = "Cambiando...";

      const fd = new FormData(forgotForm);
      const code = String(fd.get("resetCode") ?? "").trim();
      const newPassword = String(fd.get("newPassword") ?? "");

      try {
        const res = await fetch(`${opts.apiUrl}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentEmail(), code, newPassword }),
          credentials: "__TAURI__" in window ? undefined : "include",
        });
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        if (!res.ok) {
          throw new Error(data?.message ?? "No se pudo cambiar la contraseña.");
        }
        forgotPanel.hidden = true;
        forgotOk.textContent = "Contraseña actualizada. Iniciá sesión con tu nueva contraseña.";
        forgotOk.hidden = false;
      } catch (err) {
        showError(
          forgotError,
          mapAuthError((err as { message?: string } | null)?.message ?? "") ||
          "No se pudo cambiar la contraseña. Verificá el código e intentá de nuevo.",
        );
      } finally {
        forgotSubmit.disabled = false;
        forgotSubmit.textContent = "Cambiar contraseña";
      }
    });
  }
}
