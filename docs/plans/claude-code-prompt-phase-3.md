# Claude Code Prompt — Caretaker Mode Phase 3 (v2)

**Version note:** v2 supersedes the earlier draft. Changes: RPC owner-email lookup reads from `auth.users` (not `profiles`, which has no email column); `garden_caretakers.expires_at` copies from `garden_invites.expires_at` (nullable owner-set end date), not `invite_expires_at` (the 7-day link expiry); explicit note on owner-side/caretaker-side asymmetry to prevent refactor drift.

**Copy-paste everything below into a fresh Claude Code session, run from the ViraPlantsMobileApp repo root on `main` (Phase 2 is merged, as of commit `adda54d`).**

---

We're implementing Phase 3 of the caretaker mode feature for Vira Plants.

## Before starting

1. Read `CLAUDE.md` at the project root — understand current app state, including Phase 2 completion entry and the deployment learnings (especially `--no-verify-jwt` requirement and the `garden_invites` RLS patch)
2. Read `docs/plans/caretaker-mode-ce-plan-v2.1.md` in full — this is the feature spec
3. Read the Phase 3 section of the plan carefully
4. Read `supabase/functions/invite-caretaker/index.ts` and `supabase/functions/caretaker-invites/index.ts` — use these as reference patterns for JWT decoding (base64url decode middle segment, extract `sub` and `email`), CORS, service role client, and error shape
5. Read `src/services/caretakerService.ts` — your new work extends this file. The existing `extractFunctionError` handles both nested `{error: {code, message}}` and flat `{code, message}` shapes — reuse it, don't rewrite.
6. Read `src/screens/SettingsScreen.tsx` — you'll add the Pending Invitations section here
7. Read `src/screens/ManageCaretakersScreen.tsx` lines 25–60 — contains `formatFullDate`, `formatRelative`, and `isInviteExpired` helpers which you will extract to a shared module (see Task 0)
8. Read `questions.md` — especially Q1 (RLS resolved) and Q2 (--no-verify-jwt convention) and D1 (deferred deep linking)

Phases 0, 1, 2 are complete. Do NOT repeat them. The database migration is applied, the invite-caretaker flow works end-to-end, and the RLS policies on `garden_invites` have been patched in production to use `auth.jwt() ->> 'email'`.

### Confirmed production schema (verified against live Supabase before this session)

**`garden_invites`:**
- `id uuid PK`, `owner_id uuid NOT NULL → auth.users(id)`, `invitee_email text NOT NULL` (CHECK lowercase), `token text NOT NULL UNIQUE`
- `expires_at timestamptz NULL` — **caretaker relationship end date, set by owner at invite time. NULL = indefinite relationship.**
- `invite_expires_at timestamptz NOT NULL DEFAULT now()+7 days` — **invite link expiry (how long the caretaker has to accept)**
- `created_at timestamptz NOT NULL DEFAULT now()`, `accepted_at timestamptz NULL`
- Partial index `WHERE accepted_at IS NULL` on both `invitee_email` and `token`

**`garden_caretakers`:**
- `id uuid PK`, `owner_id uuid NOT NULL`, `caretaker_id uuid NOT NULL`, both → `auth.users(id)`
- `invited_at timestamptz NOT NULL DEFAULT now()`, `accepted_at timestamptz NOT NULL DEFAULT now()`, `expires_at timestamptz NULL`
- UNIQUE (`owner_id`, `caretaker_id`), CHECK (`owner_id <> caretaker_id`)

**`profiles`:**
- `id uuid PK → auth.users(id)`, `display_name text NULL`, `avatar_url text NULL`, `location text NULL`, timestamps
- **No email column — email lives only in `auth.users`**

### Confirmed production RLS state on `garden_invites`

- `owner_or_invitee_can_delete` (DELETE) — caretaker decline relies on this
- `invitee_can_view_own_invites` (SELECT) — `listPendingInvitesForMe` relies on this
- `owner_can_view_own_invites` (SELECT) — owner's existing flow (currently unused by client; caretaker-invites Edge Function uses service role)
- `owner_can_create_invites` (INSERT)

### Owner-side / caretaker-side asymmetry (intentional, temporary)

