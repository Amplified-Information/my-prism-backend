//! Integer PrismV2 matching. Pure and synchronous so it can be unit tested.
//!
//! The book is quoted in YES price (1_000_000 = 1.0). Bids buy YES exposure
//! (BUY YES or SELL NO); asks sell it (SELL YES or BUY NO). Every bid/ask pair
//! is one of PrismV2's four settlement pairings. Fills mirror the contract:
//! the YES leg pays floor(shares * price / 1e6), the NO leg pays the rest.

use crate::orderbook::proto::{ClobMatch, CreateOrderRequestClob};

pub const PRICE_SCALE: u64 = 1_000_000;
/// Orders this close to their deadline are dropped: settlement would land after it.
pub const DEADLINE_MARGIN_SECS: u64 = 30;

const SIDE_YES: u32 = 0;
const SIDE_NO: u32 = 1;
const ACTION_BUY: u32 = 0;
const ACTION_SELL: u32 = 1;

pub fn is_bid(order: &CreateOrderRequestClob) -> bool {
    (order.side == SIDE_YES && order.action == ACTION_BUY) || (order.side == SIDE_NO && order.action == ACTION_SELL)
}

pub fn remaining_shares(order: &CreateOrderRequestClob) -> u64 {
    order.qty_shares.saturating_sub(order.shares_filled)
}

/// PrismV2.settle's collateral split. None when either leg would pay zero (the contract reverts).
pub fn split_collateral(fill: u64, price: u64) -> Option<(u64, u64)> {
    if fill == 0 || price == 0 || price >= PRICE_SCALE {
        return None;
    }
    let yes = ((fill as u128 * price as u128) / PRICE_SCALE as u128) as u64;
    let no = fill - yes;
    if yes == 0 || no == 0 { None } else { Some((yes, no)) }
}

fn leg_collateral(order: &CreateOrderRequestClob, yes: u64, no: u64) -> u64 {
    if order.side == SIDE_YES { yes } else { no }
}

/// The contract caps only BUY authorizations' cumulative collateral.
fn within_cap(order: &CreateOrderRequestClob, yes: u64, no: u64) -> bool {
    order.action != ACTION_BUY
        || order.collateral_filled.saturating_add(leg_collateral(order, yes, no)) <= order.collateral_cap
}

/// Largest fill <= upper that keeps both BUY legs within their collateral caps and
/// gives both legs a positive payment. Each leg's cost never decreases as the fill
/// grows, so the caps admit a prefix [0, hi] and positivity admits a suffix.
pub fn max_fill(bid: &CreateOrderRequestClob, ask: &CreateOrderRequestClob, price: u64, upper: u64) -> Option<u64> {
    if upper == 0 || price == 0 || price >= PRICE_SCALE {
        return None;
    }
    let caps_ok = |fill: u64| {
        let yes = ((fill as u128 * price as u128) / PRICE_SCALE as u128) as u64;
        let no = fill - yes;
        within_cap(bid, yes, no) && within_cap(ask, yes, no)
    };
    let (mut lo, mut hi) = (0u64, upper); // invariant: caps_ok(lo); answer in [lo, hi]
    if caps_ok(upper) {
        lo = upper;
    }
    while lo < hi {
        let mid = lo + (hi - lo + 1) / 2;
        if caps_ok(mid) { lo = mid } else { hi = mid - 1 }
    }
    split_collateral(lo, price).map(|_| lo)
}

/// The resting order's limit is the execution price. A resting order at the edge of
/// the range (a market order's remainder) has no usable limit, so the incoming
/// order's limit is used instead.
pub fn execution_price(resting: &CreateOrderRequestClob, incoming: &CreateOrderRequestClob) -> Option<u64> {
    [resting.limit_yes_price, incoming.limit_yes_price]
        .into_iter()
        .find(|p| *p > 0 && *p < PRICE_SCALE)
}

fn same_trader(a: &CreateOrderRequestClob, b: &CreateOrderRequestClob) -> bool {
    let strip = |s: &str| s.trim_start_matches("0x").to_ascii_lowercase();
    strip(&a.evm_address) == strip(&b.evm_address) || a.account_id.eq_ignore_ascii_case(&b.account_id)
}

