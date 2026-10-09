# Comment Moderation — Backend Specification

**Status:** Shipped in `my-prism-backend` commit `553088c`
(`api/server/services/comments_moderation.go`). Backend chose a simpler
surface than proposed below: `ApiService.CreateComment` returns a plain gRPC
error `"comment rejected by moderation: <reason>"` on reject and falls open
on provider errors. **No new proto fields were added** (`moderation_status`,
`moderation_reason`, `flagged_comments` table were not implemented). The
frontend maps the error string to a toast in `components/Comments.tsx`. The
detailed proposal below is retained for reference only.

**Owner:** Backend team.
**Consumer:** `components/Comments.tsx` (via `ApiService.CreateComment` /
`GetComments`).

## Context & History

The previous Supabase-era architecture ran comment moderation in a
`create-comment` edge function that called OpenAI's moderation endpoint and
logged rejected content to a `flagged_comments` table. When the backend
migrated to Go gRPC + Rust CLOB, that layer was dropped. Today comments flow
straight from the wallet-signed `CreateCommentRequest` into persistence with
no content check beyond a 1–1000 character length cap enforced client-side
and by the proto contract.

This spec restores authoritative, server-side AI moderation.

## Goal

Reject or flag disallowed content inside `ApiService.CreateComment` so that:

1. Rejected content never appears in `GetComments` responses.
2. Flagged (but allowed) content is persisted with a moderation status so the
   UI can render a badge or hide-behind-click affordance later.
3. The frontend cannot bypass the check — moderation must run on the server,
   not in the browser.

## Placement in the Handler

Recommended order inside the Go `CreateComment` handler:

```text
1. Request validation (marketId shape, content length 1..1000, keyType known)
2. Moderation call         ← new
3. Signature verification  (existing keccak256 UTF-8 base64 hash flow)
4. Persist + broadcast
```

Rationale for moderating before signature verify: verification is the most
expensive step per request, and obvious spam/abuse should not pay that cost.
Placing moderation _after_ verify is also acceptable if the team prefers to
charge verification cost to the signer as a soft anti-abuse tax; document
the choice in the handler comment either way.

## Provider

- **Recommended:** OpenAI `omni-moderation-latest` (matches the prior
  implementation; free tier on the moderation endpoint at time of writing).
- **Acceptable alternatives:** Any equivalent multi-category classifier
  (Anthropic, Perspective API, etc.).
- **Key handling:** API key held in the backend secret store (SSM in the
  current deploy). Never proxied through or exposed to the frontend.

## Category Policy

Hard-block (returns `MODERATION_REJECTED`, comment is not persisted):
- `sexual/minors`
- `hate/threatening`
- `harassment/threatening`
- `violence/graphic`
- `self-harm/instructions`

Soft-flag (persist with `moderation_status = FLAGGED`, UI may hide behind a
click-to-reveal or attach a badge):
- `hate`
- `harassment`
- `sexual`
- `violence`
- `self-harm`

Allowed by default: everything else, including `moderation_status = ALLOWED`.

## Proto Changes (additive, no tag renumbering)

`CreateCommentResponse`:
- Add `moderation_status` (enum `ModerationStatus { ALLOWED = 0; FLAGGED = 1;
  REJECTED = 2; }`).
- Add `moderation_reason` (optional string, human-readable category label —
  shown to the user on reject).
- Extend `status.code` values to include `MODERATION_REJECTED`.

`Comment`:
- Add `moderation_status` so `GetComments` responses can carry the flag for
  UI rendering.

All fields must use new tag numbers to preserve wire compatibility with the
frontend descriptors currently generated at commit `d62ec41f`.

## Persistence

New backend table `flagged_comments` (mirrors the old Supabase schema):

| column      | type      | notes                                     |
|-------------|-----------|-------------------------------------------|
| id          | uuid      | primary key                               |
| market_id   | uuid      | FK to markets                             |
| account_id  | string    | wallet account that submitted             |
| content     | text      | full submitted content                    |
| categories  | jsonb     | array of tripped category strings         |
| scores      | jsonb     | provider's per-category scores            |
| status      | enum      | `FLAGGED` or `REJECTED`                   |
| created_at  | timestamp | server time                               |

Not exposed via any public RPC. Admin review UI lives in the separate admin
project — this repo does not consume `flagged_comments` directly.

## Failure Mode

If the moderation provider is unreachable, returns 5xx, or exceeds a 2 s
deadline, **fall open**: treat the request as `ALLOWED`, emit a backend
metric (`comment_moderation_fallopen_total`), and continue to signature
verification. Rationale: abuse is a rare signal; a provider outage should
not block all commenting. If fall-open volume spikes, alerting can page
the on-call to force-close temporarily.

## Rate Limiting

Reuse the existing per-account gRPC rate limit. No new limit needed —
moderation itself has provider-side quotas that the backend key already
manages.

## Testing Checklist

- Unit test per hard-block category confirms `MODERATION_REJECTED` and no
  row in the main `comments` table.
- Unit test per soft-flag category confirms row is persisted with
  `moderation_status = FLAGGED` and mirrored in `flagged_comments`.
- Integration test that a rejected comment does not appear in a subsequent
  `GetComments` call for the same market.
- Load / chaos test that provider 5xx triggers fall-open and increments
  the metric.
- Contract test that old frontend descriptors (without the new fields)
  still decode `CreateCommentResponse` and `Comment` correctly.

## Frontend Follow-up (not in this repo)

Once the backend ships:

1. Regenerate `gen/api.ts` from the updated proto (`.lovable/memory/technical/grpc-definitions-maintenance.md`).
2. Surface `moderation_reason` in `components/Comments.tsx` when
   `status.code === 'MODERATION_REJECTED'` (toast: "Your comment was blocked
   by moderation: {reason}").
3. Optionally render a badge on `FLAGGED` comments in the community board.

Until then, `components/Comments.tsx` remains as-is and relies on the
backend for enforcement.
