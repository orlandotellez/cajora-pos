import { onBackButtonPress } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isAndroidRuntime, isTauriRuntime } from "@/lib/fetch";

type Entry = { id: number; close: () => void };

const PHANTOM_HASH = "#modal-back";

const stack: Entry[] = [];
let nextId = 0;
let installedPopstate = false;
let installedNative = false;
let pendingCleanups = 0;
let cleanupBackPending = false;

function isPhantomEntry(): boolean {
  return typeof window !== "undefined" && window.history.state?.__modalBack === true;
}

function consumePhantomIfAlone() {
  if (stack.length === 0 && isPhantomEntry() && !cleanupBackPending) {
    cleanupBackPending = true;
    pendingCleanups += 1;
    window.history.back();
  }
}

export function pushModalClose(close: () => void): () => void {
  const id = ++nextId;
  stack.push({ id, close });
  if (stack.length === 1 && !isPhantomEntry()) {
    try {
      window.history.pushState({ __modalBack: true }, "", PHANTOM_HASH);
    } catch {
    }
  }
  return () => removeModalClose(id);
}

function removeModalClose(id: number) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return; // ya se cerró con el botón atrás (popstate o nativo)
  stack.splice(idx, 1);
  consumePhantomIfAlone();
}

export function closeTopModal(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}

export function installModalBackHandler() {
  if (installedPopstate || typeof window === "undefined") return;
  installedPopstate = true;

  window.addEventListener("popstate", () => {
    if (pendingCleanups > 0) {
      pendingCleanups -= 1;
      cleanupBackPending = false;
      if (stack.length > 0 && !isPhantomEntry()) {
        window.history.pushState({ __modalBack: true }, "", PHANTOM_HASH);
      }
      return;
    }
    if (!closeTopModal()) return;
    if (stack.length > 0 && !isPhantomEntry()) {
      window.history.pushState({ __modalBack: true }, "", PHANTOM_HASH);
    }
  });
}

export function installNativeBackHandler() {
  if (installedNative || typeof window === "undefined") return;
  installedNative = true;
  if (!isTauriRuntime()) return;

  onBackButtonPress(async ({ canGoBack }) => {
    if (closeTopModal()) {
      consumePhantomIfAlone();
      return;
    }
    if (canGoBack) {
      window.history.back();
      return;
    }
    try {
      await getCurrentWindow().close();
    } catch {
    }
  }).catch((err) => {
    if (isAndroidRuntime()) {
      console.warn("[modal-back] onBackButtonPress falló en Android; el botón atrás usará popstate:", err);
    }
  });
}