**Do not refactor this in Phase 3.** Owner-side list + cancel currently route through the `caretaker-invites` Edge Function (a workaround from the pre-patch RLS era). Caretaker-side list + decline will use direct PostgREST (Phase 3 work) because the patched `auth.jwt() ->> 'email'` policies make this possible. Unifying both sides onto direct PostgREST is deliberately deferred to post-Phase-6 cleanup. If you see the `caretaker-invites` Edge Function and think "this could be simpler now," you are correct but that is not Phase 3 scope.

## Scope for this session

Implement Phase 3 only: invite acceptance from the caretaker side.

**Deliverables:**

0. **Extract shared helpers.** Move `formatFullDate`, `formatRelative`, and `isInviteExpired` from `src/screens/ManageCaretakersScreen.tsx` (lines ~25–60) into `src/utils/formatDate.ts`. Do not change their logic. Update `ManageCaretakersScreen.tsx` to import from the new location. Verify: `tsc --noEmit` passes and the screen still renders identically.
1. **New Postgres RPC:** `accept_garden_invite(p_invite_id uuid, p_caretaker_id uuid)` — `SECURITY DEFINER`, transactional. See Task 1 spec below.
2. **New migration:** `supabase/migrations/004_accept_invite_rpc.sql` containing the RPC definition. Apply via Supabase SQL Editor (same pattern as migration 003).
3. **New Edge Function:** `supabase/functions/accept-invite/index.ts`. Deploy with `--no-verify-jwt`.
4. **Extend `src/services/caretakerService.ts`** with:
   - `listPendingInvitesForMe()` — direct PostgREST SELECT on `garden_invites` where `accepted_at IS NULL`. The RLS policy `invitee_can_view_own_invites` scopes rows by the caller's JWT email.
   - `acceptInvite(inviteId: string)` — calls the new `accept-invite` Edge Function. Returns `{ ownerId, ownerName }` on success.
   - `declineInvite(inviteId: string)` — direct PostgREST DELETE on `garden_invites`. The RLS policy `owner_or_invitee_can_delete` scopes the delete.
5. **New component:** `src/components/PendingInviteCard.tsx`
6. **Modify `src/screens/SettingsScreen.tsx`:**
   - Add "Pending invitations" section at the TOP of the scroll view, above the existing Account section
   - Section only renders if `listPendingInvitesForMe()` returns >0 results
   - Section vanishes when all invites are accepted/declined
   - Refetch pending invites on mount and on pull-to-refresh

**Do NOT build:**
- Garden context / `activeGardenId` / garden switching (Phase 4)
- Home header dropdown or bottom sheet (Phase 4)
- **Owner-facing acceptance signal** (`owner_seen_at` column, badge on Manage Caretakers) — deferred to Phase 4, where it fits with the owner's garden-switching work
- Caretaker notes (Phase 5)
- Real-time subscriptions, deep linking, push notifications
- Toast / snackbar infrastructure — success feedback on Accept is silent (see Task 5 for rationale)
- Auto-deletion of expired invites — expired invites remain in the DB for owner visibility
- **Any refactor of the `caretaker-invites` Edge Function** — see the asymmetry note above

## Task 1: Postgres RPC `accept_garden_invite`

This MUST be a `SECURITY DEFINER` Postgres function so the two writes happen atomically in a single transaction. Do NOT implement accept as two separate writes from the Edge Function — a crash between them creates a stale pending invite for a caretaker who already has access, which surfaces as confusing "already a caretaker" errors on retry.

`SECURITY DEFINER` also gives the function read access to `auth.users`, which it needs because the `profiles` table has no email column.

Create `supabase/migrations/004_accept_invite_rpc.sql` with:

