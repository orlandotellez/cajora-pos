import { useCallback, useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, ms: number): readonly [T, (v: T) => void] {
  const [v, setV] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setV(value), ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, ms]);

  const flush = useCallback((newValue: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setV(newValue);
  }, []);

  return [v, flush] as const;
}
