import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isAndroidRuntime } from "@/lib/fetch";
import { isNewerVersion } from "@/lib/version";
import { useAppVersion } from "@/hooks/useAppVersion";
import { UpdatePrompt } from "@/components/common/ui/UpdatePrompt";

export interface UpdateInfo {
  appVersion: string;
  apkUrl: string;
}

type PromptMode = "auto" | "manual" | null;

interface UpdateContextValue {
  hasUpdate: boolean;
  openUpdatePrompt: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({
  updateInfo,
  children,
}: {
  updateInfo: UpdateInfo | null;
  children: ReactNode;
}) {
  const localVersion = useAppVersion();
  const [promptMode, setPromptMode] = useState<PromptMode>(null);

  // Solo tiene sentido en el APK de Android: ahí viven get_app_version,
  // download_apk e install_apk.
  const hasUpdate =
    isAndroidRuntime() &&
    updateInfo !== null &&
    localVersion !== null &&
    isNewerVersion(updateInfo.appVersion, localVersion);

  // Al llegar updateInfo del bootstrap por primera vez → ofrecer automático.
  const prevUpdateInfo = useRef<UpdateInfo | null>(null);
  useEffect(() => {
    if (updateInfo !== null && prevUpdateInfo.current === null) {
      setPromptMode("auto");
    }
    prevUpdateInfo.current = updateInfo;
  }, [updateInfo]);

  const openUpdatePrompt = useCallback(() => setPromptMode("manual"), []);
  const closeUpdatePrompt = useCallback(() => setPromptMode(null), []);

  const value = useMemo<UpdateContextValue>(
    () => ({ hasUpdate, openUpdatePrompt }),
    [hasUpdate, openUpdatePrompt],
  );

  // El auto-update vive solo en el APK de Android: los comandos nativos
  // (get_app_version, download_apk, install_apk) no existen en desktop/web.
  if (!isAndroidRuntime()) {
    return (
      <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
    );
  }

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {updateInfo !== null && promptMode !== null && (
        <UpdatePrompt
          appVersion={updateInfo.appVersion}
          apkUrl={updateInfo.apkUrl}
          manual={promptMode === "manual"}
          onClose={closeUpdatePrompt}
        />
      )}
    </UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (ctx === null) {
    throw new Error("useUpdate debe usarse dentro de <UpdateProvider>");
  }
  return ctx;
}
