# Phase 3 — Invite Acceptance (Caretaker Side) — Test Record

Branch: `feature/caretaker-mode-phase-3`
Author: Claude (automated session)
Date: 2026-04-23

---

## Pre-flight RLS sanity check

**Expected state (from migration 003b, applied via Dashboard SQL Editor on Apr 22, 2026):**

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'garden_invites'
ORDER BY cmd, policyname;
```

Four rows expected:

| policyname                        | cmd    | qual references                                                                 |
| --------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `owner_or_invitee_can_delete`     | DELETE | `auth.uid() = owner_id OR (accepted_at IS NULL AND invitee_email = lower(auth.jwt() ->> 'email'))` |
| `owner_can_create_invites`        | INSERT | `auth.uid() = owner_id`                                                         |
| `invitee_can_view_own_invites`    | SELECT | `accepted_at IS NULL AND invitee_email = lower(auth.jwt() ->> 'email')`         |
| `owner_can_view_own_invites`      | SELECT | `auth.uid() = owner_id`                                                         |

The DELETE and invitee SELECT policies **must** reference `auth.jwt() ->> 'email'` and NOT `auth.users`.

**Verification path used in this session:** I cannot query `pg_policies` directly from the agent environment (the Supabase MCP binding is on a different project and the Postgres password isn't available to the CLI). Instead I relied on:

1. The checked-in `supabase/migrations/003b_garden_invites_rls_patch.sql` file, which is the canonical SQL that was applied to production on Apr 22.
2. The CLAUDE.md entry confirming the patch was applied live on Apr 22, 2026 (`RLS on garden_invites and auth.users` section).

**Sam: run the `pg_policies` query above in the SQL Editor before proceeding with the manual tap-through to confirm. If any policy still references `auth.users`, STOP and flag.**

---

## Migration 004 — `accept_garden_invite` RPC

**Applied:** ☐ (human step — run `supabase/migrations/004_accept_invite_rpc.sql` via Dashboard SQL Editor, same pattern as migrations 003 / 003b)

**Verification query:**

```sql
SELECT proname, prorettype::regtype
FROM pg_proc
WHERE proname = 'accept_garden_invite';
```

Expected: one row. `prorettype` should be `record` (TABLE return type).

**Also verify EXECUTE is scoped to service_role only:**

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'accept_garden_invite';
```

Expected: one row with `grantee = 'service_role'` and `privilege_type = 'EXECUTE'`.

---

## Edge Function — `accept-invite`

**Deployed:** ✅ with `--no-verify-jwt` (verified from the deploy log output).

**Agent-run probes (2026-04-23):**

### Probe 1 — no Authorization header

```bash
curl -sS -X POST https://yxidmviucaaztdnkxxvw.supabase.co/functions/v1/accept-invite \
  -H "Content-Type: application/json" \
  -H "apikey: <anon>" \
  -d '{}'
```

**Result:** HTTP 401, body `{"error":{"code":"unauthorized","message":"Missing or invalid Authorization header."}}` — ✅ matches nested error shape.

### Probe 2 — malformed Authorization header

```bash
curl -sS -X POST https://yxidmviucaaztdnkxxvw.supabase.co/functions/v1/accept-invite \
  -H "Content-Type: application/json" \
  -H "apikey: <anon>" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -d '{}'
```

**Result:** HTTP 401, body `{"error":{"code":"unauthorized","message":"Could not decode token."}}` — ✅ confirms the function's handler ran (not the platform UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM), meaning `--no-verify-jwt` is in effect.

The rest of the curl flow below requires a real user JWT and the migration-004 RPC in place, so it's a human-executable runbook.

---

## API-level curl runbook (run after migration 004 is applied)

Prep:

- A valid user JWT for the caretaker. Easiest: sign in via the mobile app as `sam.morassutti+caretaker1@gmail.com`, then copy `supabase.auth.getSession().access_token` from a console.log'd session, or grab it from the Supabase Dashboard → Auth → Users → Impersonate.
- The pre-seeded invite id in production (from Phase 2): find it with
  ```sql
  SELECT id FROM garden_invites
  WHERE invitee_email = 'sam.morassutti+caretaker1@gmail.com'
    AND accepted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;
  ```

### Test 1 — accept a valid invite

