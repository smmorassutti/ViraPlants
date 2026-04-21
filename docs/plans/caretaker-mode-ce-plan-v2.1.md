# Caretaker Mode — CE Plan (v2, in progress)

**Feature:** Garden sharing / caretaker mode for Vira Plants
**Phase target:** Ships on TestFlight as build 6
**Estimated scope:** 6 phases, designed to be testable end-to-end after each phase
**Plan authored:** April 20, 2026

**Status:**
- ✅ Phase 0 complete (Resend setup, domain verified, secret in Supabase)
- ✅ Phase 1 complete (schema + RLS migration applied, structural checks passed)
- ⏭️ Phase 2 next

---

## Decisions Locked

These are non-negotiable for v1. If a question comes up during implementation that
contradicts one of these, stop and log in `questions.md` — don't reinterpret.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Invite mechanism | Email + in-app invite list | Polished UX; caretaker must have Vira account |
| Granularity | Whole-garden share | Vacation-watering is the dominant use case |
| Expiry | None by default; owner can set or revoke | Covers permanent (partner) + temporary (vacation) |
| Reminder routing | **v1: owner only (same as today). v1.1: per-share toggle** | Notifee on physical device unconfirmed; don't stack risk |
| Account switching UI | Home header dropdown → bottom sheet | Always-visible context, one-tap switch, scales to zero |
| Caretaker permissions | View, mark watered/fertilized, leave notes | Notes are visually separate; care logs unattributed |
| Owner notifications of caretaker activity | None for v1 | Owner checks app; defer push noise |
| Attribution on care logs | None for v1 | Notes section is the attribution surface |
| Notes scope | Per-plant only | Garden-level notes deferred to v2 |
| In-app notifications | None — pending invites surfaced in Settings | Generic notifications table is premature |
| Deep linking from email | None for v1 | Manual "open app, go to Settings" is fine for early users |
| Email infrastructure | Resend (new dependency) | Cleanest for transactional sends from Edge Functions |
| Email from-address | `Vira <hello@viraplants.com>` | Verified domain, on-brand sender name |

---

## Architecture Overview

The mental model: a **garden** is a user's collection of plants. Every user has one
garden of their own (their `auth.users.id` IS the garden ID — no new "garden" table).
Other users can be invited as **caretakers** of that garden.

A new junction table `garden_caretakers` records who has access to whose garden,
with what permissions, and (optionally) until when. RLS policies on `plants`,
`care_events`, and the new `caretaker_notes` table read from this junction to
decide what the calling user can see and do.

The app introduces a single new piece of client state: `activeGardenId`. Most
existing screens already query "plants for the current user" — that becomes "plants
for `activeGardenId`." The owner's own garden is just the case where
`activeGardenId === auth.user.id`.

This is deliberately a small architectural change. We're not introducing the
concept of "tenants" or "workspaces" — just a way for queries to be scoped to a
garden owner that may or may not be the calling user.

---

## ✅ Phase 0 — Setup & Dependencies (COMPLETE)

Resend account created, API key generated, domain `viraplants.com` verified
via DNS records (SPF/DKIM/MX/DMARC). Secret stored in Supabase Edge Functions.
Shared email helper ready.

- API key stored as Supabase secret: `RESEND_API_KEY`
- Helper file: `supabase/functions/_shared/sendEmail.ts` (uses REST API, no SDK)
- From-address: `Vira <hello@viraplants.com>` (hardcoded in helper)

---

## ✅ Phase 1 — Schema & RLS Foundation (COMPLETE)

Migration `003_caretaker_mode.sql` applied successfully to the live Supabase
project. Three new tables created, RLS policies in place, helper function
`has_garden_access` deployed.

**Structural verification passed:**
- Tables `garden_caretakers`, `garden_invites`, `caretaker_notes` exist
- RLS enabled on all three
- Required policies created on all tables (new + modified existing on `plants`, `care_events`, `profiles`)
- Function `has_garden_access(uuid)` exists as SECURITY DEFINER

**Live RLS behavioral test deferred** to Phase 4 (will be naturally exercised when garden context switching is implemented). Dashboard SQL Editor impersonation patterns didn't work reliably on free tier; no ROI in debugging that vs. proving it in real app flow.

