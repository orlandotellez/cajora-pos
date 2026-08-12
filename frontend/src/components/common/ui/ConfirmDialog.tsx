import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalBack } from "@/hooks/useModalBack";
import styles from "./ConfirmDialog.module.css";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Sí, continuar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Botón de retroceso de Android / gesto de regreso cierra el diálogo.
  useModalBack(onCancel, open);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  // Portal al body: si el dialog se renderiza dentro de un contenedor con
  // `transform` (p. ej. el drawer del AppShell en mobile), el `position: fixed`
  // del overlay se anclaría a ese contenedor en vez de a la pantalla — el modal
  // quedaría "atrapado" en el sidebar. Con el portal, el overlay SIEMPRE cubre
  // toda la app y queda por encima de todo.
  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
