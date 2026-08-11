// ===========================================================================
// Comparación de versiones semver simplificada (X.Y.Z, sin pre-release)
// ===========================================================================

export function parseVersion(value: string): number[] {
  return value
    .trim()
    .split(".")
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

/**
 * Devuelve true si `remote` es estrictamente mayor que `local`.
 * "1.2.1" vs "1.2.1" → false (iguales no es "nueva versión").
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