fn crosses(bid: &CreateOrderRequestClob, ask: &CreateOrderRequestClob) -> bool {
    bid.limit_yes_price >= ask.limit_yes_price
}

#[derive(Debug, Default, Clone)]
pub struct Book {
    pub bids: Vec<CreateOrderRequestClob>,
    pub asks: Vec<CreateOrderRequestClob>,
}

impl Book {
    /// Matches an incoming order against the book (price-time priority) and rests any
    /// remainder. Returns one ClobMatch per fill, carrying both orders' pre-fill state.
    pub fn add(&mut self, mut incoming: CreateOrderRequestClob, now: u64) -> Vec<ClobMatch> {
        let mut matches = Vec::new();
        if incoming.deadline <= now + DEADLINE_MARGIN_SECS || remaining_shares(&incoming) == 0 {
            log::warn!("dropping expired or exhausted order tx_id={}", incoming.tx_id);
            return matches;
        }

        let incoming_is_bid = is_bid(&incoming);
        let (opposite, same_side) = if incoming_is_bid {
            (&mut self.asks, &mut self.bids)
        } else {
            (&mut self.bids, &mut self.asks)
        };
        // Best price first; the sort is stable, so equal prices keep arrival order.
        if incoming_is_bid {
            opposite.sort_by_key(|o| o.limit_yes_price);
        } else {
            opposite.sort_by(|a, b| b.limit_yes_price.cmp(&a.limit_yes_price));
        }

        let mut i = 0;
        while i < opposite.len() && remaining_shares(&incoming) > 0 {
            if opposite[i].deadline <= now + DEADLINE_MARGIN_SECS {
                log::warn!("removing expired resting order tx_id={}", opposite[i].tx_id);
                opposite.remove(i);
                continue;
            }
            let resting = &opposite[i];
            let (bid, ask) = if incoming_is_bid { (&incoming, resting) } else { (resting, &incoming) };
            if !crosses(bid, ask) {
                break;
            }
            if same_trader(&incoming, resting) {
                i += 1;
                continue;
            }
            let Some(price) = execution_price(resting, &incoming) else {
                i += 1;
                continue;
            };
            let upper = remaining_shares(&incoming).min(remaining_shares(resting));
            let Some(fill) = max_fill(bid, ask, price, upper) else {
                // Collateral caps or rounding rule out any fill with this order; try the next.
                i += 1;
                continue;
            };
            let (yes, no) = split_collateral(fill, price).expect("max_fill guarantees a valid split");

            matches.push(ClobMatch {
                market_id: incoming.market_id.clone(),
                bid: Some(bid.clone()),
                ask: Some(ask.clone()),
                fill_shares: fill,
                execution_yes_price: price,
                yes_collateral: yes,
                no_collateral: no,
            });

            let resting = &mut opposite[i];
            resting.shares_filled += fill;
            resting.collateral_filled += leg_collateral(resting, yes, no);
            incoming.shares_filled += fill;
            incoming.collateral_filled += leg_collateral(&incoming, yes, no);

            if remaining_shares(&opposite[i]) == 0 {
                opposite.remove(i);
            } else {
                i += 1;
            }
        }

        if remaining_shares(&incoming) > 0 {
            same_side.push(incoming);
        }
        matches
    }

    pub fn remove(&mut self, tx_id: &str) -> bool {
        for side in [&mut self.bids, &mut self.asks] {
            if let Some(pos) = side.iter().position(|o| o.tx_id == tx_id) {
                side.remove(pos);
                return true;
            }
        }
        false
    }

