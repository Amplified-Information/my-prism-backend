// Single source of truth for environment + backend routing.
// Add a new domain in HOST_ENV; everything else (gRPC, mirror node, flags)
// can derive from `env`.

export type Env = 'prod' | 'uat' | 'dev' | 'local'

const HOST_ENV: Record<string, Env> = {
  'prism.market':             'prod',
  'testnet.prism.market':     'prod',
  'uat.prism.market':         'uat',
  'dev.prism.market':         'dev',
  'testnet.dev.prism.market': 'dev',
}

const PREVIEW_HOST_SUFFIXES = [
  '.lovable.app',
  '.lovableproject.com',
  '.lovable.dev',
  '.prism.amplified.info',
]

const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

export const env: Env =
  HOST_ENV[hostname] ??
  (PREVIEW_HOST_SUFFIXES.some(s => hostname.endsWith(s)) ? 'dev' : 'local')

// True when the current host is a known prism.market env that should serve
// the gRPC gateway same-origin (via nginx reverse proxy). Preview hosts
// (Lovable / Amplified) must call cross-origin.
export const isSameOriginEnv = HOST_ENV[hostname] !== undefined

// Cross-origin fallbacks for preview hosts that target a real backend.
export const CROSS_ORIGIN_BACKEND: Record<Env, string> = {
  prod:  'https://prism.market/',
  uat:   'https://uat.prism.market/',
  dev:   'https://dev.prism.market/',
  local: '/',
}

// Feature flag: /rewards is visible everywhere except production hosts
// (prism.market / testnet.prism.market). Preview + dev + local all show it.
export const showRewards = env !== 'prod'
