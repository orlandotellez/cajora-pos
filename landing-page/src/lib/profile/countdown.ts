/**
 * Cuenta regresiva para la renovación (o cancelación) de la suscripción.
 *
 * Se calcula en el cliente y no en el backend: un valor relativo renderizado en el
 * servidor ya está viejo cuando llega al navegador. El backend manda el ISO y acá se
 * deriva el "en 30d 8h" en el momento de pintar.
 */

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1440;

/**
 * "30d 8h" | "30d" | "8h 15m" | "8h" | "45m".
 * `null` si la fecha no es válida o ya venció.
 *
 * Se descarta la unidad en cero para que nunca se lea "30d 0h".
 */
export function formatCountdown(
  targetIso?: string | null,
  now: number = Date.now(),
): string | null {
  if (!targetIso) return null;

  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  const diff = target - now;
  if (diff <= 0) return null;

  const totalMinutes = Math.floor(diff / MINUTE_MS);
  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export type CountdownVerb = 'renueva' | 'cancela';

/** "Se renueva en 30d 8h" / "Se cancela en 2d 1h". `null` si ya venció. */
export function countdownLabel(
  targetIso: string | null | undefined,
  verb: CountdownVerb,
  now?: number,
): string | null {
  const value = formatCountdown(targetIso, now);
  return value ? `Se ${verb} en ${value}` : null;
}

/**
 * Pinta la cuenta regresiva y la refresca cada minuto.
 *
 * Devuelve un cleanup que hay que llamar antes de volver a renderizar la tarjeta: si
 * no, se apilan intervalos y el texto oscila entre dos verbos.
 */
export function renderCountdown(
  el: HTMLElement,
  targetIso: string | null | undefined,
  verb: CountdownVerb,
): () => void {
  const paint = (): void => {
    const label = countdownLabel(targetIso, verb);
    if (!label) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = label;
    el.hidden = false;
  };

  paint();
  const timer = window.setInterval(paint, MINUTE_MS);
  return () => window.clearInterval(timer);
}
