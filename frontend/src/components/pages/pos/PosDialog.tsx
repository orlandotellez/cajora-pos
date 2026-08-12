import { useEffect, useRef } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import styles from "./PosDialog.module.css";

interface PosDialogProps {
  dialog: { message: string; variant: "alert" | "confirm"; onConfirm?: () => void } | null;
  onClose: () => void;
}

export function PosDialog({ dialog, onClose }: PosDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Botón de retroceso de Android / gesto de regreso cierra el diálogo.
  useModalBack(onClose, dialog !== null);

  useEffect(() => {
    if (dialog) {
      confirmRef.current?.focus();
    }
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog, onClose]);

  if (!dialog) return null;

  return (
    <div className={styles.overlay} onClick={() => dialog.variant === "alert" && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{dialog.message}</p>
        <div className={styles.actions}>
          {dialog.variant === "confirm" && (
            <button
              className={`${styles.btn} ${styles.btnCancel}`}
              onClick={onClose}
            >
              Cancelar
            </button>
          )}
          <button
            ref={confirmRef}
            className={`${styles.btn} ${styles.btnConfirm}`}
            onClick={() => {
              dialog.onConfirm?.();
              onClose();
            }}
          >
            {dialog.variant === "alert" ? "Aceptar" : "Sí, continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