```sql
-- Migration 004: accept_garden_invite RPC
-- Transactional handler for caretaker-side invite acceptance.
-- Called from supabase/functions/accept-invite/index.ts with the service-role client.

CREATE OR REPLACE FUNCTION public.accept_garden_invite(
  p_invite_id uuid,
  p_caretaker_id uuid
)
RETURNS TABLE(
  owner_id uuid,
  owner_display_name text,
  owner_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite         garden_invites%ROWTYPE;
  v_owner_email    text;
  v_owner_name     text;
BEGIN
  -- Load invite with row lock to prevent concurrent accept races
  SELECT * INTO v_invite
  FROM public.garden_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_accepted';
  END IF;

  IF v_invite.invite_expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  -- Guard against duplicate caretaker row. If one already exists, we still
  -- resolve the invite (set accepted_at) so it stops appearing as pending,
  -- then raise a distinct error so the caller knows no new access was granted.
  IF EXISTS (
    SELECT 1 FROM public.garden_caretakers
    WHERE owner_id = v_invite.owner_id AND caretaker_id = p_caretaker_id
  ) THEN
    UPDATE public.garden_invites
    SET accepted_at = NOW()
    WHERE id = p_invite_id;
    RAISE EXCEPTION 'already_caretaker';
  END IF;

  -- Atomic: insert caretaker row + mark invite accepted.
  -- garden_caretakers.accepted_at and invited_at have NOT NULL defaults of now();
  -- we pass invited_at explicitly so it reflects when the invite was first sent.
  -- expires_at copies from the invite's expires_at (nullable owner-set end date),
  -- NOT invite_expires_at (the 7-day link expiry).
  INSERT INTO public.garden_caretakers (
    owner_id, caretaker_id, invited_at, accepted_at, expires_at
  ) VALUES (
    v_invite.owner_id,
    p_caretaker_id,
    v_invite.created_at,
    NOW(),
    v_invite.expires_at
  );

  UPDATE public.garden_invites
  SET accepted_at = NOW()
  WHERE id = p_invite_id;

  -- Look up owner's email from auth.users (profiles has no email column)
  -- and display name from profiles (nullable).
  SELECT au.email, p.display_name
  INTO v_owner_email, v_owner_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = v_invite.owner_id;

  RETURN QUERY SELECT
    v_invite.owner_id,
    COALESCE(v_owner_name, split_part(v_owner_email, '@', 1)),
    v_owner_email;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_garden_invite(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_garden_invite(uuid, uuid) TO service_role;
```

The `RAISE EXCEPTION 'code_here'` pattern lets the Edge Function catch the Postgrest error and map the message string to a user-friendly error code. Do NOT grant EXECUTE to `authenticated` — only the service-role Edge Function should call this RPC.

## Task 2: Edge Function `accept-invite`

Input: `{ inviteId: string }`
Output on success: `{ success: true, ownerId: string, ownerName: string }`
Output on error: `{ error: { code, message } }`

**Do NOT expose `owner_email` in the response.** The RPC returns it for fallback purposes (display name → email prefix) and for potential future use, but the Edge Function strips it before responding to the client. Owner email is private.

Steps:

1. Decode JWT (see `invite-caretaker/index.ts` for the base64url pattern) — extract `sub` → `caretakerId` and `email` → `caretakerEmail`
2. Validate `inviteId` present and UUID-shape → otherwise `bad_request` (400)
3. Load invite via service-role client; if not found return `invite_not_found` (404)
4. Check `lower(invite.invitee_email) !== lower(caretakerEmail)` → return `email_mismatch` (403). Note: `invitee_email` is already enforced lowercase at the DB level, but `caretakerEmail` from the JWT is not guaranteed lowercase — always apply `lower()` to the JWT side.
5. Call `supabase.rpc('accept_garden_invite', { p_invite_id: inviteId, p_caretaker_id: caretakerId })`
6. Map RPC errors by message content:
   - `invite_not_found` → 404 `invite_not_found`
   - `invite_already_accepted` → 409 `invite_already_accepted`
   - `invite_expired` → 410 `invite_expired`
   - `already_caretaker` → 409 `already_caretaker`
   - anything else → 500 `internal` (log the full error)
7. On success, return `{ success: true, ownerId: row.owner_id, ownerName: row.owner_display_name }`

Error codes: `invite_not_found`, `invite_already_accepted`, `invite_expired`, `email_mismatch`, `already_caretaker`, `internal`, `unauthorized`, `bad_request`.

## Task 3: Service methods

In `src/services/caretakerService.ts`:

```ts
// Uses RLS policy invitee_can_view_own_invites — direct PostgREST.
export async function listPendingInvitesForMe(): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('garden_invites')
    .select('id, owner_id, invitee_email, invite_expires_at, expires_at, created_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw toServiceError(error);
  return (data ?? []).map(toPendingInvite);
}

// Uses Edge Function accept-invite (which calls the RPC).
export async function acceptInvite(inviteId: string): Promise<AcceptedInvite> {
  // ... invoke('accept-invite', { inviteId }); use extractFunctionError on failure
}

// Uses RLS policy owner_or_invitee_can_delete — direct PostgREST.
export async function declineInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('garden_invites').delete().eq('id', inviteId);
  if (error) throw toServiceError(error);
}
```

