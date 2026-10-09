import { MarketResponse } from '../gen/api'

export type MarketStatus = 'active' | 'resolved' | 'suspended' | 'closed'

export const hasDate = (s?: string) => !!s && s !== '' && !s.startsWith('0001-01-01')

export const getMarketStatus = (m?: MarketResponse): MarketStatus => {
  if (!m) return 'active'
  if (m.isSuspended || m.isPaused) return 'suspended'
  if (hasDate(m.resolvedAt)) return 'resolved'
  if (hasDate(m.closesAt)) {
    const closeMs = Date.parse(m.closesAt)
    if (!isNaN(closeMs) && closeMs <= Date.now()) return 'closed'
  }
  return 'active'
}

export const STATUS_BADGE_VARIANT: Record<MarketStatus, 'success' | 'secondary' | 'destructive' | 'warning'> = {
  active: 'success',
  resolved: 'secondary',
  suspended: 'destructive',
  closed: 'warning',
}

export const STATUS_LABEL: Record<MarketStatus, string> = {
  active: 'Active',
  resolved: 'Resolved',
  suspended: 'Suspended',
  closed: 'Closed',
}
