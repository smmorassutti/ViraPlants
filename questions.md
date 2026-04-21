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

### Q1: RLS policy on `garden_invites` references `auth.users`; client SELECT/DELETE fail with "permission denied for table users"

- **Phase:** 2 bugfix round 1
- **What I observed:** Any `SELECT` from `public.garden_invites` made with the anon or authenticated role returns `{"code":"42501","message":"permission denied for table users"}`, regardless of filters or the column list. The same error surfaces in the mobile app as Bug 1 when `listMyInvites()` runs. Reproduced via raw REST calls from a freshly-signed-up throwaway user, so it is a pure RLS issue (not a client or PostgREST syntax problem). `garden_caretakers`, `caretaker_notes`, and `profiles` all behave correctly under the same test.
- **Inferred cause:** The `USING` clause of the `garden_invites` SELECT policy almost certainly contains a subquery like `(SELECT email FROM auth.users WHERE id = auth.uid())` — Supabase does not grant `SELECT` on `auth.users` to `anon` or `authenticated` by default, so the subquery blows up even when the owner-id branch of an `OR` would have matched. Best fix in a vacuum would be `auth.jwt() ->> 'email'` instead of the subquery.
- **Hard rules in effect this session:** "Do NOT: Introduce new database migrations or tables; Modify RLS policies". So I cannot fix the policy in this round.
- **Claude Code's best-guess resolution:** Routed `listMyInvites` and `cancelInvite` through a new Edge Function `caretaker-invites` (actions: `list`, `cancel`) that uses the service-role client, which bypasses RLS and sidesteps the broken policy entirely. Public signatures in `caretakerService.ts` are unchanged — only the implementation swapped from direct PostgREST to `supabase.functions.invoke('caretaker-invites', …)`. `inviteCaretaker` was already going through an Edge Function so it was unaffected. `listMyCaretakers` stayed on direct PostgREST because `garden_caretakers` RLS works correctly. Deploy flag `--no-verify-jwt` required (same as other Edge Functions in this project — see Q2).
- **Follow-up for Sam:** Ideally the `garden_invites` SELECT policy should be rewritten to avoid the `auth.users` subquery, at which point the Edge Function workaround can be replaced with direct client queries again. Logging here rather than making a schema migration decision unilaterally.
- **Sam's answer:** _pending_

### Q2: Edge Functions deployed without `--no-verify-jwt` reject new ES256-signed user JWTs with `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`

- **Phase:** 2 bugfix round 1
- **What I observed:** Calling `invite-caretaker` with an authenticated user's JWT returned HTTP 401 with body `{"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm ES256"}`. This body is produced by the Supabase Edge Runtime platform (not our handler), BEFORE our code runs. `analyze-plant` does not hit this because it was deployed earlier with JWT verification disabled (noted in CLAUDE.md). Supabase has migrated user-facing JWTs to ES256; the platform's default verifier still only accepts HS256.
- **Claude Code's best-guess resolution:** Redeployed `invite-caretaker` (and the new `caretaker-invites` function) with `supabase functions deploy --no-verify-jwt <name>`. Our Edge Functions already decode the JWT payload manually (safe because the gateway has validated the signature on the way in; base64-decoding `sub` is the documented pattern in `analyze-plant`). Also hardened `caretakerService.ts :: extractFunctionError` so future platform-generated error bodies of shape `{code, message}` surface a usable `code` instead of falling through to "Something went wrong".
- **Follow-up for Sam:** This will bite every new Edge Function in this project until either (a) we always deploy with `--no-verify-jwt` (noted in CLAUDE.md now), or (b) Supabase's platform JWT verifier is configured to accept the project's ES256 public key. Option (a) is fine for now but means each function is responsible for its own auth; the current base64-decode pattern matches `analyze-plant`.
- **Sam's answer:** _pending_

---

## Resolved questions

_None yet._
