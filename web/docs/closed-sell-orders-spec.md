# Closed Sell Orders — Backend Specification

Status: **Proposed** — backend not yet implementing.
Owner: Backend (Go gRPC API + Rust CLOB) ↔ Frontend (Prism Market).
Last updated: 2026-06-15.
Parent specs: [`docs/cost-basis-and-pnl-spec.md`](./cost-basis-and-pnl-spec.md), [`docs/realized-pnl-presell-spec.md`](./realized-pnl-presell-spec.md).

## 1. Purpose

Expose the **history of sell orders that are no longer open** so the frontend can:

1. Show a "Sell history" tab in Portfolio.
2. Drive the realized-P&L ledger described in `realized-pnl-presell-spec.md` (one fill event = one row here).
3. Reconstruct per-side cost-basis movements on demand for audit/debug.

This spec covers the **read surface** for closed sell orders. The ledger math itself is owned by the realized-P&L spec.

## 2. Definitions

| Term | Meaning |
|---|---|
| **Sell order** | A `PrismPredictionIntentRequest` with `qty < 0` (sell side) — symmetric with the existing buy intent. |
| **Open** | Resting on the CLOB with remaining `qty != 0` and not cancelled / expired. |
| **Closed** | Order has reached a terminal state: `FILLED`, `PARTIALLY_FILLED_CANCELLED`, `CANCELLED`, `EXPIRED`, or `REJECTED`. |
| **Fill** | A single match event against another resting order. One closed order has ≥1 fills (or 0 for `CANCELLED`/`REJECTED`). |

A closed sell order is immutable — once terminal, no field changes.

## 3. Persistence

New (or already-existing, depending on engine) table `closed_orders`:

```text
order_id            text PK            -- tx_id of the original intent
net                 text
market_id           text
account_id          text
evm_address         text
side                enum(YES,NO)
direction           enum(BUY,SELL)     -- this spec only reads SELL rows
limit_price_usd     numeric(10,6)      -- price from the signed intent
qty_requested       numeric(20,6)      -- |qty| from the signed intent
qty_filled          numeric(20,6)      -- sum of fills
qty_cancelled       numeric(20,6)      -- requested - filled at terminal time
avg_fill_price_usd  numeric(10,6)      -- Σ(fill.qty * fill.price) / qty_filled, NULL if 0
fees_usdc           numeric(20,6)      -- total fees attributed to this order
proceeds_usdc       numeric(20,6)      -- Σ(fill.qty * fill.price) gross
realized_pnl_usdc   numeric(20,6)      -- proceeds - fees - costRemoved (see §3 of realized-pnl spec)
status              enum(...)          -- see §2
created_at          timestamptz        -- intent generated_at
closed_at           timestamptz        -- when status became terminal
signature           text               -- original sig, kept for audit
```

Child table `order_fills` (existing fills table, with the FK added if missing):

```text
fill_id           text PK
order_id          text FK -> closed_orders.order_id
counter_order_id  text
fill_qty          numeric(20,6)
fill_price_usd    numeric(10,6)
fee_usdc          numeric(20,6)
filled_at         timestamptz
```

Indexes:

- `closed_orders(account_id, net, closed_at DESC)` — primary list query.
- `closed_orders(account_id, market_id, direction, closed_at DESC)` — per-market sell history.
- `order_fills(order_id)`.

Grants follow the existing fills-table pattern (auth-only via gRPC; no direct PostgREST exposure).

## 4. Proto Contract

Add to `api.proto` (numbers chosen to avoid collisions with existing/reserved tags in the parent specs):

```proto
enum OrderDirection { ORDER_DIRECTION_UNSPECIFIED = 0; BUY = 1; SELL = 2; }
enum OrderSide      { ORDER_SIDE_UNSPECIFIED = 0; YES = 1; NO = 2; }
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  FILLED = 1;
  PARTIALLY_FILLED_CANCELLED = 2;
  CANCELLED = 3;
  EXPIRED = 4;
  REJECTED = 5;
}

message OrderFill {
  string fill_id          = 1;
  double fill_qty         = 2;
  double fill_price_usd   = 3;
  double fee_usdc         = 4;
  string filled_at        = 5;   // RFC3339
  string counter_order_id = 6;
}

message ClosedOrder {
  string         order_id            = 1;   // == tx_id
  string         net                 = 2;
  string         market_id           = 3;
  string         account_id          = 4;
  OrderSide      side                = 5;
  OrderDirection direction           = 6;   // SELL for this spec; field reused for closed buys later
  double         limit_price_usd     = 7;
  double         qty_requested       = 8;
  double         qty_filled          = 9;
  double         qty_cancelled       = 10;
  double         avg_fill_price_usd  = 11;  // 0 when qty_filled == 0
  double         fees_usdc           = 12;
  double         proceeds_usdc       = 13;
  double         realized_pnl_usdc   = 14;  // signed; matches realized-pnl spec
  OrderStatus    status              = 15;
  string         created_at          = 16;  // intent generated_at
  string         closed_at           = 17;
  repeated OrderFill fills           = 18;  // omitted when include_fills=false
}

message GetClosedSellOrdersRequest {
  string evm_address       = 1;
  string net               = 2;
  optional string market_id = 3;
  optional string before    = 4;  // RFC3339 cursor (closed_at < before)
  optional uint32 limit     = 5;  // default 50, max 200
  optional bool   include_fills = 6;  // default false
}

message GetClosedSellOrdersResponse {
  repeated ClosedOrder orders   = 1;
  optional string      next_cursor = 2;  // null when end reached
}
```

