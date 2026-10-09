/**
 * Relative age for backend timestamps (e.g. `LOMreward.created_at`, written by
 * the hourly scoring cron). Shared by the Rewards page and the Portfolio
 * rewards tab so both render freshness identically.
 */
export function formatAge(iso: string | undefined): string {
  if (!iso) return 'not scored yet'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'not scored yet'
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}
