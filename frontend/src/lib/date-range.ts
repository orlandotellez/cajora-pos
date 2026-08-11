// Rango de fechas unificado de la página de Reportes.
// Un solo selector controla KPIs, cierre de caja y gráficos.
export type Range = "today" | "7d" | "30d" | "4w" | "1y";

export function rangeStart(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (r === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (r === "30d") { d.setDate(d.getDate() - 30); return d; }
  if (r === "4w") { d.setDate(d.getDate() - 28); return d; }
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
    case "4w": return "4 semanas";
    case "1y": return "1 año";
  }
}