**Key schema facts for subsequent phases:**
- `plants.user_id` is the owner column (not `owner_id`)
- `care_events.user_id` is the actor column (who performed the event)
- `profiles.display_name` is the user's display name (nullable; fallback logic needed)
- `caretaker_notes.author_id` is who wrote the note
- All auth.users references are `ON DELETE CASCADE`
- `garden_invites.invitee_email` must be lowercased before insert (CHECK constraint enforces)

---

## Phase 2 — Invite Flow (Owner Side)

**What:** Owner can invite a caretaker by email. Edge Function generates an
invite token, sends an email via Resend, and creates a `garden_invites` row.

**Why:** This is the entry point for everything else. No invites = no
caretakers = no value. Building this first lets us test the whole flow
end-to-end before building the more complex caretaker-side UI.

**How:**

### Edge Function: `invite-caretaker`

Create `supabase/functions/invite-caretaker/index.ts`. Follow the structure
of the existing `analyze-plant` function for JWT decoding, CORS, and error
shape. The Edge Function should:

```typescript
// Input: { email: string, expiresAt?: string }
// Output: { success: true, inviteId: string } | { error: { code, message } }

// 1. Decode JWT, get owner_id (base64 decode middle segment — same pattern as analyze-plant)
// 2. Validate email format (lowercase it; DB CHECK constraint enforces)
// 3. Validate expiresAt is in future if provided
// 4. Check email !== owner's own email → return 'self_invite'
// 5. Check existing active invite for (owner_id, email) → return 'already_invited'
// 6. Check existing garden_caretakers row → return 'already_caretaker'
// 7. Generate token: crypto.randomUUID() + base64url encode, 32 chars
// 8. Insert into garden_invites with service role (bypasses RLS)
// 9. Get owner's display_name from profiles (fallback: email prefix)
// 10. Send email via sendEmail() from _shared/sendEmail.ts
// 11. Return { success: true, inviteId }
```

Email body (HTML — plain text auto-generated by Resend):

```html
<div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1C2B1E;">
  <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 16px;">
    {ownerName} wants you to help care for their plants
  </h1>
  <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px;">
    You've been invited to be a caretaker for {ownerName}'s garden on Vira.
    As a caretaker, you'll be able to view their plants, mark them as watered
    or fertilized, and leave notes.
  </p>
  <div style="background: #FCFEE6; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
    <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #5B5F45;">
      <strong>Next step:</strong> Open the Vira app on your phone, go to
      <strong>Settings → Pending invitations</strong>, and accept this invite.
      You'll need to sign in with the email address this was sent to:
      <strong>{inviteeEmail}</strong>
    </p>
  </div>
  <p style="font-size: 13px; color: #5B5F45; margin: 0;">
    This invitation expires in 7 days.
  </p>
</div>
```

**Error codes (all non-2xx responses):**
- `invalid_email`, `already_invited`, `already_caretaker`
- `self_invite`, `email_send_failed`, `unauthorized`

### Client service: `src/services/caretakerService.ts`

```typescript
// New file. Exports for Phase 2:
// - inviteCaretaker(email: string, opts?: { expiresAt?: string })
//     → calls invite-caretaker Edge Function via supabase.functions.invoke
// - listMyInvites()
//     → SELECT from garden_invites WHERE owner_id = me AND accepted_at IS NULL
// - listMyCaretakers()
//     → SELECT from garden_caretakers JOIN profiles WHERE owner_id = me
// - cancelInvite(inviteId: string) → DELETE from garden_invites
// - revokeCaretaker(caretakerId: string) → DELETE from garden_caretakers
// - updateCaretakerExpiry(caretakerId: string, expiresAt: string | null)
//     → UPDATE garden_caretakers

// Exports needed in later phases (declare but don't implement if simpler):
// - listGardensImCaretaking()  — Phase 3/4
// - listPendingInvitesForMe()  — Phase 3
// - acceptInvite(inviteId: string)  — Phase 3
// - declineInvite(inviteId: string)  — Phase 3
```

### UI: `src/screens/ManageCaretakersScreen.tsx`

New screen, accessible from `SettingsScreen` via a new row "Caretakers".

