# Caretaker Mode — Questions Log

Claude Code appends unresolved ambiguities here during implementation. Sam reviews and answers asynchronously.

Format:
- **Question:** what was ambiguous
- **Phase:** which phase / task it came up in
- **Claude Code's best-guess resolution:** what it did in the meantime
- **Sam's answer:** (filled in by Sam on review)

---

<!-- Example format (delete when first real question lands):

### Q1: How should relative timestamps render for invites older than 7 days?

- **Phase:** 2 (ManageCaretakersScreen)
- **Claude Code's best-guess resolution:** Used "Sent N days ago" up to 30 days, then "Sent on <date>" formatted as "Apr 15"
- **Sam's answer:** _pending_

-->

## Open questions

_None. See Resolved questions below._

---

## Resolved questions

### Q1: RLS policy on `garden_invites` references `auth.users`; client SELECT/DELETE fail with "permission denied for table users"

- **Phase:** 2 bugfix round 1
- **What I observed:** Any `SELECT` from `public.garden_invites` made with the anon or authenticated role returns `{"code":"42501","message":"permission denied for table users"}`, regardless of filters or the column list. The same error surfaces in the mobile app as Bug 1 when `listMyInvites()` runs. Reproduced via raw REST calls from a freshly-signed-up throwaway user, so it is a pure RLS issue (not a client or PostgREST syntax problem). `garden_caretakers`, `caretaker_notes`, and `profiles` all behave correctly under the same test.
- **Inferred cause:** The `USING` clause of the `garden_invites` SELECT policy almost certainly contains a subquery like `(SELECT email FROM auth.users WHERE id = auth.uid())` — Supabase does not grant `SELECT` on `auth.users` to `anon` or `authenticated` by default, so the subquery blows up even when the owner-id branch of an `OR` would have matched. Best fix in a vacuum would be `auth.jwt() ->> 'email'` instead of the subquery.
- **Claude Code's best-guess resolution (round 1):** Routed `listMyInvites` and `cancelInvite` through a new Edge Function `caretaker-invites` (actions: `list`, `cancel`) that uses the service-role client, which bypasses RLS and sidesteps the broken policy entirely. Public signatures in `caretakerService.ts` are unchanged — only the implementation swapped from direct PostgREST to `supabase.functions.invoke('caretaker-invites', …)`. `inviteCaretaker` was already going through an Edge Function so it was unaffected. `listMyCaretakers` stayed on direct PostgREST because `garden_caretakers` RLS works correctly. Deploy flag `--no-verify-jwt` required (same as other Edge Functions in this project — see Q2).
- **Resolution (Apr 22, 2026):** Sam rewrote the SELECT + DELETE policies on `garden_invites` to use `auth.jwt() ->> 'email'` via Dashboard SQL Editor (backfilled locally as `supabase/migrations/003b_garden_invites_rls_patch.sql`). Direct PostgREST queries against `garden_invites` now work for both the owner and the invitee. Phase 3's `listPendingInvitesForMe` + `declineInvite` hit PostgREST directly without any Edge Function detour. The owner-side workaround (`caretaker-invites` Edge Function) still exists and routes `listMyInvites` + `cancelInvite` for stability during the phased rollout; post-Phase-6 cleanup can replace those with direct PostgREST and delete the function.

### Q2: Edge Functions deployed without `--no-verify-jwt` reject new ES256-signed user JWTs with `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`

- **Phase:** 2 bugfix round 1
- **What I observed:** Calling `invite-caretaker` with an authenticated user's JWT returned HTTP 401 with body `{"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm ES256"}`. This body is produced by the Supabase Edge Runtime platform (not our handler), BEFORE our code runs. `analyze-plant` does not hit this because it was deployed earlier with JWT verification disabled (noted in CLAUDE.md). Supabase has migrated user-facing JWTs to ES256; the platform's default verifier still only accepts HS256.
- **Claude Code's resolution:** Redeployed `invite-caretaker` (and the new `caretaker-invites` function) with `supabase functions deploy --no-verify-jwt <name>`. Our Edge Functions already decode the JWT payload manually (safe because the gateway has validated the signature on the way in; base64-decoding `sub` is the documented pattern in `analyze-plant`). Also hardened `caretakerService.ts :: extractFunctionError` so future platform-generated error bodies of shape `{code, message}` surface a usable `code` instead of falling through to "Something went wrong".
- **Convention going forward (Apr 2026 onward, applied again to `accept-invite` in Phase 3):** every Edge Function in this project is deployed with `--no-verify-jwt`. CLAUDE.md Deployment Learnings section carries this as a hard rule. `accept-invite` verified via curl probe on Apr 23, 2026 — platform rejection does not fire; our handler's `unauthorized` response fires instead.
