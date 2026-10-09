// Thin in-flight dedup + short TTL cache for hot, idempotent gRPC calls.
//
// Why: on the Market page multiple components independently poll `clobClient.getBook`
// (GraphOrderbook, useOrderBookPrice, GraphPrice) and `apiClient.priceHistory` for
// the same marketId. With React StrictMode and 5s pollers slightly out-of-phase,
// the network log showed 2–3 identical requests within the same second.
//
// This wrapper collapses concurrent identical calls to one network round-trip and
// serves cache hits for `ttlMs` after a successful response. It does not change
// the response shape — callers still receive the original `UnaryCall`-style result.

type Fetcher<I, R> = (input: I) => Promise<R>
export type CachedFetcher<I, R> = (input: I, opts?: { force?: boolean }) => Promise<R>

interface Entry<R> {
  value: R
  ts: number
}

export function createCachedFetcher<I, R>(
  fetcher: Fetcher<I, R>,
  keyFn: (input: I) => string,
  ttlMs: number,
): CachedFetcher<I, R> {
  const cache = new Map<string, Entry<R>>()
  const inflight = new Map<string, Promise<R>>()

  return async (input: I, opts?: { force?: boolean }): Promise<R> => {
    const key = keyFn(input)
    const now = Date.now()

    if (!opts?.force) {
      const cached = cache.get(key)
      if (cached && now - cached.ts < ttlMs) {
        return cached.value
      }

      const existing = inflight.get(key)
      if (existing) return existing
    }

    const p = fetcher(input)
      .then((value) => {
        cache.set(key, { value, ts: Date.now() })
        return value
      })
      .finally(() => {
        if (inflight.get(key) === p) inflight.delete(key)
      })

    if (!opts?.force) inflight.set(key, p)
    return p
  }
}

