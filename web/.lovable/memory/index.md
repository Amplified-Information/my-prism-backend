# Project Memory

## Core
Dark theme, 'cosmic' UI, Tailwind v4, shadcn/ui. Primary #3B82F6, bg #0F172A.
Typography: Inter only. No serifs.
Architecture: AWS + Go gRPC API & Rust CLOB. No frontend backend services. SPA routing enabled.
Tech limits: NEVER run 'npm audit fix --force' for elliptic. React Router DOM only.
Hedera limits: Use .toString() for Status/Ledgers. Buffer.from for Hedera prefix. 60s timeout for signing.
Admin lives in a separate project — never add admin UI, /admin route, or admin-only data here.

## Memories
- [Wallet Single Stack](mem://architecture/wallet-single-stack) — Only DAppConnector; HashConnect removed
- [AppKit Modal Branding](mem://design/appkit-modal-branding) — Featured wallets + right-side Prism drawer for Connect modal
- [Required Dependencies](mem://technical/required-dependencies-inventory) — Pinned versions for Hedera wallet and peer deps
- [Wallet Branding](mem://style/wallet-metadata-branding) — Prism Market wallet metadata branding
- [Hosting Architecture](mem://architecture/hosting-and-backend-choice) — AWS hosting, Go gRPC API, Rust CLOB
- [WalletConnect Config](mem://technical/wallet-connect-configuration-v4) — WalletConnect project ID and CSP headers
- [Frontend Separation](mem://architecture/frontend-backend-separation) — Separation of frontend and backend architecture
- [Troubleshooting Guide](mem://technical/connectivity-troubleshooting-guide) — Connectivity and gRPC routing debug guide
- [Auth Credentials](mem://technical/auth-credential-spec) — gRPC VITE_RPC_AUTHORIZATION Bearer auth
- [Market Pricing Logic](mem://concepts/prediction-market-pricing-logic) — Binary market math ($1.00 sum rule)
- [Portfolio Enrichment](mem://technical/portfolio-data-enrichment) — Portfolio balances sourced from backend
- [Order Cancellation](mem://features/order-cancellation-protocol) — CancelOrderDialog rules and UI requirements
- [Price Streaming](mem://technical/price-streaming-fallback-logic) — Price stream timeout fallback to polling
- [Trade Panel Borders](mem://style/trade-panel/highlight-borders) — Trade panel visual border design
- [Default Pricing](mem://concepts/default-market-pricing) — 50% / $0.50 fallback pricing state
- [Hedera Spec](mem://technical/hedera-execution-spec) — Hedera SDK execution quirks and timeout handling
- [Dependency Policy](mem://technical/dependency-vulnerability-policy) — No force npm audit fix for elliptic
- [Matching Engine](mem://architecture/matching-engine-clarification) — CLOB order matching logic rules
- [Backend Source Repo](mem://architecture/backend-source-repository) — Source repository and gen/ folder sync
- [Market Cards UI](mem://features/explore/market-cards) — Explore market card design spec
- [Outcome Widget](mem://ui/mini-outcome-widget) — Radial gauge widget design for YES/NO
- [Design System](mem://style/design-system) — Cosmic dark theme system with HSL variables
- [Color Palette](mem://style/color-palette) — Specific background and card color tokens
- [Hero Section](mem://ui/hero-section) — Hero section typography and layout constraints
- [Token Specs](mem://config/token-specs) — Testnet token IDs and decimal config
- [I18n Architecture](mem://features/i18n) — Multi-language setup via i18next
- [Mirror Node Lag](mem://constraints/mirror-node-lag) — Sync lag expectations for mirror nodes
- [Header Global Styling](mem://ui/header-global-styling) — Global application header layout
- [Network Management](mem://features/centralized-network-management) — Network switching routing logic
- [Auth Flow](mem://auth/challenge-flow) — Challenge-based auth sequence for gRPC
- [Precision Standards](mem://style/precision-standards) — Formatting standard: shares to 3 decimals, prices in Cents
- [SPA Refresh Logic](mem://architecture/spa-routing-refresh-support) — SPA Nginx routing fallback for paths
- [Market Details UI](mem://features/market-detail) — Market detail page visual requirements
- [Copy & Messaging](mem://style/copy-and-messaging) — Terminology: "speed, fairness, and security", "allocate"
- [Trading Color Scheme](mem://style/trading-ui-color-scheme) — Action color codes for Buy/Sell YES/NO
- [Market Creation](mem://features/market-creation) — Market creation form UI and validation logic
- [Community Board](mem://features/community-board) — Comments UI logic with 32-byte hash
- [Environment Config](mem://technical/environment-and-api-configuration) — Environment detection and RPC routing
- [Auth Image Loading](mem://technical/authenticated-image-loading) — Load images utilizing Bearer auth tokens
- [Comment Protobuf](mem://technical/comment-protobuf-alignment) — Comment protobuf mapping alignment
- [MacroMetadata Parse](mem://technical/macrometadata-deserialization) — MacroMetadata protobuf mapping alignment
- [Hedera Signature](mem://technical/hedera-signature-encoding) — Buffer.from Hedera signing prefix handling
- [Trading Constraints](mem://config/trading-constraints) — Global minimum order size of $0.01
- [Implied Price Match](mem://technical/clob-matching-implied-prices) — Derived implied matching prices logic
- [Trading Protocol](mem://technical/trading-signing-protocol) — Trading signature sequence and price encoding
- [Cancel Signing](mem://technical/cancel-order-signing-protocol) — Signed CancelOrderRequest (backend 66b90827+)
- [Mirror Node Fetching](mem://technical/hedera-mirror-node-balance-fetching) — Disabling caching on mirror node queries
- [Calendar Component](mem://technical/ui/calendar-component) — Day picker integration configuration
- [CLOB Market Check](mem://technical/clob-market-availability) — Loading delay tolerance for orderbooks
- [gRPC Maintenance](mem://technical/grpc-definitions-maintenance) — Directives for updating gen/ gRPC files
- [Sister Project Context](mem://architecture/sister-project-context) — Reference to backend sister project
- [Static Pages](mem://features/static-pages) — Layouts for Privacy and Terms pages
- [Trade Panel Input](mem://features/trade-panel) — Trade panel price input logic limits
- [Portfolio Data Logic](mem://features/portfolio/data-logic) — Grouping rules for Portfolio YES/NO data
- [CORS Architecture](mem://technical/cors-architecture-audit) — Same-origin via nginx for prism.market hosts; CORS only for preview hosts
- [Env & Backend Routing](mem://technical/env-and-backend-routing) — env.ts is the single source of truth; never re-sniff hostname
- [Admin Exclusion](mem://constraints/admin-feature-exclusion) — Admin functionality lives in a separate project
- [Chart Render Lifecycle](mem://technical/price-chart-render-lifecycle) — Optimizing graph renders utilizing microtasks
- [Discovery Filters](mem://features/explore/market-discovery-filters) — Category carousel and visual search filters
- [Explore Layout](mem://ui/explore-page-layout) — Explore page architectural constraints
- [Context Splitting](mem://architecture/domain-context-splitting) — Grouping domain specific context providers
- [Logic Modularization](mem://architecture/trading-logic-modularization) — Hook composition strategies for trading
- [Integrity Check](mem://technical/order-integrity-verification) — Keccak order payload verification step
- [SPA Navigation Rules](mem://technical/spa-navigation-integrity) — Navigation limits inside SPA routers
- [Stats Dashboard](mem://features/stats-dashboard) — Global hero statistics formulas
- [Price Chart Layout](mem://features/price-chart) — Price chart visual presentation and fallbacks
- [Polling Stability](mem://technical/polling-stability-protocol) — Error limits and bounds on 5s intervals
- [Navigation Stability](mem://technical/navigation-stability-strategy) — Router structure handling and limits
- [Vite Deduplication](mem://technical/vite-react-deduplication) — Fixing React library duplication bugs
- [Footer Layout](mem://ui/footer-layout) — Sticky footer organizational layout
- [Social Links](mem://style/social-media-assets) — Whitelisted and blocked social links
- [Background VFX](mem://style/background-animations) — DustParticles animation settings
- [React 19 Perf Fix](mem://technical/react-19-performance-optimization) — Addressing performance.measure issues
- [Refresh Polling](mem://technical/trading-refresh-polling) — Orderbook background 5s refresh timing
- [Backend Sync Check](mem://architecture/backend-sync-verification) — Validating protobuf backend updates
- [Orderbook Specs](mem://features/orderbook-layout-spec) — The 4-column orderbook UI requirements
- [Allowance Terminology](mem://features/allowance-management-protocol) — Utilizing 'Max' USDC allowance language
- [Wallet Menu Allowance](mem://ui/wallet-menu-allowance-display) — Showing 'Max' state correctly in UI
- [Portfolio Redemption](mem://features/portfolio/redemption) — On-chain Prism.redeem(uint128) flow; no backend RPC
- [Platform Rake](mem://concepts/platform-rake) — Flat 2% rake, backend-calculated at redemption
- [Sig Scheme Versioning](mem://technical/signature-scheme-versioning) — Backend sigSchemeDateRanges; frontend emits v1, guards drift
- [Hedera SDK Namespace](mem://technical/hedera-sdk-namespace) — Direct frontend imports use @hiero-ledger/sdk; @hashgraph/sdk is transitive-only
