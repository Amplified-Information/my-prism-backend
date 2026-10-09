import type { PaginationRes } from '../gen/api'

/**
 * Page size we ask for. `LimitOffsetRequest.limit` is validated `lte: 100`
 * (backend commit f8387e00, was 25), but the server additionally clamps to
 * `DB_MAX_ROWS` (currently 50) — so a 100-row request can legitimately return
 * fewer rows without meaning "end of feed". Never compare returned rows against
 * this constant to detect the last page; use `pagination` or the first page's
 * effective size instead.
 */
export const PAGE_LIMIT = 100

export interface PagedPage<T> {
  rows: T[]
  pagination?: PaginationRes
}


export interface FetchAllPagedResult<T> {
  rows: T[]
  /** Server-reported total across all pages, when available. */
  total: number
  /** True when we stopped before exhausting the feed (maxPages ceiling). */
  truncated: boolean
}

/**
 * Sequentially walks a limit/offset RPC until the feed is exhausted.
 *
 * Sequential on purpose: the gRPC-web gateway returns 502s when hit with a
 * burst of concurrent requests (same reason the 1D price-history fetch is
 * throttled). `maxPages` bounds the walk so a misbehaving feed can't loop.
 *
 * When the backend omits `pagination` (e.g. `MarketsResponse`), falls back to
 * "a page shorter than the first page means the end" — the server clamps our
 * requested limit to `DB_MAX_ROWS`, so the effective page size has to be
 * learned from the first response rather than assumed to be `PAGE_LIMIT`.
 */
export async function fetchAllPaged<T>(
  fetchPage: (args: { limit: number; offset: number }) => Promise<PagedPage<T>>,
  opts: { maxPages?: number } = {},
): Promise<FetchAllPagedResult<T>> {
  const maxPages = Math.max(1, opts.maxPages ?? 8)
  const rows: T[] = []
  let offset = 0
  let total = 0
  let truncated = false
  // Page size the server actually applied, learned from the first response.
  let effectiveLimit = 0

  for (let page = 0; page < maxPages; page++) {
    const { rows: pageRows, pagination } = await fetchPage({ limit: PAGE_LIMIT, offset })
    rows.push(...pageRows)

    if (pagination && pagination.total > 0) total = Number(pagination.total)

    if (effectiveLimit === 0) {
      effectiveLimit = pagination?.limit && pagination.limit > 0
        ? pagination.limit
        : pageRows.length
    }

    const hasMore = pagination
      ? pagination.hasMore
      : effectiveLimit > 0 && pageRows.length >= effectiveLimit

    if (!hasMore) break

    offset = pagination?.nextOffset && pagination.nextOffset > offset
      ? pagination.nextOffset
      : offset + (effectiveLimit || pageRows.length)

    if (page === maxPages - 1) truncated = true
  }


  return { rows, total: total || rows.length, truncated }
}