Layout (Hemlock background, follows existing Settings aesthetic):

- Section header: "People caring for your garden"
- For each row in garden_caretakers: Butter Moon card with:
  - Avatar (initials fallback if avatar_url null)
  - Display name (fallback: email prefix)
  - If expiresAt set: "Until Apr 28, 2026"
  - "..." menu with: Set expiry / Remove
- Empty state: "No caretakers yet. Invite someone to help care for your plants."
- Section header: "Pending invites"
- For each row in garden_invites: muted card with:
  - Email
  - "Sent 2 days ago" (use existing date-relative util if exists, else write one)
  - "Cancel" link (DELETE from garden_invites)
  - If `invite_expires_at < NOW()`: show "Expired" + "Resend" button (which creates new invite)
- Vermillion CTA at bottom: "Invite a caretaker" → navigates to InviteCaretakerScreen

### UI: `src/screens/InviteCaretakerScreen.tsx`

New screen, modal presentation.

- TextInput: caretaker email
  - autoFocus={true}
  - keyboardType="email-address"
  - autoCapitalize="none"
  - maxLength 100
  - accessibilityLabel="Caretaker email"
- Optional section: "Set an expiry"
  - Switch/toggle, off by default
  - When on: date picker, defaults to 2 weeks from now, min today+1 day
- Vermillion CTA: "Send invite"
  - Disabled until email is non-empty and valid format
  - On press: calls `inviteCaretaker()`, shows loading state
  - On success: close modal, show toast "Invitation sent to {email}"
  - On error: inline error message below form with user-friendly text

**Error display mapping:**
- `invalid_email` → "That doesn't look like a valid email address."
- `already_invited` → "You've already invited this person. Check your pending invites."
- `already_caretaker` → "This person is already caring for your garden."
- `self_invite` → "You can't invite yourself."
- `email_send_failed` → "Couldn't send the invitation. Please try again."
- default → "Something went wrong. Please try again."

### Navigation

Add to `src/types/navigation.ts`:

```typescript
ManageCaretakers: undefined;
InviteCaretaker: undefined;
```

Register both in App.tsx navigator. `InviteCaretaker` should use modal
presentation (`presentation: 'modal'`).

Add a "Caretakers" row in `SettingsScreen` that navigates to `ManageCaretakers`.

**Verify:**
- Owner enters caretaker email → email arrives within 30s at that address
- Owner sees pending invite in ManageCaretakersScreen
- Owner can cancel pending invite (row disappears from list)
- Owner cannot invite self (error shown inline)
- Owner cannot invite same email twice (clear error message)
- Email body renders correctly in Gmail, Apple Mail (check both if possible)
- All interactive elements have `accessibilityLabel`
- TypeScript: no errors, no `any`, no `@ts-ignore`

**Depends on:** Phase 0 (Resend — done), Phase 1 (schema — done).

**Time estimate:** 3.5 hours (1.5 backend, 2 frontend).

**Risk:** Email deliverability. If invites land in spam, the whole feature
fails silently. Test from a fresh Gmail account. If spam: SPF/DKIM records
on `viraplants.com` may need strengthening — check Resend dashboard logs.

---

## Phase 3 — Invite Acceptance (Caretaker Side)

**What:** Caretaker can see pending invites in Settings and accept or
decline them. After acceptance, they appear in `garden_caretakers` and can
access the owner's garden.

**Why:** Without acceptance, an invite is just a row in a table. This phase
turns invites into actual access.

**How:**

### Edge Function: `accept-invite`

Create `supabase/functions/accept-invite/index.ts`:

```typescript
// Input: { inviteId: string }
// Output: { success: true, ownerId: string, ownerName: string } | { error }

// 1. Decode JWT, get caretaker_id and caretaker_email (from auth.users via service role)
// 2. Look up invite by id
// 3. Verify invitee_email matches caretaker_email (case-insensitive)
//    — protects against guessing an invite id for someone else's invite
// 4. Check invite isn't already accepted, isn't past invite_expires_at
// 5. Insert into garden_caretakers with expires_at from invite (atomic with step 6)
// 6. UPDATE garden_invites SET accepted_at = NOW() WHERE id = invite.id
// 7. Get owner's display_name from profiles
// 8. Return { success: true, ownerId, ownerName }
```

