import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";
import { useModalBack } from "@/hooks/useModalBack";

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

  // Botón de retroceso de Android / gesto de regreso cierra el escáner.
  useModalBack(onClose, open);

  useEffect(() => {
    if (!open) return;

    const startScanner = async () => {
      try {
        // Ensure the container element exists
        const el = document.getElementById(SCANNER_ID);
        if (!el) return;

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
            // Success – set barcode and close
            onScan(decodedText);
            stopScanner();
          },
          () => {
            // Scan error – silently ignore
          },
        );
      } catch (err) {
        console.warn("[BarcodeScanner] Error starting camera:", err);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open]);

  function stopScanner() {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => {});
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
          borderRadius: 16,
          overflow: "hidden",
          background: "#000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scanner viewfinder */}
        <div
          id={SCANNER_ID}
          ref={containerRef}
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            position: "relative",
          }}
        />

        {/* Corner brackets */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 260,
            height: 100,
            border: "2px solid rgba(255,255,255,0.6)",
            borderRadius: 12,
            pointerEvents: "none",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
          }}
        />

        {/* Scan line animation */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 240,
            height: 2,
            background: "linear-gradient(90deg, transparent, #22d3ee, transparent)",
            animation: "barcodeScan 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      </div>

      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, textAlign: "center" }}>
        Apunta al código de barras
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 10,
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

      <style>{`
        @keyframes barcodeScan {
          0%, 100% { top: calc(50% - 40px); }
          50% { top: calc(50% + 40px); }
        }
      `}</style>
    </div>
  );
}
