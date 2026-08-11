import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/fetch";

/**
 * Versión instalada de la app (desde tauri.conf.json → Android versionName).
 *
 * En web dev (`pnpm dev`) no hay runtime Tauri → devuelve null y el UI
 * simplemente no muestra el tag.
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;

    invoke<string>("get_app_version")
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
