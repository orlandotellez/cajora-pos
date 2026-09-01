// Rango de fechas unificado de la página de Reportes.
// Un solo selector controla KPIs, cierre de caja y gráficos.
export type Range = "today" | "7d" | "30d" | "1y";

/** Formatea una Date como ISO con offset local para que PostgreSQL la interprete como hora local. */
function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOff = Math.abs(offset);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}` +
    `${sign}${offH}:${offM}`
  );
}

export { toLocalISOString };

export function rangeStart(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (r === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (r === "30d") { d.setDate(d.getDate() - 30); return d; }
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

export function rangeEnd(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(23, 59, 59, 999); return d; }
  return d;
}

export function rangeLabel(r: Range) {
  switch (r) {
    case "today": return "hoy";
    case "7d": return "7 días";
    case "30d": return "30 días";
    case "1y": return "1 año";
  }
}