Type shapes: define `PendingInvite` and `AcceptedInvite` inline in this file. `PendingInvite` needs enough fields for the card (id, inviteExpiresAt, createdAt, and — importantly — `ownerName` for the headline). Since `listPendingInvitesForMe` doesn't join profiles, either:
- (a) Add a second query for owner names using `.in('id', ownerIds)` on profiles → merge client-side, OR
- (b) Use a Postgres view or an RPC that joins for you

**Choose option (a).** It keeps RLS semantics clean (profile reads already work for caretakers through the existing public-read policy) and avoids a second RPC. The display_name fallback is `split_part(owner_email, '@', 1)`, but since the caretaker cannot read owner email via PostgREST, fall back to a generic string like "Your plant friend" if the profile has no display_name. This is acceptable because the pending-invite window is short (7 days default) and most users set a display name.

## Task 4: PendingInviteCard component

File: `src/components/PendingInviteCard.tsx`

- **Background**: Butter Moon on Hemlock screen. Match the caretaker/invite card pattern already in `ManageCaretakersScreen.tsx` (see its styles at lines 376, 388, 435 for reference). Border radius, shadow, and padding should match.
- **Headline** (Lagoon color, 16pt medium): "{ownerName} wants you to help care for their plants"
- **Subtext** (Luxor color, 13pt): "Sent {formatRelative(createdAt)}" — imported from `src/utils/formatDate.ts`
- **If `isInviteExpired(invite)`**: dim the card (opacity 0.5), replace both buttons with a single "Dismiss" button that calls `declineInvite`
- **Otherwise**, two buttons side-by-side at bottom:
  - "Accept" — Vermillion filled, Lagoon text — calls `acceptInvite`
  - "Decline" — outlined, Hemlock text — calls `declineInvite`

## Task 5: SettingsScreen integration + success/error feedback

Place the Pending invitations section at the TOP of the scroll view, above the existing Account section.

**Section header** styling: match existing section headers in SettingsScreen (inspect the file first — do not hardcode).

### Success feedback: silent. No toast, no Alert.alert.

- Remove the invite from local pending state (refresh via `listPendingInvitesForMe()` after success)
- Card disappears; if it was the last pending invite, the whole section vanishes
- Leave this comment on the success handler: `// TODO(phase-4): trigger useGardenStore.loadGardens() refresh; in phase 4 the accepted garden becomes visible in the home header garden list, which is the durable confirmation surface.`

**Rationale** (do not argue with this decision — it was locked in the planning session that produced this prompt): in Phase 4, accepting an invite will auto-add the new garden to the caretaker's visible garden list (home header dropdown). That list is the durable confirmation. A toast would be a transient shadow of permanent UI.

### Error feedback: inline on the card, not modal.

Map error codes to user-visible messages, rendered as small Vermillion text below the buttons:
- `invite_expired` → "This invitation has expired. Ask the owner to send a new one."
- `invite_already_accepted` → "This invitation has already been accepted."
- `already_caretaker` → "You're already caring for this garden."
- `email_mismatch` → "This invitation wasn't sent to your email address."
- Network / unknown → "Couldn't accept the invitation. Please try again."

Clear the inline error if the user taps Accept or Decline again.

### Decline feedback: silent (same as accept).

- Remove from pending list
- No alert, no toast, no TODO comment — decline has no downstream side effects

## Hard rules

