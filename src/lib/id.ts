/** Short unique id. Uses crypto.randomUUID where available. */
export function uid(prefix = ''): string {
  const base =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${base}` : base
}
