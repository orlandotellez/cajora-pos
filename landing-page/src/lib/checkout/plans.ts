const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

export function initPlans(): void {
  const plansModal = $("[data-plans-modal]");
  if (!plansModal) return;

  let lastPlansFocus: Element | null = null;

  const openPlans = (): void => {
    lastPlansFocus = document.activeElement;
    plansModal.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-plans-close]")?.focus();
  };
  const closePlans = (): void => {
    plansModal.hidden = true;
    document.body.style.overflow = "";
    if (lastPlansFocus instanceof HTMLElement) lastPlansFocus.focus();
  };

  $$("[data-plans-open]").forEach((btn) => {
    btn.addEventListener("click", openPlans);
  });
  $$("[data-plans-close]").forEach((btn) => {
    btn.addEventListener("click", closePlans);
  });
  $$("[data-plans-select]").forEach((btn) => {
    btn.addEventListener("click", closePlans);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !plansModal.hidden) closePlans();
  });
}