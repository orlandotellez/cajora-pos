import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { isNewerVersion } from "@/lib/version";
import styles from "./UpdatePrompt.module.css";

// ===========================================================================
// Auto-update (Android)
//
// Aparece cuando el config remoto (config-api.json) declara una `app_version`
// mayor que la instalada localmente. Al confirmar:
//   1. download_apk (Rust) descarga el APK a cache y devuelve el path
//   2. install_apk  (Kotlin) abre el instalador con FileProvider + ACTION_VIEW
//
// Si el usuario elige "Ahora no", guardamos la versión ignorada en
// localStorage para no volver a preguntar hasta que salga una versión nueva.
// ===========================================================================

const IGNORED_UPDATE_KEY = "POS_IGNORED_UPDATE_VERSION";

function readIgnoredVersion(): string | null {
  try {
    return localStorage.getItem(IGNORED_UPDATE_KEY);
  } catch {
    return null;
  }
}

function writeIgnoredVersion(version: string): void {
  try {
    localStorage.setItem(IGNORED_UPDATE_KEY, version);
  } catch { }
}

type Phase =
  | { kind: "checking" }            // comparando versión local vs remota
  | { kind: "prompt" }              // mostrar pregunta
  | { kind: "downloading" }         // bajando APK
  | { kind: "installer" }           // instalador abierto (Kotlin ya resolvió)
  | { kind: "error"; message: string };

interface Props {
  appVersion: string;
  apkUrl: string;
  onClose: () => void;
}

export function UpdatePrompt({ appVersion, apkUrl, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  // Al montar: comparar versión local vs remota. Si no hay update real,
  // cerramos sin mostrar nada (el padre re-chequea en cada arranque).
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const localVersion = await invoke<string>("get_app_version");
        if (cancelled) return;

        if (!isNewerVersion(appVersion, localVersion)) {
          onClose();
          return;
        }
        // ¿El usuario ya ignoró esta versión? No preguntar de nuevo.
        if (readIgnoredVersion() === appVersion) {
          onClose();
          return;
        }
        setPhase({ kind: "prompt" });
      } catch (err) {
        if (cancelled) return;
        // Sin comando nativo (web dev / desktop) → no mostrar nada.
        console.warn("[update] no se pudo leer la versión local:", err);
        onClose();
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [appVersion, onClose]);

  async function handleDownload() {
    setPhase({ kind: "downloading" });
    try {
      const result = await invoke<{ path: string }>("download_apk", {
        args: { url: apkUrl },
      });
      await invoke("install_apk", { args: { path: result.path } });
      setPhase({ kind: "installer" });
    } catch (err) {
      const message =
        typeof err === "string" ? err : "No se pudo descargar la actualización";
      setPhase({ kind: "error", message });
    }
  }

  function handleLater() {
    writeIgnoredVersion(appVersion);
    onClose();
  }

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true">
        {phase.kind === "checking" && (
          <>
            <h2 className={styles.title}>Verificando actualizaciones…</h2>
            <div className={styles.spinner} aria-hidden="true" />
          </>
        )}

        {phase.kind === "prompt" && (
          <>
            <h2 className={styles.title}>Nueva versión disponible</h2>
            <p className={styles.message}>
              Hay una versión nueva del POS disponible (v{appVersion}). ¿Querés
              descargarla e instalarla ahora?
            </p>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleLater}>
                Ahora no
              </button>
              <button className={styles.confirmBtn} onClick={handleDownload}>
                Descargar e instalar
              </button>
            </div>
          </>
        )}

        {phase.kind === "downloading" && (
          <>
            <h2 className={styles.title}>Descargando actualización…</h2>
            <div className={styles.spinner} aria-hidden="true" />
            <p className={styles.message}>
              No cierres la app. Esto puede tardar unos segundos.
            </p>
          </>
        )}

        {phase.kind === "installer" && (
          <>
            <h2 className={styles.title}>Instalación en curso</h2>
            <p className={styles.message}>
              Se abrió el instalador de Android. Seguí los pasos en pantalla
              para completar la actualización.
            </p>
            <div className={styles.actions}>
              <button className={styles.confirmBtn} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <h2 className={styles.title}>No se pudo actualizar</h2>
            <p className={styles.message}>{phase.message}</p>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleLater}>
                Ahora no
              </button>
              <button className={styles.confirmBtn} onClick={handleDownload}>
                Reintentar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
