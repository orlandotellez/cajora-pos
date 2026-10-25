import { useEffect, useRef, type RefObject } from "react";

export function useScrollHighlightIntoView(
  containerRef: RefObject<HTMLElement | null>,
  itemId: string | null | undefined,
  revision: unknown,
  attribute = "data-row-id",
) {
  const scrolledId = useRef<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      scrolledId.current = null;
      return;
    }
    if (scrolledId.current === itemId) return;

    const container = containerRef.current;
    if (!container) return;

    const target = Array.from(container.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
      (el) => el.getAttribute(attribute) === itemId,
    );
    if (!target) return;

    scrolledId.current = itemId;
    const rect = target.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [containerRef, itemId, revision, attribute]);
}