Use a single transaction in the Edge Function (service role) for steps 5-6 so
the caretakers row and invite update happen together. If step 6 fails after
step 5 succeeds, the user ends up with duplicate garden access attempts on
retry.

**Error codes:**
- `invite_not_found`, `invite_already_accepted`, `invite_expired`
- `email_mismatch` (JWT email doesn't match invite's invitee_email)
- `already_caretaker` (edge case — shouldn't happen but handle cleanly)

Decline is handled client-side via `declineInvite(inviteId)` which is a plain
DELETE on `garden_invites` (RLS policy `owner_or_invitee_can_delete` allows it).
No Edge Function needed.

### UI: Pending Invitations in Settings

Modify `SettingsScreen` to show a "Pending invitations" section at the top
(before the existing Account section), but ONLY if there are pending invites:

```tsx
{pendingInvites.length > 0 && (
  <View>
    <SectionHeader>Pending invitations</SectionHeader>
    {pendingInvites.map(invite => (
      <PendingInviteCard
        key={invite.id}
        invite={invite}
        onAccept={() => handleAccept(invite.id)}
        onDecline={() => handleDecline(invite.id)}
      />
    ))}
  </View>
)}
```

`PendingInviteCard` design (Butter Moon background):
- "{ownerName} wants you to help care for their plants"
- "Sent 2 days ago"
- Two buttons: "Accept" (Vermillion) and "Decline" (outlined)
- If `invite_expires_at < NOW()`: dim the card, show "This invite has expired",
  only "Dismiss" button

On mount and on pull-to-refresh, call `listPendingInvitesForMe()`. No
real-time subscription. No separate screen. No bell icon.

After successful accept:
- Show toast: "You're now caring for {ownerName}'s garden"
- Refresh pending invites list (row vanishes)
- Refresh garden list in useGardenStore (Phase 4) — but in Phase 3, this
  store doesn't exist yet, so just leave a TODO to trigger refresh here
  when Phase 4 lands

**Verify:**
- Owner (Phase 2) sends invite to a second test account
- Second account opens Settings, sees pending invitation at top
- Accept creates `garden_caretakers` row (verify in Supabase table view)
- Accept removes the invite from pending list
- Decline removes the invite cleanly (DELETE works via RLS)
- Expired invites (> 7 days) show expired state, can be dismissed
- All accept/decline buttons have `accessibilityLabel`

**Depends on:** Phase 2.

**Time estimate:** 2 hours.

**Risk:** Low. Single screen plus one Edge Function.

---

## Phase 4 — Garden Context & Account Switching

**What:** Introduce `activeGardenId` as a piece of client state. Build the
home header dropdown that shows the active garden and opens a bottom sheet
to switch between owned + caretaking gardens.

**Why:** This is the moment caretaker mode goes from "data exists in DB"
to "I can actually see another person's garden in the app." Also where
Phase 1's RLS gets its real test.

**How:**

### State: `src/stores/useGardenStore.ts` (new)

```typescript
interface Garden {
  ownerId: string;          // auth.users.id of the garden's owner
  ownerName: string;        // display_name from profiles, fallback to email prefix
  ownerAvatarUrl?: string;
  role: 'owner' | 'caretaker';
  plantCount: number;       // computed from loaded plants
  expiresAt?: string;       // for caretaker gardens with expiry
}

interface GardenStore {
  myGarden: Garden;          // always present — the user's own
  caretakingGardens: Garden[]; // gardens this user is caretaking (active, non-expired)
  activeGardenId: string;    // defaults to myGarden.ownerId
  isLoading: boolean;

  setActiveGarden: (gardenId: string) => void;  // persists to AsyncStorage
  loadGardens: () => Promise<void>;              // refresh from Supabase
}
```

`activeGardenId` persists to AsyncStorage (key: `activeGardenId`) so the
user stays in their last-used garden across app launches.

Filter out expired caretaking gardens at load time: `expires_at IS NULL OR expires_at > NOW()`.

### Refactor: `usePlantStore.loadPlants()` becomes garden-scoped

Currently:
```typescript
.from('plants').select('*').eq('user_id', auth.user.id)
```

Change to:
```typescript
.from('plants').select('*').eq('user_id', activeGardenId)
```

Where `activeGardenId` is read from `useGardenStore.getState().activeGardenId`.

RLS gates this server-side (if `activeGardenId` is wrong for this caller,
they get 0 rows). The eq filter is for correctness (only show active
garden's plants), not security.

When `setActiveGarden` is called: clear plants, call `loadPlants()` again.

### UI: Home header dropdown + bottom sheet

Modify `HomeScreen.tsx` header:

- Replace the static title with a `<TouchableOpacity>` containing:
  - Active garden name (large)
  - Small chevron icon (down arrow)
  - Below: "{plantCount} plants" subtitle in Thistle
- If `caretakingGardens.length === 0`: render title WITHOUT chevron, no tap
  target — feature is invisible for solo users (critical for zero regression)
- If `caretakingGardens.length >= 1`: tap opens `GardenPickerBottomSheet`

Create `src/components/GardenPickerBottomSheet.tsx`:

- React Native's built-in `Modal` with `animationType="slide"`
  (don't add `@gorhom/bottom-sheet` dependency just for this)
- Header: "Switch garden"
- For each garden: row with
  - Circular avatar (40px): initials if no avatar_url
  - Display name (15pt, medium weight)
  - Plant count + role badge ("Owner" / "Caretaker")
  - Checkmark icon if active
- Tapping a row: `setActiveGarden(garden.ownerId)`, dismiss sheet,
  HomeScreen reloads automatically via state change

Avatar styling:
- Owner garden: Hemlock background + Butter Moon initials
- Caretaker gardens: Luxor background + Butter Moon initials
  (visually distinct — signals "not your garden")

### Caretaker write-gating

When `activeGardenId !== auth.user.id`:
- Hide the "+" FAB on HomeScreen (caretakers can't add plants)
- On PlantDetailScreen:
  - Hide "Edit" button in header
  - Hide "Remove plant" action
  - Mark Watered / Mark Fertilized buttons STAY visible
  - The plant's Notes field (existing, owner-editable) goes read-only
    (caretakers' notes go in new section — Phase 5)

### Watering reminder behavior in v1

Reminders continue to fire on the owner's device only — same as today. When
a caretaker marks a plant as watered, the next reminder still reschedules
correctly (the reminder is tied to the plant's last watering date, which
updates regardless of who marked it). If the owner is on vacation and the
caretaker waters, the owner's phone correctly skips the reminder on
next evaluation.

True per-share routing (caretaker gets reminders instead of owner) ships
in v1.1 after Notifee is confirmed working on physical devices.

**Verify:**
- Solo user (0 caretaking gardens): HomeScreen header has no dropdown
  affordance — app looks and behaves identically to today
- Caretaker (1+ caretaking gardens): dropdown appears, tap opens bottom sheet
- Switch to caretaking garden: plant list updates to that garden's plants
- "+" FAB hidden when viewing caretaking garden
- Edit Plant button hidden on PlantDetail in caretaking garden
- Mark Watered button works on caretaker's plant → care_event row created
- Force-quit + relaunch: app opens to last-active garden
- Switching is fast (< 300ms): cache loaded plants per garden, don't refetch
  on every switch unless pull-to-refresh
- All toggles have `accessibilityLabel`
- This is also where Phase 1's RLS gets live-tested: try seeing a plant
  owned by a test user WITHOUT a garden_caretakers row — should not appear

**Depends on:** Phase 3.

**Time estimate:** 6 hours. Largest phase by code volume — touches Home
screen, PlantDetail screen, introduces new store.

**Risk:** Most likely phase to introduce regressions in existing single-user
experience. Test thoroughly with an account that has zero caretaking gardens
— the app should look and behave EXACTLY as it does today.

---

## Phase 5 — Caretaker Notes

**What:** Add the "Caretaker notes" section to PlantDetailScreen.
Caretakers can add notes attributed to themselves; owners can read them.

**Why:** The whole point of caretaker mode being trustworthy. Without this,
a caretaker has no way to communicate "the soil was bone dry" back to
the owner.

**How:**

### Service: `src/services/caretakerNotesService.ts`

```typescript
interface CaretakerNote {
  id: string;
  plantId: string;
  authorId: string;
  authorName: string;     // joined from profiles
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
}

// Exports:
// - listNotes(plantId: string): CaretakerNote[]  — newest first
// - addNote(plantId: string, body: string): CaretakerNote
// - deleteNote(noteId: string): void  — RLS enforces author-only
```

### UI: PlantDetailScreen

Add a new section below the existing care history, ABOVE the Vira Pot
"Coming Soon" placeholder.

Each note:
- Butter Moon card with rounded corners
- Author row: small avatar (28px) + author name + relative timestamp
- Body in Lagoon, ~14pt, generous line-height
- If current user is the author: long-press or "..." reveals Delete

"Add note" button at bottom of section:
- Outlined style
- Opens a modal/sheet with multi-line TextInput (maxLength 1000)
- Save = `addNote()`, Cancel = close

Empty state: muted "No notes yet" with the Add CTA (don't hide section).

Refetch notes on screen mount and pull-to-refresh. No real-time subscription.

**Verify:**
- Caretaker can add a note on a plant in owner's garden
- Note appears with caretaker's display name + avatar
- Owner sees the note when they open the same plant
- Owner can read but cannot delete caretaker's note
- Caretaker can delete their own note
- Owner can also add a note (shows with owner's name — fine, it's a per-plant wall)
- Note body respects maxLength 1000
- Empty state renders cleanly
- All buttons have `accessibilityLabel`

**Depends on:** Phase 4.

**Time estimate:** 3 hours.

**Risk:** Low. Self-contained feature on a single screen. RLS already correct.

---

## Phase 6 — TestFlight Build 6

**What:** Ship caretaker mode to TestFlight as build 6.

**How:** Follow the existing TestFlight build checklist from Apr 16 handoff:

1. Verify `DEVELOPMENT_TEAM` set in pbxproj (run sed fix)
2. Bump build number: `cd ios && agvtool new-version -all 6 && cd ..`
3. Pod install
4. Clear derived data
5. Clean archive to distinct path: `/tmp/ViraPlantsTemp6.xcarchive`
6. Verify bundle ID in archive
7. Upload via Organizer
8. Wait for processing
9. Test end-to-end on Sam's TestFlight install + at least one cofounder

**Verify on TestFlight:**
- Send invite from Sam's account to a real second Apple ID
- Email arrives, recipient opens app, sees pending invite in Settings
- Accept on second device, switch to Sam's garden via header dropdown
- Add caretaker note from second device
- Verify Sam sees note in his app

---

## Compound Engineering Run Notes

- Run phases in order — each phase's verification must pass before starting next
- Commit at end of each phase: `feat(caretaker): phase N — <summary>`
- After Phase 4, do a manual smoke test ON SIMULATOR before Phase 5
- Update CLAUDE.md after each phase with completed work + new learnings
- Generate session handoff `.docx` at end of full run
- If any phase's verification fails: STOP, write failure to
  `test-results/cycle-NN-test.md`, do not proceed
- If ambiguity not resolved by plan: append to `questions.md` and proceed
  with best-guess interpretation; don't block

---

## What we cut (reference)

1. Generic `notifications` table — premature; pending invites surface in Settings
2. Notifications bell + NotificationsScreen — folded into Settings
3. Real-time subscriptions on notes — refetch on mount suffices
4. Deep linking from email — manual flow works for early users
5. `decline-invite` Edge Function — replaced by invitee DELETE RLS policy
6. Per-share reminder routing — deferred to v1.1

---

## Out of Scope (v2+)

- Per-plant sharing (v1 = whole-garden only)
- Care log attribution (notes are attribution surface in v1)
- Owner notifications when caretaker waters/fertilizes/notes
- Garden-level notes (per-plant only in v1)
- Transitive sharing, public share links, co-owner roles
- Daily digest emails
- Real-time on notes
- Deep linking
- Per-share reminder routing (v1.1)

If any of these come up as "easy to add" — STOP. Add to deferred list, ship v1.

---

*Vira Technologies Inc. · Caretaker Mode CE Plan v2.1 · April 20, 2026*
