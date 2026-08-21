import { create } from "zustand";
import { cashRegisterApi, type CashSession } from "@/api/cash-register";

interface CashSessionState {
  openSessions: (CashSession & { cash_so_far: number; expenses_total: number })[];
  canSellCash: boolean;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchStatus: (force?: boolean) => Promise<void>;
  hasOpenSessionFor: (userId: string) => boolean;
  clear: () => void;
}

const STALE_MS = 30_000;

export const useCashSessionStore = create<CashSessionState>()((set, get) => ({
  openSessions: [],
  canSellCash: false,
  loading: false,
  error: null,
  lastFetch: null,

  fetchStatus: async (force = false) => {
    const { lastFetch, loading } = get();
    if (loading) return;
    if (!force && lastFetch && Date.now() - lastFetch < STALE_MS) return;

    set({ loading: true, error: null });
    try {
      const res = await cashRegisterApi.status();
      set({
        openSessions: res.open_sessions.map((s) => ({
          ...s.session,
          cash_so_far: s.cash_so_far,
          expenses_total: s.expenses_total,
        })),
        canSellCash: res.can_sell_cash,
        lastFetch: Date.now(),
      });
    } catch {
      set({ error: "No se pudo verificar el estado de la caja" });
    } finally {
      set({ loading: false });
    }
  },

  hasOpenSessionFor: (userId) => get().openSessions.some((s) => s.user_id === userId),

  clear: () => set({ openSessions: [], canSellCash: false, loading: false, error: null, lastFetch: null }),
}));
