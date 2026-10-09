---
name: Comment Moderation
description: AI moderation for market comments is backend-authoritative; spec lives in docs/comment-moderation-spec.md; no client-side gate.
type: feature
---

Comment moderation is the responsibility of the Go gRPC backend
(`ApiService.CreateComment`), not the frontend.

- **Do not** add client-side content filtering in `components/Comments.tsx`
  or elsewhere — it would give a false sense of security since a determined
  user can bypass the browser and call the RPC directly.
- The backend spec is `docs/comment-moderation-spec.md`. It defines:
  hard-block vs soft-flag categories, additive proto fields
  (`moderation_status`, `moderation_reason`, `MODERATION_REJECTED` status
  code), the `flagged_comments` table, and the fall-open policy on
  provider outages.
- Historical context: a Supabase-era `create-comment` edge function used to
  perform this check via OpenAI. It was dropped when the backend migrated
  off Supabase; the moderation feature has been absent since.
- When the backend ships the additive proto fields, regenerate `gen/api.ts`
  per `mem://technical/grpc-definitions-maintenance` and surface
  `moderation_reason` in the Comments UI toast on `MODERATION_REJECTED`.