New RPC on `ApiServicePublic` (authenticated, Bearer auth per Auth Credentials memory):

```
rpc GetClosedSellOrders(GetClosedSellOrdersRequest) returns (GetClosedSellOrdersResponse);
```

Server MUST filter `direction == SELL`. The `direction` field is kept on the wire so the same `ClosedOrder` message can back a future `GetClosedOrders` RPC without a breaking change.

## 5. Semantics

- **Ordering**: results sorted by `closed_at DESC, order_id ASC`. Cursor `before` is exclusive on `closed_at`.
- **Pagination**: keyset only — no `offset`. Frontend passes `next_cursor` back verbatim.
- **`market_id` filter**: when set, scope to one market; otherwise return across all markets on `net`.
- **`include_fills`**: defaults false to keep list pages cheap; the detail view sets true.
- **Auth**: same gRPC bearer challenge flow as `GetUserPortfolio`. Server MUST reject requests whose `evm_address` differs from the authenticated subject.
- **Empty state**: return `orders=[]`, `next_cursor=null`. Never error on "no rows".
- **Cancelled-only orders** (`qty_filled == 0`): still returned, with `avg_fill_price_usd = 0`, `proceeds_usdc = 0`, `realized_pnl_usdc = 0`. Useful for UX.
- **Money fields**: `double` on the wire (dollars), stored as integer smallest units server-side. Rounding policy matches the realized-P&L spec.
- **Consistency with ledger**: `Σ realized_pnl_usdc` over all SELL closed orders for `(user, market, side)` MUST equal `PositionInfo.realized_pnl_<side>_usd` from the realized-P&L spec. This is the regression check both teams agree to.

## 6. Backfill

1. Snapshot the existing fills table at deploy time.
2. Group fills by `order_id`, replay them in `filled_at` order through the ledger rule (`realized-pnl-presell-spec.md` §3) to populate `realized_pnl_usdc`, `avg_fill_price_usd`, `proceeds_usdc`, `fees_usdc`.
3. Mark `status` from the order-engine's historical state; if unknown, derive: `qty_filled == qty_requested ⇒ FILLED`, else `PARTIALLY_FILLED_CANCELLED`.
4. Orders that pre-date the ledger (no recorded buy-side cost basis) get `realized_pnl_usdc = NULL`-equivalent: emit `0` on the wire but flag in a `backfill_unknown` server log so the frontend total can warn the user.

## 7. Frontend Wiring (informational)

After backend ships:

- New hook `lib/useClosedSellOrders.ts` calls `GetClosedSellOrders` with `include_fills=false`, infinite-scrolls via `next_cursor`.
- Portfolio page gets a "Sell history" tab listing rows by market with realized P&L.
- `lib/costBasis.ts` keeps using `PositionInfo.realized_pnl_*` (from the realized-P&L spec) for totals — closed-orders RPC is for the per-order list only. No double counting.
- Detail drawer fetches a single order with `include_fills=true`.

No frontend code changes are part of this spec's deliverable; this section is here so backend can sanity-check the read patterns.

## 8. Open Questions

1. **Buy-side parity** — do we want a single `GetClosedOrders(direction filter)` RPC instead of a sell-only one? Frontend currently only needs sells; backend may prefer the general endpoint.
2. **Fee attribution per fill** — same open question as the realized-P&L spec §8.1. Resolution applies to both `OrderFill.fee_usdc` and `ClosedOrder.fees_usdc`.
3. **Retention** — do closed orders live forever, or are rows older than N months archived to cold storage? Affects cursor design if archived.
4. **Counter-order id exposure** — `OrderFill.counter_order_id` is useful for debug but leaks other users' tx ids. Confirm we're OK with that, otherwise drop the field.
5. **Realized-P&L source of truth** — backend computes `realized_pnl_usdc` per order *and* a per-side aggregate on `PositionInfo`. If they disagree (rounding drift), which wins? Recommend: aggregate wins for display, per-order is informational.

## 9. Acceptance Criteria

- `GetClosedSellOrders` returns paginated, auth-scoped sell history with stable ordering.
- For any `(user, market, side)`, summing `realized_pnl_usdc` across closed sells equals `PositionInfo.realized_pnl_<side>_usd` to within ±1 USDC smallest unit.
- `include_fills=true` returns every fill that contributed to `qty_filled`; sum of `fill_qty` equals `qty_filled` exactly.
- Cursor pagination is deterministic across concurrent new closes (new rows do not shift older pages).
- Backfilled rows render without UI errors; pre-ledger rows surface `0` with a server-side flag for ops monitoring.
