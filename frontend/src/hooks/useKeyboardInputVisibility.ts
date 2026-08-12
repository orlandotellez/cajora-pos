import { useEffect } from "react";
import { isAndroidRuntime } from "@/lib/fetch";

export function useKeyboardInputVisibility() {
  useEffect(() => {
    if (!isAndroidRuntime()) return;

    function isTextEntry(el: Element | null): el is HTMLElement {
      if (!el) return false;
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLInputElement) {
        const type = el.type;
        return !["checkbox", "radio", "range", "color", "button", "submit", "file"].includes(type);
      }
      return (el as HTMLElement).isContentEditable === true;
    }

    function scrollFocusedIntoView() {
      const el = document.activeElement;
      if (!isTextEntry(el)) return;
      const rect = el.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportTop = vv ? vv.offsetTop : 0;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      // Solo corregir si el input quedó tapado por el teclado o fuera de la
      // pantalla (margen de 12px para no pegarse al borde).
      if (rect.bottom > viewportTop + viewportHeight - 12 || rect.top < viewportTop + 12) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
      }
    }

    function onFocusIn() {
      // El teclado tarda un momento en desplegarse y el resize puede tardar
      // más en algunos dispositivos: reintentar un par de veces.
      window.setTimeout(scrollFocusedIntoView, 120);
      window.setTimeout(scrollFocusedIntoView, 320);
    }

    function onViewportResize() {
      window.setTimeout(scrollFocusedIntoView, 60);
    }

    document.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, []);
}
