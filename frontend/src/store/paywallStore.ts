import { create } from "zustand";

interface PaywallState {
  /** El backend respondió 402 Payment Required → suscripción no activa */
  open: boolean;
  /** Mensaje opcional del backend (ej. "Suscripción vencida...") */
  message: string | null;
  openPaywall: (message?: string | null) => void;
  closePaywall: () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  open: false,
  message: null,
  openPaywall: (message = null) => set({ open: true, message }),
  closePaywall: () => set({ open: false, message: null }),
}));