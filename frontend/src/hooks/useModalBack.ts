import { useEffect, useRef } from "react";
import { pushModalClose } from "@/lib/modal-back";

export function useModalBack(close: () => void, enabled = true) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!enabled) return;
    return pushModalClose(() => closeRef.current());
  }, [enabled]);
}
