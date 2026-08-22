import { saveSession } from '../session';

const apiUrl = import.meta.env.PUBLIC_API_URL;
const perfilUrl = import.meta.env.BASE_URL + 'perfil';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  store?: { name?: string } | null;
  user?: { email?: string; email_verified?: boolean; is_owner?: boolean; role?: string } | null;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => null)) as LoginResponse | null;

  if (!res.ok) {
    throw new Error(data?.message ?? "Email o contraseña incorrectos.");
  }
  return data as LoginResponse;
}

export function initLoginForm(): void {
  const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
  const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

  const form = $("[data-login-form]") as HTMLFormElement | null;
  const submit = $("[data-login-submit]") as HTMLButtonElement | null;
  const error = $("[data-login-error]") as HTMLElement | null;

  if (!form || !submit || !error) return;

  // Ojo para mostrar/ocultar contraseña
  $$("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.closest<HTMLElement>(".field-password")?.querySelector<HTMLInputElement>("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      btn.classList.toggle("is-visible", show);
    });
  });

  const syncSubmit = (): void => {
    const fields = [...form.querySelectorAll("input")];
    submit.disabled = !fields.every((el) => el.checkValidity());
  };
  form.addEventListener("input", syncSubmit);
  syncSubmit();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = "Ingresando...";

    const fd = new FormData(form);
    const payload: LoginPayload = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    };

    try {
      const data = await loginUser(payload.email, payload.password);

      // Solo el propietario (owner) de la tienda puede iniciar sesión desde la landing page.
      if (data?.user && !data.user.is_owner && data.user.role !== "super_admin") {
        throw new Error("Solo el propietario de la tienda puede iniciar sesión desde aquí.");
      }

      saveSession({
        accessToken: data?.accessToken,
        refreshToken: data?.refreshToken,
        storeName: data?.store?.name ?? null,
        email: data?.user?.email ?? payload.email,
        emailVerified: data?.user?.email_verified ?? false,
      });
      window.location.href = perfilUrl;
    } catch (err) {
      error.textContent =
        (err as { message?: string } | null)?.message ?? "No se pudo iniciar sesión.";
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = "Iniciar sesión";
    }
  });
}