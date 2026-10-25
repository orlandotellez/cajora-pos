import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

const MOVE_TOLERANCE = 10;
const CLICK_GUARD_MS = 800;

export function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const firedAt = useRef(0);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      origin.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        firedAt.current = Date.now();
        onLongPress();
      }, delay);
    },
    [cancel, delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!timer.current) return;
      if (
        Math.abs(e.clientX - origin.current.x) > MOVE_TOLERANCE ||
        Math.abs(e.clientY - origin.current.y) > MOVE_TOLERANCE
      ) {
        cancel();
      }
    },
    [cancel],
  );

  const onPointerUp = useCallback(() => cancel(), [cancel]);
  const onPointerCancel = useCallback(() => cancel(), [cancel]);

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    if (firedAt.current && Date.now() - firedAt.current < CLICK_GUARD_MS) {
      e.preventDefault();
    }
  }, []);

  const consumeClick = useCallback(() => {
    if (firedAt.current && Date.now() - firedAt.current < CLICK_GUARD_MS) {
      firedAt.current = 0;
      return true;
    }
    return false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, consumeClick };
}