    pub fn orders(&self) -> impl Iterator<Item = &CreateOrderRequestClob> {
        self.bids.iter().chain(self.asks.iter())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ONE: u64 = 1_000_000; // one share / one USDC
    const NOW: u64 = 1_700_000_000;

    fn order(tx: &str, trader: &str, side: u32, action: u32, limit: u64, qty: u64, cap: u64) -> CreateOrderRequestClob {
        CreateOrderRequestClob {
            tx_id: tx.into(),
            market_id: "m".into(),
            account_id: format!("0.0.{trader}"),
            evm_address: format!("{trader:0>40}"),
            side,
            action,
            limit_yes_price: limit,
            qty_shares: qty,
            collateral_cap: cap,
            deadline: NOW + 3600,
            ..Default::default()
        }
    }

    #[test]
    fn opposite_buys_mint_a_complete_set_at_the_resting_price() {
        let mut book = Book::default();
        assert!(book.add(order("a", "1", SIDE_NO, ACTION_BUY, 600_000, 10 * ONE, 4 * ONE), NOW).is_empty());
        let m = book.add(order("b", "2", SIDE_YES, ACTION_BUY, 650_000, 10 * ONE, 7 * ONE), NOW);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].execution_yes_price, 600_000);
        assert_eq!((m[0].fill_shares, m[0].yes_collateral, m[0].no_collateral), (10 * ONE, 6 * ONE, 4 * ONE));
        assert_eq!(m[0].bid.as_ref().unwrap().tx_id, "b");
        assert_eq!(m[0].ask.as_ref().unwrap().tx_id, "a");
        assert_eq!(m[0].bid.as_ref().unwrap().shares_filled, 0, "match carries pre-fill state");
        assert!(book.bids.is_empty() && book.asks.is_empty());
    }

    #[test]
    fn all_four_pairings_cross() {
        // bid kinds: BUY YES, SELL NO; ask kinds: SELL YES, BUY NO
        for (bid_side, bid_action) in [(SIDE_YES, ACTION_BUY), (SIDE_NO, ACTION_SELL)] {
            for (ask_side, ask_action) in [(SIDE_YES, ACTION_SELL), (SIDE_NO, ACTION_BUY)] {
                let mut book = Book::default();
                book.add(order("ask", "1", ask_side, ask_action, 500_000, ONE, ONE), NOW);
                let m = book.add(order("bid", "2", bid_side, bid_action, 500_000, ONE, ONE), NOW);
                assert_eq!(m.len(), 1, "bid ({bid_side},{bid_action}) vs ask ({ask_side},{ask_action})");
            }
        }
    }

    #[test]
    fn no_match_when_prices_do_not_cross() {
        let mut book = Book::default();
        book.add(order("ask", "1", SIDE_YES, ACTION_SELL, 610_000, ONE, 0), NOW);
        assert!(book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 600_000, ONE, ONE), NOW).is_empty());
        assert_eq!((book.bids.len(), book.asks.len()), (1, 1));
    }

    #[test]
    fn price_time_priority_and_partial_fills() {
        let mut book = Book::default();
        book.add(order("worse", "1", SIDE_YES, ACTION_SELL, 550_000, 5 * ONE, 0), NOW);
        book.add(order("first", "2", SIDE_YES, ACTION_SELL, 500_000, 2 * ONE, 0), NOW);
        book.add(order("second", "3", SIDE_YES, ACTION_SELL, 500_000, 2 * ONE, 0), NOW);
        let m = book.add(order("bid", "4", SIDE_YES, ACTION_BUY, 550_000, 5 * ONE, 3 * ONE), NOW);
        let fills: Vec<_> = m.iter().map(|m| (m.ask.as_ref().unwrap().tx_id.as_str(), m.fill_shares, m.execution_yes_price)).collect();
        assert_eq!(fills, vec![("first", 2 * ONE, 500_000), ("second", 2 * ONE, 500_000), ("worse", ONE, 550_000)]);
        assert_eq!(book.asks.len(), 1);
        assert_eq!(remaining_shares(&book.asks[0]), 4 * ONE);
        assert_eq!(book.asks[0].shares_filled, ONE);
        // the second fill of the bid reports the bid's state after the first fill
        assert_eq!(m[1].bid.as_ref().unwrap().shares_filled, 2 * ONE);
    }

    #[test]
    fn self_trades_are_skipped() {
        let mut book = Book::default();
        book.add(order("own", "1", SIDE_NO, ACTION_BUY, 500_000, ONE, ONE), NOW);
        book.add(order("other", "2", SIDE_NO, ACTION_BUY, 500_000, ONE, ONE), NOW);
        let m = book.add(order("bid", "1", SIDE_YES, ACTION_BUY, 500_000, ONE, ONE), NOW);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].ask.as_ref().unwrap().tx_id, "other");
        assert!(book.asks.iter().any(|o| o.tx_id == "own"));
    }

    #[test]
    fn fills_are_cut_to_the_collateral_cap() {
        let mut book = Book::default();
        // NO buyer at YES 0.6 pays 0.4/share, but its cap only covers 2 shares.
        book.add(order("ask", "1", SIDE_NO, ACTION_BUY, 600_000, 5 * ONE, 800_000), NOW);
        let m = book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 600_000, 5 * ONE, 3 * ONE), NOW);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].fill_shares, 2 * ONE);
        assert_eq!(m[0].no_collateral, 800_000);
        assert_eq!(remaining_shares(&book.bids[0]), 3 * ONE, "bid remainder rests");
    }

    #[test]
    fn cumulative_caps_respect_contract_rounding() {
        // floor on the YES leg makes the NO leg round up; three small fills must never
        // exceed the NO buyer's cap even though each one rounds against it.
        let mut book = Book::default();
        let qty = 3 * 7; // 21 units in 3 fills of 7
        let no_cap = 21 - (21 * 333_333 / ONE); // exact cost of one 21-unit fill = 15
        book.add(order("ask", "1", SIDE_NO, ACTION_BUY, 333_333, qty, no_cap), NOW);
        let mut total_no = 0;
        for i in 0..3 {
            let m = book.add(order(&format!("b{i}"), &format!("{}", 10 + i), SIDE_YES, ACTION_BUY, 333_333, 7, 7), NOW);
            total_no += m.iter().map(|m| m.no_collateral).sum::<u64>();
        }
        assert!(total_no <= no_cap, "NO leg paid {total_no} with a cap of {no_cap}");
    }

    #[test]
    fn dust_fills_that_the_contract_would_reject_are_skipped() {
        let mut book = Book::default();
        book.add(order("ask", "1", SIDE_YES, ACTION_SELL, 1, 10, 0), NOW); // 10 units at YES 0.000001
        let m = book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 1, 10, 10), NOW);
        assert!(m.is_empty(), "floor(10 * 1 / 1e6) = 0: the YES leg would pay nothing");
        assert_eq!((book.bids.len(), book.asks.len()), (1, 1));
    }

    #[test]
    fn expired_orders_are_dropped() {
        let mut book = Book::default();
        let mut stale = order("stale", "1", SIDE_YES, ACTION_SELL, 500_000, ONE, 0);
        stale.deadline = NOW + 10;
        book.asks.push(stale);
        let m = book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 500_000, ONE, ONE), NOW);
        assert!(m.is_empty());
        assert!(book.asks.is_empty());
        let mut late = order("late", "3", SIDE_YES, ACTION_BUY, 500_000, ONE, ONE);
        late.deadline = NOW;
        book.add(late, NOW);
        assert_eq!(book.bids.len(), 1, "an expired incoming order is not rested");
    }

    #[test]
    fn restored_orders_resume_from_their_fill_state() {
        let mut book = Book::default();
        let mut restored = order("ask", "1", SIDE_NO, ACTION_BUY, 500_000, 4 * ONE, 2 * ONE);
        restored.shares_filled = 3 * ONE;
        restored.collateral_filled = 1_500_000;
        book.add(restored, NOW);
        let m = book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 500_000, 4 * ONE, 2 * ONE), NOW);
        assert_eq!(m[0].fill_shares, ONE);
        assert_eq!(m[0].ask.as_ref().unwrap().shares_filled, 3 * ONE);
    }

    #[test]
    fn market_order_remainder_uses_incoming_limit() {
        let mut book = Book::default();
        book.add(order("mkt", "1", SIDE_NO, ACTION_BUY, 0, ONE, ONE), NOW); // ask at "any price"
        let m = book.add(order("bid", "2", SIDE_YES, ACTION_BUY, 420_000, ONE, ONE), NOW);
        assert_eq!(m[0].execution_yes_price, 420_000);
    }

    #[test]
    fn split_matches_contract_rounding() {
        assert_eq!(split_collateral(7, 333_333), Some((2, 5)));
        assert_eq!(split_collateral(4 * ONE, 600_000), Some((2_400_000, 1_600_000)));
        assert_eq!(split_collateral(1, 500_000), None);
        assert_eq!(split_collateral(u64::MAX, 999_999).map(|(y, n)| y as u128 + n as u128), Some(u64::MAX as u128));
    }
}
