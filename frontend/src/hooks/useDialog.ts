import { useCallback, useState } from "react";

export type DialogConfirmAction = () => void;

export interface DialogState {
  message: string;
  variant: "alert" | "confirm";
  onConfirm?: DialogConfirmAction;
}

export interface UseDialogReturn {
  dialog: DialogState | null;
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: DialogConfirmAction) => void;
  closeDialog: () => void;
}

/**
 * Hook que centraliza el state del modal alert/confirm.
 *
 * Pensado para ser consumido con `<PosDialog>` (Pos-specific) o cualquier
 * componente que reciba `{message, variant, onConfirm?}` y cierre con `null`.
 *
 * **Funciones exportadas**:
 *   - `showAlert(message)`: muestra un modal informativo; al cerrarlo se
 *     ejecuta `closeDialog()` (sin acción).
 *   - `showConfirm(message, onConfirm)`: muestra un modal de confirmación;
 *     al aceptar dispara `onConfirm()` y `closeDialog()`; al cancelar
 *     sólo dispara `closeDialog()`.
 *   - `closeDialog()`: oculta el modal sin ejecutar acción.
 */
export function useDialog(): UseDialogReturn {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showAlert = useCallback(
    (message: string) => setDialog({ message, variant: "alert" }),
    [],
  );

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void) =>
      setDialog({ message, variant: "confirm", onConfirm }),
    [],
  );

  const closeDialog = useCallback(() => setDialog(null), []);

  return { dialog, showAlert, showConfirm, closeDialog };
}
