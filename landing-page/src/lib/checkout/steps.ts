import { readSession, saveSession, type SessionData } from "../session";
import { renderVerifyPanel } from "./verify";

let currentStep = 1;

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

// Un paso es alcanzable si el usuario completó los anteriores.
export function canVisit(step: number, session: SessionData | null): boolean {
  if (step === 1) return true;
  if (!session?.accessToken) return false;
  if (step === 2) return true;
  if (step === 3) return session.emailVerified === true;
  if (step === 4) return session.paid === true;
  return false;
}

export function getCurrentStep(): number {
  return currentStep;
}

export function setStep(target: number, session: SessionData | null): number {
  let current = target;
  if (!canVisit(current, session)) {
    // Paso no alcanzable → volver al paso visitable más alto.
    for (let n = current; n >= 1; n--) {
      if (canVisit(n, session)) {
        current = n;
        break;
      }
    }
  }

  $$("[data-step-panel]").forEach((el) => {
    el.hidden = el.dataset.stepPanel !== String(current);
  });
  if (current === 1) {
    const loginPanel = $("[data-login-panel]");
    const registerPanel = $("[data-register-form]")?.closest<HTMLElement>("[data-step-panel]");
    if (loginPanel) loginPanel.hidden = true;
    if (registerPanel) registerPanel.hidden = false;
  }
  if (current === 2) {
    renderVerifyPanel(readSession());
  }

  $$("[data-step]").forEach((el) => {
    const n = Number(el.dataset.step);
    const reachable = canVisit(n, session);
    el.classList.toggle("is-active", n === current);
    el.classList.toggle("is-done", n < current);
    el.classList.toggle("is-clickable", n !== current && reachable);
    el.setAttribute("aria-current", n === current ? "step" : "false");
  });

  // Persistir el paso más lejano alcanzado (para resume tras recarga).
  const persisted = readSession();
  if (persisted?.accessToken && current > (persisted.maxStep ?? 1)) {
    saveSession({ ...persisted, maxStep: current });
  }

  currentStep = current;
  return current;
}

// Navegación entre pasos completados (retroceder/avanzar).
export function initStepsNavigation(opts: { onEnterPay: () => void }): void {
  $$("[data-step]").forEach((el) => {
    el.addEventListener("click", () => {
      const n = Number(el.dataset.step);
      const session = readSession();
      if (n === currentStep || !canVisit(n, session)) return;
      setStep(n, session);
      if (n === 3) opts.onEnterPay();
    });
  });
}