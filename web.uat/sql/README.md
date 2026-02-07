# Prism Market Database Schema

This directory contains the complete DDL (Data Definition Language) scripts for all actively used Supabase tables in the Prism Market prediction market platform.

## Overview

Prism Market uses Supabase (PostgreSQL) as its primary database, with Row Level Security (RLS) policies for access control. The schema supports:

- **Prediction Markets** - Binary and multi-choice markets with real-time pricing
- **Wallet-Based Identity** - Hedera wallet integration for user identification
- **Governance** - Proposal creation, voting, and market deployment
- **Social Features** - Comments, reactions, and favorites

## Files

### Enum Definitions
- `00_enums.sql` - All custom PostgreSQL enum types used across tables

### Core Market Tables
| File | Table | Description |
|------|-------|-------------|
| `public.event_markets.sql` | `event_markets` | Core prediction market definitions |
| `public.market_categories.sql` | `market_categories` | Top-level market categories |
| `public.market_subcategories.sql` | `market_subcategories` | Subcategories within categories |
| `public.market_options.sql` | `market_options` | Tradeable outcomes for markets |
| `public.market_price_history.sql` | `market_price_history` | Historical price data for charts |

### User & Wallet Tables
| File | Table | Description |
|------|-------|-------------|
| `public.hedera_wallets.sql` | `hedera_wallets` | Hedera wallet connections |
| `public.user_favorite_markets.sql` | `user_favorite_markets` | User bookmarked markets |

### Social/Community Tables
| File | Table | Description |
|------|-------|-------------|
| `public.market_comments.sql` | `market_comments` | Discussion comments on markets |
| `public.comment_reactions.sql` | `comment_reactions` | Like/dislike reactions |
| `public.flagged_comments.sql` | `flagged_comments` | AI-moderated flagged content |

### Governance Tables
| File | Table | Description |
|------|-------|-------------|
| `public.market_proposals.sql` | `market_proposals` | Governance proposals |
| `public.proposal_votes.sql` | `proposal_votes` | Votes on proposals |
| `public.governance_settings.sql` | `governance_settings` | Configurable governance parameters |

### Content Tables
| File | Table | Description |
|------|-------|-------------|
| `public.image_files.sql` | `image_files` | Uploaded image registry |

## Entity Relationships

```
┌─────────────────────┐
│  market_categories  │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│ market_subcategories│
└──────────┬──────────┘
           │ N:1
           ▼
┌─────────────────────┐       ┌─────────────────┐
│    event_markets    │◄──────│ market_proposals│
└──────────┬──────────┘       └────────┬────────┘
           │                           │
     ┌─────┴─────┬─────────────┐       │ 1:N
     │           │             │       ▼
     ▼           ▼             ▼  ┌─────────────┐
┌──────────┐ ┌────────────┐ ┌────────────────┐  │proposal_votes│
│ market_  │ │ market_    │ │ market_        │  └─────────────┘
│ options  │ │ comments   │ │ price_history  │
└────┬─────┘ └─────┬──────┘ └────────────────┘
     │             │
     │             ▼
     │       ┌────────────────┐
     │       │comment_reactions│
     │       └────────────────┘
     │
     └─────► (price data)

┌─────────────────┐
│ hedera_wallets  │◄──── Primary identity for users
└─────────────────┘
         │
         ├──► market_comments.wallet_id
         ├──► comment_reactions.wallet_id
         ├──► proposal_votes.wallet_id
         └──► user_favorite_markets.wallet_id
```

## Key Design Decisions

### Wallet-Based Identity
The system uses Hedera wallet addresses as the primary user identity (`wallet_id`). This enables:
- Decentralized authentication via WalletConnect
- No email/password requirements
- Portable identity across platforms

### Dual Identity Support
Tables support both `user_id` (Supabase Auth) and `wallet_id` for flexibility during migration or hybrid authentication scenarios.

### RLS Policies
All tables implement Row Level Security with:
- Public read access for market data
- Wallet-based write access for user actions
- Service role override for backend operations

## Recreation Order

When recreating the database from scratch, execute scripts in this order:

1. `00_enums.sql` - Enum types (required by other tables)
2. `public.market_categories.sql` - Categories (required by subcategories)
3. `public.market_subcategories.sql` - Subcategories
4. `public.event_markets.sql` - Markets (core table, references categories)
5. `public.market_options.sql` - Options (references markets)
6. `public.market_price_history.sql` - Price history (references markets, options)
7. `public.hedera_wallets.sql` - Wallets (standalone, includes helper functions)
8. `public.market_comments.sql` - Comments (references markets)
9. `public.comment_reactions.sql` - Reactions (references comments)
10. `public.flagged_comments.sql` - Flagged content (references markets)
11. `public.market_proposals.sql` - Proposals (standalone)
12. `public.proposal_votes.sql` - Votes (references proposals)
13. `public.governance_settings.sql` - Settings (standalone)
14. `public.user_favorite_markets.sql` - Favorites (references markets)
15. `public.image_files.sql` - Images (standalone)

## Notes

- These scripts are for documentation and reference purposes
- The actual database is managed by Supabase migrations
- Always test DDL changes in a development environment first
- RLS policies may need adjustment based on authentication strategy

---

*Generated: 2025-12-22*
*Version: 1.0.0*