```bash
JWT="eyJhbGciOiJFUzI1NiIs..."  # caretaker JWT
INVITE="<uuid>"
curl -sS -X POST https://yxidmviucaaztdnkxxvw.supabase.co/functions/v1/accept-invite \
  -H "Content-Type: application/json" \
  -H "apikey: <anon>" \
  -H "Authorization: Bearer $JWT" \
  -d "{\"inviteId\":\"$INVITE\"}"
```

**Expected:** HTTP 200, body `{"success":true,"ownerId":"<uuid>","ownerName":"Sam"}` (or whatever owner's display_name is).

**Verify in DB:**

```sql
SELECT * FROM garden_caretakers
WHERE caretaker_id = '<caretaker uuid>' AND owner_id = '<owner uuid>';
-- should return 1 row with accepted_at = now(), invited_at = the original invite created_at,
-- expires_at copied from the invite's expires_at (null if owner didn't set one)

SELECT accepted_at FROM garden_invites WHERE id = '<invite uuid>';
-- accepted_at should be NOW() ± a few seconds
```

### Test 2 — accept the same invite again

Same curl as Test 1.

**Expected:** HTTP 409, body `{"error":{"code":"invite_already_accepted","message":"This invitation has already been accepted."}}`.

### Test 3 — accept a non-existent invite

```bash
curl -sS -X POST https://yxidmviucaaztdnkxxvw.supabase.co/functions/v1/accept-invite \
  -H "Content-Type: application/json" \
  -H "apikey: <anon>" \
  -H "Authorization: Bearer $JWT" \
  -d '{"inviteId":"00000000-0000-0000-0000-000000000000"}'
```

**Expected:** HTTP 404, body `{"error":{"code":"invite_not_found","message":"That invitation no longer exists."}}`.

### Test 4 — email mismatch

Create a fresh invite to some other email, then try to accept it with the caretaker1 JWT.

```sql
-- in the SQL Editor, as an impersonated owner:
INSERT INTO garden_invites (owner_id, invitee_email, token, invite_expires_at)
VALUES (
  '<owner uuid>',
  'someone-else@example.com',
  'test-token-mismatch-' || extract(epoch from now())::text,
  now() + interval '7 days'
)
RETURNING id;
```

Then:

```bash
curl -sS -X POST https://yxidmviucaaztdnkxxvw.supabase.co/functions/v1/accept-invite \
  -H "Content-Type: application/json" \
  -H "apikey: <anon>" \
  -H "Authorization: Bearer $JWT" \
  -d "{\"inviteId\":\"<mismatch invite uuid>\"}"
```

**Expected:** HTTP 403, body `{"error":{"code":"email_mismatch","message":"This invitation wasn't sent to your email address."}}`.

### Test 5 — decline via direct PostgREST DELETE

```bash
curl -sS -X DELETE "https://yxidmviucaaztdnkxxvw.supabase.co/rest/v1/garden_invites?id=eq.<test-invite-uuid>" \
  -H "apikey: <anon>" \
  -H "Authorization: Bearer $JWT" \
  -H "Prefer: return=representation"
```

**Expected:** HTTP 200 (or 204), row gone. Re-running should return 0 rows.

### Test 6 — expired invite

```sql
UPDATE garden_invites
SET invite_expires_at = now() - interval '1 day'
WHERE id = '<new test invite uuid>';
```

Then curl the accept endpoint as in Test 1.

**Expected:** HTTP 410, body `{"error":{"code":"invite_expired","message":"This invitation has expired. Ask the owner to send a new one."}}`.

### Test 7 — already_caretaker cleanup behavior

Scenario: caretaker already has access via a previously accepted invite, then an owner (somehow) creates a brand-new pending invite to the same caretaker email. The RPC should refuse but still mark the invite accepted so it stops showing as pending.

```sql
-- Pre-seed: ensure garden_caretakers row already exists
INSERT INTO garden_caretakers (owner_id, caretaker_id)
VALUES ('<owner uuid>', '<caretaker uuid>')
ON CONFLICT DO NOTHING;

-- Create a fresh invite
INSERT INTO garden_invites (owner_id, invitee_email, token, invite_expires_at)
VALUES (
  '<owner uuid>',
  'sam.morassutti+caretaker1@gmail.com',
  'already-caretaker-test-' || extract(epoch from now())::text,
  now() + interval '7 days'
) RETURNING id;
```

Then accept it with the caretaker1 JWT.

**Expected:** HTTP 409, body `{"error":{"code":"already_caretaker","message":"You're already caring for this garden."}}`.

**Verify:**

```sql
SELECT accepted_at FROM garden_invites WHERE id = '<invite uuid>';
-- should be non-null (resolved)

SELECT count(*) FROM garden_caretakers
WHERE owner_id = '<owner uuid>' AND caretaker_id = '<caretaker uuid>';
-- should still be 1 (no duplicate)
```

---

## Code-level verification

| Check                                         | Result                                           |
| --------------------------------------------- | ------------------------------------------------ |
| `npx tsc --noEmit`                            | ✅ zero errors                                    |
| Hardcoded hex scan on new files               | ✅ zero hits                                      |
| `any` / `@ts-ignore` scan on new code         | ✅ zero hits                                      |
| Unselectored Zustand store scan on new code   | ✅ zero hits                                      |
| iPhone 17 Pro simulator build + launch        | ✅ `Successfully launched the app`                |

Scan commands (for reproduction):

```bash
grep -nE "#[0-9A-Fa-f]{3,8}" \
  src/utils/formatDate.ts \
  src/components/PendingInviteCard.tsx \
  src/screens/SettingsScreen.tsx \
  supabase/functions/accept-invite/index.ts

grep -nE ":\s*any\b|@ts-ignore" \
  src/utils/formatDate.ts \
  src/components/PendingInviteCard.tsx \
  src/screens/SettingsScreen.tsx \
  src/services/caretakerService.ts \
  supabase/functions/accept-invite/index.ts

grep -nE "use(Auth|Plant|Ble|Garden)Store\(\)" \
  src/screens/SettingsScreen.tsx \
  src/components/PendingInviteCard.tsx
```

---

## Manual tap-through (human to run)

Pre-seeded pending invite in production: invitee email `sam.morassutti+caretaker1@gmail.com`, expires approximately 2026-04-29.

- [ ] Apply migration 004 via Dashboard SQL Editor and verify with the `pg_proc` query above.
- [ ] Sign in as `sam.morassutti+caretaker1@gmail.com` in the simulator or a TestFlight build.
- [ ] Open Settings — verify "Pending invitations" section renders at the very top of the screen (above profile card).
- [ ] Verify the card shows:
  - [ ] Owner display name (or "A Vira gardener" if the owner hasn't set a display_name) in the headline copy `"X wants you to help care for their plants"`
  - [ ] `Sent N days ago` / `Sent Xh ago` subtext in Luxor
  - [ ] Vermillion **Accept** button (left) and outlined **Decline** button (right), both ≥44×44pt
- [ ] Pull to refresh — card stays; list refetches silently.
- [ ] Tap **Accept**:
  - [ ] Card disappears silently (no toast, no alert)
  - [ ] "Pending invitations" section header vanishes if that was the only invite
  - [ ] In Supabase Dashboard: `garden_caretakers` row exists for this owner+caretaker pair with `accepted_at ≈ now()`
  - [ ] In Supabase Dashboard: `garden_invites.accepted_at` on the original row is now non-null
- [ ] Kill & relaunch the app; open Settings again — no pending invitations section should render.
- [ ] Send a second invite to the same email from a second test owner account (or re-seed in SQL). Re-open Settings on caretaker1 — new card shows. Tap **Decline** — card disappears silently; verify the invite row is gone from `garden_invites` in Dashboard.
- [ ] Force an expired invite:
  ```sql
  UPDATE garden_invites SET invite_expires_at = now() - interval '1 day'
  WHERE invitee_email = 'sam.morassutti+caretaker1@gmail.com' AND accepted_at IS NULL;
  ```
  Reopen Settings. The card should be dimmed (50% opacity) and show a single "Dismiss" button. Tap Dismiss — card disappears.
- [ ] VoiceOver: the card, Accept button, and Decline button all announce meaningfully (labels reference the owner's name).
- [ ] All touch targets ≥44×44pt (Accept, Decline, Dismiss all specify `minHeight: 44`).

---

## Notes / deferred

- Owner-facing "your invite was accepted" signal (e.g. `owner_seen_at` column, badge on ManageCaretakersScreen) is intentionally deferred to Phase 4 — folds into the garden-switching surface where it has the most value.
- Owner-side list/cancel still routes through `caretaker-invites` Edge Function. Not a Phase 3 concern; see the asymmetry note in the Phase 3 prompt and the CLAUDE.md deployment learning about 003b.