- All colors from `src/theme/vira.ts` — zero hardcoded hex
- Zustand selectors only (don't use `useXxxStore()` bare)
- Navigation types only in `src/types/navigation.ts`
- TypeScript strict — no `any`, no `@ts-ignore`
- All interactive elements need `accessibilityLabel`
- All touch targets ≥ 44×44pt
- All network calls wrapped in try/catch with user-visible error handling
- Brand voice: calm, capable friend — see CLAUDE.md Brand Voice section
- **Reuse** `extractFunctionError` from `caretakerService.ts` for the accept-invite response

## Deploy reminder

```bash
supabase functions deploy accept-invite --no-verify-jwt
```

Mandatory per the ES256 limitation. Don't forget the flag.

## Verification protocol

Write results to `test-results/phase-3-test.md`.

### Pre-flight RLS sanity check

Run in Supabase SQL Editor before implementing the service methods:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'garden_invites'
ORDER BY cmd, policyname;
```

Expected output (4 rows): `owner_or_invitee_can_delete` (DELETE), `owner_can_create_invites` (INSERT), `invitee_can_view_own_invites` (SELECT), `owner_can_view_own_invites` (SELECT). The DELETE and invitee SELECT policies must reference `auth.jwt() ->> 'email'` in their `qual` — not `auth.users`.

If any policy is missing or still references `auth.users`, STOP and flag to the human. Do not re-patch RLS without explicit approval.

### Migration 004 verification

After applying: `SELECT proname, prorettype::regtype FROM pg_proc WHERE proname = 'accept_garden_invite';` → expect one row.

### Code checks

1. `npx tsc --noEmit` — zero errors
2. Hardcoded color scan on new code — zero hits
3. `any` / `@ts-ignore` scan on new code — zero hits
4. Unselectored Zustand store scan on new code — zero hits
5. iPhone 17 Pro simulator build + launch — success

### API-level curl tests (run against deployed Edge Function)

You'll need to create fresh test invites via `invite-caretaker` to exercise each path without burning the pre-seeded pending invite (see "Test setup available" below).

1. Accept valid invite → 200 success, verify `garden_caretakers` row exists and `garden_invites.accepted_at` is set
2. Accept same invite again → 409 `invite_already_accepted`
3. Accept non-existent invite ID → 404 `invite_not_found`
4. Accept with JWT whose email doesn't match `invitee_email` → 403 `email_mismatch`
5. Decline invite via direct PostgREST DELETE with caretaker JWT → 204, row gone
6. Expired invite: manually `UPDATE garden_invites SET invite_expires_at = NOW() - INTERVAL '1 day' WHERE id = '<test id>';`, then attempt accept → 410 `invite_expired`
7. Already-caretaker: manually insert a `garden_caretakers` row before accepting, then accept → 409 `already_caretaker` AND verify the invite row now has `accepted_at` set (cleanup behavior)

### Manual tap-through (document; human to run)

Pre-seeded pending invite in production: invitee email `sam.morassutti+caretaker1@gmail.com`, expires ~7 days from Apr 22.

- [ ] Sign in as `sam.morassutti+caretaker1@gmail.com`
- [ ] Open Settings — verify "Pending invitations" section at top
- [ ] Verify card shows owner name, relative timestamp, Accept and Decline buttons
- [ ] Tap Accept → card disappears silently, section vanishes if it was the only one
- [ ] Verify in Supabase dashboard: `garden_caretakers` row exists; `garden_invites.accepted_at` set
- [ ] Verify `listPendingInvitesForMe()` now returns empty for this user

## If you hit ambiguity

Append to `questions.md` and proceed with best interpretation. Do not block. Do not make architectural choices that contradict the "Do NOT build" list or the asymmetry note.

## Git workflow

Branch from latest main:
```
git checkout main && git pull && git checkout -b feature/caretaker-mode-phase-3
```

Commit sequence:
1. `refactor: extract date/invite helpers to src/utils/formatDate.ts`
2. `feat(caretaker): migration 004 accept_garden_invite RPC`
3. `feat(caretaker): accept-invite edge function`
4. `feat(caretaker): phase 3 service methods and PendingInviteCard`
5. `feat(caretaker): phase 3 settings screen integration`
6. `docs: phase 3 completion`

Do NOT push to main directly. Do NOT merge the PR yourself.

## At the end

Update `CLAUDE.md`:
- Add "Done" entry for Phase 3 with specifics (migration 004, RPC, Edge Function, service methods, component, silent-accept rationale)
- Update "Next up" — remove Phase 3, move Phase 4 to top, add `owner_seen_at` badge as a Phase 4 subtask
- Note migration 004 applied via Dashboard SQL Editor

Generate session handoff `.docx` at repo root.

Then STOP. Human review required.

## One thing to watch for

Phase 3 is tightly coupled to Phase 2's fixes:
- Patched `garden_invites` RLS is what lets list/decline go through direct PostgREST
- `extractFunctionError` already handles both error body shapes — reuse, don't rewrite
- The Postgres RPC pattern (Task 1) is new for this project — do NOT skip it in favor of two-separate-writes, that specifically causes the class of bug the handoff discipline flagged
- The `caretaker-invites` Edge Function is a pre-RLS-patch workaround. Do not refactor it in Phase 3.

If any of these seem to not work as expected, double-check they're in the shape described in CLAUDE.md / questions.md before "fixing" something that's already correct.
