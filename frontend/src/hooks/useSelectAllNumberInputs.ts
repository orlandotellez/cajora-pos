import { useEffect } from "react";

export function useSelectAllNumberInputs() {
  useEffect(() => {
    function handleFocus(e: FocusEvent) {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        target.select();
      }
    }
    document.addEventListener("focus", handleFocus, true);
    return () => {
      document.removeEventListener("focus", handleFocus, true);
    };
  }, []);
}
