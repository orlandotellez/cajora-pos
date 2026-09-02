import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { acquireCameraStream, cameraErrorMessage } from "@/lib/camera";

/** ID del elemento DOM donde se monta el viewfinder del scanner. */
export const POS_SCANNER_ELEMENT_ID = "pos-barcode-scanner";
/** localStorage key para persistir el estado "scanner activo" entre reloads. */
const STORAGE_KEY = "pos-scanner-active";
/** Debounce: si se escanea el mismo código antes de este tiempo, lo ignoramos. */
const SCAN_DEBOUNCE_MS = 2000;
/** Throttle: el botón toggle no se puede presionar más rápido que esto. */
const TOGGLE_THROTTLE_MS = 500;

export interface UsePosScannerOptions {
  /**
   * Callback que se ejecuta cuando el scanner detecta un barcode válido
   * (después del debounce). El consumer hace lo que necesite: lookup del
   * producto, agregarlo al cart, etc.
   */
  onScan: (barcode: string) => void | Promise<void>;
}

export interface UsePosScannerReturn {
  /** Estado actual (true = scanner activo + renderizando viewfinder). */
  active: boolean;
  /** Toggle on/off (respeta throttle). */
  toggle: () => void;
  /** Limpia el mensaje de error actual. */
  clearError: () => void;
  /** Ref al elemento button del toggle (para focus u otros). */
  toggleButtonRef: React.RefObject<HTMLButtonElement | null>;
  /** ID del elemento DOM donde se debe renderizar el viewfinder. */
  elementId: string;
  /** Error legible de la última activación (permiso denegado, cámara en uso, etc.). */
  error: string | null;
}

/**
 * Hook que encapsula el ciclo de vida del barcode scanner del POS.
 *
 * Maneja:
 *   - Inicialización de `Html5Qrcode` con los formatos soportados del codebase.
 *   - Persistencia del estado `active` en localStorage entre reloads.
 *   - Debounce de 2s para evitar escanear el mismo código repetidamente
 *     cuando el scanner sigue activo.
 *   - Throttle de 500ms en el toggle button.
 *   - Cleanup riguroso: stop + clear al desmontar o al desactivar.
 *
 * **Cuidado de stale closures**: `onScan` se pasa como argumento y muta su
 * referencia vía un ref mutable para que el callback del scanner siempre
 * dispare contra la versión más reciente sin necesidad de re-mount del
 * scanner cada vez que `onScan` cambia.
 *
 * Extraído del inline que vivía en `pages/Pos.tsx` (~80 líneas).
 */
export function usePosScanner(opts: UsePosScannerOptions): UsePosScannerReturn {
  const { onScan } = opts;

  const [active, setActive] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true",
  );
  const [error, setError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerActiveRef = useRef(active);
  const lastScannedRef = useRef<{ barcode: string; time: number } | null>(null);
  const lastToggleRef = useRef(0);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  // Keep mutable ref of onScan so the scanner callback always sees the latest
  // closure without needing to re-create the scanner instance.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Sync ref of `active` for use inside `queueMicrotask`
  useEffect(() => {
    scannerActiveRef.current = active;
  }, [active]);

  const stopScanner = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      scanner
        .stop()
        .catch(() => { })
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            /* ignore */
          }
        });
    } catch {
      /* stop() lanzó error síncrono (e.g. "scanner is not running") */
    }
  }, []);

  // Init/teardown del scanner cuando cambia `active`
  useEffect(() => {
    if (!active) {
      stopScanner();
      return;
    }

    queueMicrotask(async () => {
      if (!scannerActiveRef.current) return;

      // 1) Pedir el permiso de cámara SIEMPRE al activar: dispara el prompt del
      // navegador (o reintenta si el permiso quedó pendiente) y nos deja saber
      // el estado real antes de montar el scanner.
      try {
        await acquireCameraStream();
      } catch (err) {
        if (!scannerActiveRef.current) return;
        setActive(false);
        setError(cameraErrorMessage(err));
        return;
      }
      if (!scannerActiveRef.current) return;

      const el = document.getElementById(POS_SCANNER_ELEMENT_ID);
      if (!el) return;
      if (scannerRef.current) return;

      const scanner = new Html5Qrcode(POS_SCANNER_ELEMENT_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, aspectRatio: 1.0 },
          async (decodedText) => {
            const now = Date.now();
            if (
              lastScannedRef.current &&
              lastScannedRef.current.barcode === decodedText &&
              now - lastScannedRef.current.time < SCAN_DEBOUNCE_MS
            ) {
              return;
            }
            lastScannedRef.current = { barcode: decodedText, time: now };
            await onScanRef.current(decodedText);
          },
          () => {
            /* scan error — ignore (es muy verboso) */
          },
        )
        .catch((err) => {
          console.warn("[PosScanner] Error:", err);
          if (!scannerActiveRef.current) return;
          setActive(false);
          setError(cameraErrorMessage(err));
        });
    });

    return () => {
      stopScanner();
    };
  }, [active, stopScanner]);

  // Persistir el estado active en localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(active));
  }, [active]);

  const toggle = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleRef.current < TOGGLE_THROTTLE_MS) return;
    lastToggleRef.current = now;
    setError(null); // cada toque reintenta: limpia el error anterior
    setActive((prev) => !prev);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    active,
    toggle,
    clearError,
    toggleButtonRef,
    elementId: POS_SCANNER_ELEMENT_ID,
    error,
  };
}
