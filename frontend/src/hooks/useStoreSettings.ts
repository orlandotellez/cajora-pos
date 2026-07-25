import { useEffect, useState } from "react";
import { settingsApi } from "@/api/settings";

export interface StoreSettings {
  /** Nombre del negocio (de `GET /settings`) */
  storeName: string;
  /** Dirección física (string vacío si el negocio no la tiene configurada) */
  storeAddress: string;
  /** Teléfono (string vacío si no está configurado) */
  storePhone: string;
  /** Pie de página que se imprime al final del ticket */
  storeFooter: string;
}

/**
 * Carga la configuración del negocio (datos del local) una vez al mount
 * y la expone como 4 strings listos para usar al imprimir tickets.
 *
 * Centraliza el patrón que vivía inline en `pages/Pos.tsx` y
 * `pages/Sales.tsx` (4 useState + 1 useEffect con settingsApi.get()).
 *
 * **Comportamiento**:
 *   - Mientras carga, los 4 campos devuelven `""` (estado inicial).
 *   - Si la petición falla, los 4 campos quedan en `""` y se emite
 *     `console.warn("Error al cargar config:", err)` — mismo manejo
 *     de error que tenía la versión inline.
 *   - Fetcha una sola vez por mount (deps `[ ]`).
 *
 * **Decisión arquitectónica (Option A)**: cada instancia del hook hace
 * su propio GET. Para los 2 consumidores actuales (Pos + Sales) es
 * trivial. Si en el futuro hay N consumidores que montan al mismo
 * tiempo y los fetches paralelos se vuelven un problema, considerar
 * un module-level promise cache o un Context provider. Hoy es
 * preferible mantener el hook simple y predecible.
 *
 * **Uso**:
 * ```tsx
 * const { storeName, storeAddress, storePhone, storeFooter } = useStoreSettings();
 * ```
 */
export function useStoreSettings(): StoreSettings {
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeFooter, setStoreFooter] = useState("");

  useEffect(() => {
    settingsApi
      .get()
      .then((res) => {
        setStoreName(res.name);
        setStoreAddress(res.address ?? "");
        setStorePhone(res.phone ?? "");
        setStoreFooter(res.ticket_footer ?? "");
      })
      .catch((err) => console.warn("Error al cargar config:", err));
  }, []);

  return { storeName, storeAddress, storePhone, storeFooter };
}
