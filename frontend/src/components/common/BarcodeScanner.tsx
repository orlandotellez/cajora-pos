import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { useModalBack } from "@/hooks/useModalBack";
import { acquireCameraStream, cameraErrorMessage } from "@/lib/camera";

interface BarcodeScannerProps {
  open: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const formatsToSupport = [
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
];

const SCANNER_ID = "barcode-scanner-element";

export function BarcodeScanner({ open, onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // "idle": pantalla previa de confirmación; "starting": pidiendo cámara.
  const [phase, setPhase] = useState<"idle" | "starting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Botón de retroceso de Android / gesto de regreso cierra el escáner.
  useModalBack(onClose, open);

  // Al abrir el modal mostramos la pantalla previa (phase "idle") en vez de
  // pedir cámara al vuelo. Así el usuario decide con intención y evitamos
  // tocar "No permitir" por accidente. El escáner arranca al tocar
  // "Activar cámara" (un gesto directo, condición ideal para getUserMedia).
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (phase !== "starting") return;

    let cancelled = false;

    const startScanner = async () => {
      try {
        await acquireCameraStream();

        const el = document.getElementById(SCANNER_ID);
        if (!el || cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {
            // Scan error – silently ignore
          },
        );
      } catch (err) {
        console.warn("[BarcodeScanner] Error starting camera:", err);
        if (!cancelled) {
          setError(cameraErrorMessage(err));
          setPhase("error");
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [phase, attempt]);

  function retry() {
    setError(null);
    setPhase("starting");
    setAttempt((a) => a + 1);
  }

  function stopScanner() {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => { });
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        flexDirection: "column",
        gap: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: "min(90vw, 400px)",
          height: 350,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "idle" ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              textAlign: "center",
              padding: "0 24px",
              background: "#0f172a",
            }}
          >
            <Camera size={40} color="#94a3b8" />
            <p style={{ color: "#e2e8f0", fontSize: 16, margin: 0, fontWeight: 600 }}>
            Vas a usar la cámara para escanear
          </p>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.4 }}>
            El navegador (o la app) va a pedirte permiso de cámara. Elegí
            "Permitir" para poder leer el código de barras.
          </p>
          </div>
        ) : (
          <>
            {/* Scanner viewfinder */}
            <div
              id={SCANNER_ID}
              ref={containerRef}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
              }}
            />

            {/* Hide html5-qrcode's built-in corner brackets */}
            <style>{`#${SCANNER_ID} #qr-shaded-region { display: none !important; }`}</style>

            {/* Corner brackets */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 260,
                height: 200,
                border: "2px solid rgba(255,255,255,0.6)",
                borderRadius: 5,
                pointerEvents: "none",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                zIndex: 2,
              }}
            />
          </>
        )}

      </div>

      {phase === "error" && error ? (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            maxWidth: "min(90vw, 400px)",
            padding: "12px 16px",
            borderRadius: 5,
            background: "#dc2626",
            color: "#fff",
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: "pre-line",
            textAlign: "center",
          }}
        >
          <span>{error}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button
              onClick={retry}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                border: "none",
                borderRadius: 5,
                background: "#fff",
                color: "#dc2626",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyItems: "center",
                padding: "8px 12px",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 5,
                background: "transparent",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : phase === "idle" ? (
        <button
          onClick={retry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 24px",
            border: "none",
            borderRadius: 5,
            background: "#1e293b",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Camera size={18} />
          Activar cámara
        </button>
      ) : (
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, textAlign: "center" }}>
          Apunta al código de barras
        </p>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 5,
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          <X size={16} />
          Cancelar
        </button>
      </div>
    </div>
  );
}
