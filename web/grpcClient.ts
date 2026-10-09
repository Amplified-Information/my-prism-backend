import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport'
import { ClobPublicClient } from './gen/clob.client.ts'
import { ApiAuthClient, ApiServicePublicClient } from './gen/api.client'
import { RpcOptions } from '@protobuf-ts/runtime-rpc'
import { getToken, useCookieAuth } from './lib/authToken'
import { env, isSameOriginEnv, CROSS_ORIGIN_BACKEND } from './env'
import { createCachedFetcher } from './lib/grpcCache'
import type { BookRequest, BookSnapshot } from './gen/clob'
import type { PriceHistoryRequest, PriceHistoryResponse } from './gen/api'

// Routing rule (in priority order):
//   1. VITE_GRPC_BASE_URL build-time override (ops escape hatch)
//   2. Same-origin '/' for known prism.market hosts — nginx reverse-proxies
//      to the matching backend; no CORS needed.
//   3. Cross-origin fallback for preview hosts (Lovable / Amplified), which
//      must hit a real backend and DO require CORS allowlisting.
// See mem://technical/cors-architecture-audit.
const baseUrl =
  (import.meta.env.VITE_GRPC_BASE_URL as string | undefined)
  ?? (isSameOriginEnv ? '/' : CROSS_ORIGIN_BACKEND[env])
console.log(`[gRPC] env=${env} baseUrl=${baseUrl} host=${window.location.hostname}`)

const transport = new GrpcWebFetchTransport({
  baseUrl
  // NOTE: `credentials: 'include'` was removed because the backend gateway
  // does not yet echo the request origin / set `Access-Control-Allow-Credentials: true`,
  // which caused every cross-origin gRPC-Web call to fail CORS preflight
  // ("Failed to fetch"). Re-enable once the backend CORS config is updated.
  // See docs/auth-cookie-migration.md.
})


const authHeaders = (): RpcOptions => {
  const meta: Record<string, string> = {}
  if (!useCookieAuth) {
    const jwt = getToken()
    if (jwt) {
      meta['authorization'] = `${jwt}`
    }
  }
  return { meta }
}

const clobClient = new ClobPublicClient(transport)
const apiClient = new ApiServicePublicClient(transport)
const authClient = new ApiAuthClient(transport)

// Dedup + 1s cache for hot, idempotent reads. Multiple components on the
// Market page poll these for the same marketId on slightly out-of-phase 5s
// intervals; without this, the network log shows 2–3 identical requests
// per second. Returns the same `{ response }` shape callers already use.
const getBookCached = createCachedFetcher<BookRequest, { response: BookSnapshot }>(
  async (input) => {
    const call = await clobClient.getBook(input)
    console.log(call.response)
    return { response: call.response }
  },
  (input) => `book:${input.marketId}:${input.depth}`,
  1000
)

const priceHistoryCached = createCachedFetcher<PriceHistoryRequest, { response: PriceHistoryResponse }>(
  async (input) => {
    const call = await apiClient.priceHistory(input)
    return { response: call.response }
  },
  (input) => `ph:${input.marketId}:${input.net}:${input.resolution}:${input.from}:${input.to}:${input.limit}`,
  1000
)

export {
  clobClient,
  apiClient,
  authClient,
  getBookCached,
  priceHistoryCached,

  authHeaders
}
