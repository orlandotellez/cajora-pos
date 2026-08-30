import { create } from "zustand";
import { settingsApi } from "@/api/settings";

interface SettingsState {
  /** Módulo de caja opcional habilitado (default true hasta cargar del backend). */
  cashRegisterEnabled: boolean;
  /** true una vez que se intentó cargar (aunque haya fallado). */
  loaded: boolean;
  loading: boolean;

  /** Carga la configuración global desde el backend (una sola vez). */
  load: () => Promise<void>;
  /** Cambia el estado del módulo y persiste en el backend (optimistic). */
  setCashRegisterEnabled: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  cashRegisterEnabled: true,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await settingsApi.get();
      set({ cashRegisterEnabled: res.cash_register_enabled, loaded: true });
    } catch {
      // Si falla, mantenemos el default y no rompemos el acceso a la app.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setCashRegisterEnabled: async (enabled: boolean) => {
    const previous = get().cashRegisterEnabled;
    set({ cashRegisterEnabled: enabled });
    try {
      await settingsApi.update({ cash_register_enabled: enabled });
    } catch {
      // Revertimos el optimistic update si la persistencia falla.
      set({ cashRegisterEnabled: previous });
      throw new Error("No se pudo actualizar la configuración");
    }
  },
}));
