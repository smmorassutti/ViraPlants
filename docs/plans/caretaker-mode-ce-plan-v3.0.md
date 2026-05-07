# Caretaker Mode — Compound Engineering Plan v3.0

**Version:** 3.0
**Last updated:** Apr 24, 2026
**Replaces:** v2.1 (Phases 0–3 detail)
**Adds:** Phase 4 (full detail), Phases 5–6 (sketch only)
**Repo:** github.com/smmorassutti/ViraPlants
**Supabase project:** yxidmviucaaztdnkxxvw

---

## Overview

Caretaker mode lets a plant owner invite another person to help care for their plants while they are away or otherwise unable to. The feature ships in six phases, each independently verifiable. Phases 0–3 are shipped and live in production; Phase 4 is the next execution block; Phases 5–6 are forward sketches.

| Phase | Status | Theme |
|-------|--------|-------|
| 0 | ✅ Shipped | Resend + DNS + schema migration 003 |
| 1 | ✅ Shipped | RLS helpers, `has_garden_access(uuid)` |
| 2 | ✅ Shipped | Owner-side invite flow |
| 3 | ✅ Shipped | Caretaker-side accept flow |
| **4** | **▶ Active** | **Garden switching, RLS reads, write-gating** |
| 5 | Sketch | Caretaker notes |
| 6 | Sketch | TestFlight build 6 + e2e cross-account test |

Phase 4 is the architectural hinge of the feature. Until Phase 4, every read in the app assumed "the signed-in user is the only owner whose data they can see." Phase 4 changes that assumption. It is also the first phase where Postgres RLS is actually exercised by non-owner reads — the `has_garden_access(uuid)` helper has been in place since Phase 0 but never called by anything other than the function's own author.

---

## Phases 0–3 — Shipped

These phases are live in production. For implementation detail see prior versions of this plan and the relevant entries in `CLAUDE.md`.

- **Phase 0–1** — schema migration `003_caretaker_mode.sql` (+ `003b` patch), `has_garden_access(uuid)` SECURITY DEFINER helper, `_shared/sendEmail.ts` Resend integration, DNS records on viraplants.com.
- **Phase 2** — owner-side invite flow. `invite-caretaker` and `caretaker-invites` Edge Functions, `caretakerService.ts`, `ManageCaretakersScreen` + `InviteCaretakerScreen`. Test record in `test-results/phase-2-test.md`.
- **Phase 3** — caretaker-side acceptance. Migration `004_accept_invite_rpc.sql` (`accept_garden_invite` SECURITY DEFINER RPC), `accept-invite` Edge Function, `PendingInviteCard`, Settings "Pending invitations" section. Three post-ship bugs (RPC 42702 column ambiguity, Edge Function field-name drift, RLS union scope bug) fixed in commit `3cc7566`. Test record in `test-results/phase-3-test.md`.

Phase 3 lessons that bear directly on Phase 4 are captured in §"Risk areas" below.

---

## Phase 4 — Garden switching, RLS, write-gating

### Phase 4 in one paragraph

A caretaker who has accepted an invite (Phase 3) can now actually do something with that access. They can switch into the owner's garden from the home screen header, see the owner's plants, mark them watered or fertilized, and have those care events visibly attributed to them. They cannot add, edit, or remove plants — those write paths are gated at both the UI layer (controls hidden) and the database layer (RLS rejects the write with 42501). The `activeGardenId` persists across app launches, falling back silently to the user's own garden if the persisted ID is no longer accessible.

### Critical pre-flight verification (do this BEFORE starting the Claude Code session)

Phase 4 assumes the `plants` table's RLS allows caretakers to SELECT rows where `user_id` is a garden they have access to. This was supposedly set up by migration 003, but **has never been exercised by a non-owner read.** If the policy doesn't exist or is wrong, Phase 4 fails at pause point 1.

Run this in the Supabase Dashboard SQL Editor:

```sql
-- Check existing SELECT policies on plants
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_clause
FROM pg_policy
WHERE polrelid = 'public.plants'::regclass
  AND polcmd = 'r';  -- 'r' = SELECT

-- Expected: at least one policy whose using_clause references has_garden_access(user_id)
-- or has_garden_access(plants.user_id), e.g.:
--   (auth.uid() = user_id) OR has_garden_access(user_id)
```

**If no such policy exists,** add migration `005a_plants_caretaker_select.sql` BEFORE migration 005:

```sql
DROP POLICY IF EXISTS plants_select_own ON public.plants;

CREATE POLICY plants_select_with_caretaker_access ON public.plants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_garden_access(user_id)
  );
```

If the policy DOES exist and references `has_garden_access`, you're good. Skip 005a, go to 005.

**Why this matters:** the rest of the plan treats this RLS as a given. Without it, every caretaker plant-read returns zero rows and pause point 1 fails immediately. Catching it before the session starts saves hours.

### Locked design decisions

These were resolved during the Apr 24 stress-test conversation. Re-litigating any of them requires a written reason.

- **D1 — Caretaker context indicator.** Full screen swap + persistent banner below the header. Copy: *"Caring for {ownerDisplayName}'s garden."* Butter Moon text on Hemlock background. Banner is tappable and opens the `GardenPickerBottomSheet`. Banner is shown ONLY when `activeGardenId !== ownGardenId`.
- **D2 — Care event attribution.** Small avatar/initials circle (20×20pt, Luxor background, Butter Moon text) on care events whose `author_id` differs from the currently-viewing user. The user's own actions are unmarked, to avoid visual noise for the common case. Initials computed from cached `display_name` via the same `getInitials` util used in Settings.
- **D3 — `activeGardenId` persistence.** Zustand `persist` middleware → AsyncStorage. Storage key: `vira:activeGardenId`. Persist `activeGardenId` only — NOT `gardens[]` (that gets refetched). On app launch, rehydrate before `loadGardens`. If the persisted ID is stale (garden was revoked, expired, or user signed out and back in as a different account), fall back silently to `ownGardenId`.
- **D4 — Default garden on fresh state.** Always own garden on first load. The store carries `ownGardenId` separately from `activeGardenId` so fallback is unambiguous. `ownGardenId` is derived from the signed-in user's UUID (every user owns exactly one garden, identified by their own user_id).
- **D5 — DROPPED from scope.** Owner-facing acceptance badge (`owner_seen_at` column + badge on `ManageCaretakersScreen`) is dropped. The "People caring for your garden" section already shows accepted caretakers — that IS the confirmation surface. A badge on top of it would be decorative noise plus a write-on-read anti-pattern.
- **D6 — Forbidden action UX.** Two-layer defense. **(1) UI-level gating** — hide the control entirely (FAB on HomeScreen, Edit/Remove on PlantDetailScreen, AddPlantScreen unreachable). **(2) RLS-level backstop** — if a caretaker somehow hits a forbidden endpoint (stale UI, race, bug), Postgres returns 42501 and a generic error toast fires. There is no per-action error copy. The toast is a bug-detection signal, not a user-facing feature.
- **Revocation handling.** Silent. When `loadGardens()` discovers the persisted `activeGardenId` is no longer in the caretaking set (revoked or expired), the store falls back to `ownGardenId` and re-renders. No toast, no alert. Being a caretaker is a gift from the owner — the app doesn't need to eulogize its withdrawal.

### Open questions resolved

These were the four open questions from the Phase 4 planning handoff. All locked before this plan was written.

- **Q1 — Does `care_events` already have `author_id`?** No. The table has `user_id` (NOT NULL, no default), which today always holds the owner's UUID because before Phase 4, only owners could log care. **Resolution:** rename `user_id → author_id` in migration 005. Existing data is correct under the new name (owner is the author for all pre-Phase-4 rows). This is cleaner than adding `author_id` alongside `user_id`, which would create a permanent denormalization with `plants.user_id` that has to stay in sync forever. See §"Migration 005" below for the full SQL.
- **Q2 — `get_my_gardens()` shape.** Postgres function (not view), `garden_*` prefixed return columns per the Phase 3 42702 lesson, explicit `SECURITY INVOKER`, `EXECUTE` granted to `authenticated`. Full DDL in §"4.0 — Schema + RPC" below.
- **Q3 — `loadPlants()` signature.** Explicit `gardenId` parameter. `loadPlants(gardenId: string)` rather than reading from `useGardenStore.getState()` internally. This is the first multi-garden phase; when scoping bugs surface, you want to grep for `loadPlants(` and immediately see every call site with which garden ID it's loading. Cross-store hidden coupling makes those bugs harder to trace.
- **Q4 — When does `loadGardens()` fire?** Three triggers: (a) auth-state change to non-null session, (b) successful `acceptInvite` (replaces the `TODO(phase-4)` in `SettingsScreen.handleAcceptInvite`), (c) `GardenPickerBottomSheet` open. NOT on app foreground after backgrounding. Stale-access caretakers fail with 42501 and the generic toast — acceptable for an edge case.
- **Q5 — Bottom sheet library.** Start with React Native `Modal` + `animationType="slide"`. No new dependency. If pause point 2's tap-through reveals UX issues, upgrade to `@gorhom/bottom-sheet` later. Phase 4 is not gated on a new heavy dep.

### Out of scope for Phase 4

- **Owner-facing acceptance badge** (`owner_seen_at`). Dropped per D5.
- **Real-time subscriptions** on `garden_caretakers`. Caretakers whose access is revoked mid-session discover it on next `loadGardens`, not instantly.
- **Deep linking** into a specific caretaking garden. Caretakers land on own garden on launch, switch manually.
- **Caretaker notes** — that's Phase 5.
- **Owner-side expiry-greying UI**. RLS already filters expired caretaking access from `get_my_gardens()`; owner-side visual indicator can come later.
- **Push notification to owner when caretaker logs care.** Deferred indefinitely. Adds a notifications table we don't want yet, and not a user request.

### Execution model

Single Claude Code session with **three explicit pause points**. NOT fully autonomous. Each pause is for the human to run manual verification at that layer before the next layer is built on top of unverified ground.

- **Pause 1** — after 4.0–4.2: schema migration 005 + `useGardenStore` + `get_my_gardens()` RPC + `loadPlants(gardenId)` refactor. Verify: SQL probes that prove RLS works for caretaker reads, and a clean app launch as caretaker that loads the right plants.
- **Pause 2** — after 4.3–4.4: `gardenService.ts` + Header dropdown + `GardenPickerBottomSheet` + persistent banner. Verify: visual tap-through, switching gardens actually swaps the plant list, banner shows/hides correctly.
- **Pause 3** — after 4.5–4.6: care event attribution avatars + write-gating. Verify: caretaker tap-through confirms no Edit/Remove/Add entry points, but Mark Watered/Fertilized works and shows a Luxor avatar circle on the owner's view.

---

## Migration 005 — `care_events.author_id`

**File:** `supabase/migrations/005_care_event_author.sql`

**Pre-flight before applying** (these MUST happen before pasting the migration):

1. Run `SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.care_events'::regclass;` and copy the actual policy names. Update the `DROP POLICY IF EXISTS` lines below to match. The names below are conventional but may differ in your DB.
2. Run `SELECT indexname FROM pg_indexes WHERE tablename = 'care_events';` and verify the index names below match. Adjust if not.
3. Run `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.care_events'::regclass AND contype = 'f';` to see existing foreign keys. If a FK on `user_id` references `auth.users(id)`, the rename preserves it (renaming a column doesn't drop FKs) — but we want to redirect the FK to `public.profiles(id)` so PostgREST can embed `profiles.display_name`. If a FK exists, capture its name; the migration drops it and recreates against `profiles`.
4. Grep the repo for `care_events.user_id`, the string literal `'user_id'` near care-event code, and `rowToCareEvent` — every reference needs to be updated in the same commit. Expected hits: `src/services/plantService.ts` (row mapper), possibly `src/types/plant.ts` (CareEvent type field).

**The migration:**

```sql
-- Migration 005 — rename care_events.user_id → author_id
-- Rationale: care_events.user_id has always been the actor (the person who
-- logged the care). Before Phase 4, that actor was always the plant's owner,
-- so the column was redundant with plants.user_id via plant_id. Phase 4 lets
-- caretakers log care, so the column now genuinely needs to mean "actor" —
-- which is what author_id means everywhere else in the schema (compare
-- caretaker_notes.author_id). This is a pure rename: no data movement,
-- no backfill — every existing row's user_id IS the correct author.
--
-- This migration is applied via Supabase Dashboard SQL Editor, same pattern
-- as 003/003b/004. The Dashboard runs each statement and reports failures
-- per-statement; we do NOT wrap in BEGIN/COMMIT because (a) the Dashboard's
-- multi-statement run mode is not a true transaction, (b) prior migrations
-- in this project don't use it. If a statement fails partway through, the
-- DB is left in a partially-migrated state. Pre-flight steps above are
-- specifically to prevent this; if you've done them, the rename will not
-- fail. If you skip them, you'll discover a missing policy at the rename
-- step and have a half-migrated table — recoverable but tedious.

-- Step 1: drop existing RLS policies that reference user_id
-- (Adjust names to match pre-flight step 1 output)
DROP POLICY IF EXISTS care_events_select_own ON public.care_events;
DROP POLICY IF EXISTS care_events_insert_own ON public.care_events;
DROP POLICY IF EXISTS care_events_update_own ON public.care_events;
DROP POLICY IF EXISTS care_events_delete_own ON public.care_events;

-- Step 2: drop existing FK on user_id (if it exists; name from pre-flight 3)
-- This is needed so we can redirect the FK to profiles.id rather than
-- auth.users(id), which lets PostgREST embed profiles.display_name on read.
ALTER TABLE public.care_events
  DROP CONSTRAINT IF EXISTS care_events_user_id_fkey;

-- Step 3: drop indexes that reference user_id by name (recreate after rename)
DROP INDEX IF EXISTS care_events_user_id_idx;
DROP INDEX IF EXISTS care_events_user_id_created_at_idx;

-- Step 4: the actual rename
ALTER TABLE public.care_events RENAME COLUMN user_id TO author_id;

-- Step 5: add FK on the renamed column → profiles.id
-- profiles.id is itself FK'd to auth.users(id) with ON DELETE CASCADE,
-- so deleting an auth user still cascades correctly.
ALTER TABLE public.care_events
  ADD CONSTRAINT care_events_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Step 6: recreate indexes on the renamed column
CREATE INDEX care_events_author_id_idx ON public.care_events(author_id);
CREATE INDEX care_events_author_id_created_at_idx
  ON public.care_events(author_id, created_at DESC);

-- Step 7: recreate RLS policies using author_id, with caretaker access added.
-- A caretaker can SELECT and INSERT care events for plants in gardens they
-- have access to. Only the author of an event can UPDATE or DELETE it.

-- SELECT: own events OR events on plants in gardens you have access to.
-- The "own events" branch means a former caretaker still sees their own
-- historical care contributions even after access is revoked. Intentional.
CREATE POLICY care_events_select ON public.care_events
  FOR SELECT
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_events.plant_id
        AND public.has_garden_access(p.user_id)
    )
  );

-- INSERT: only into plants in gardens you have access to, and only with
-- author_id = your own UID. The author_id check prevents impersonation.
CREATE POLICY care_events_insert ON public.care_events
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_events.plant_id
        AND public.has_garden_access(p.user_id)
    )
  );

-- UPDATE/DELETE: only your own care events.
CREATE POLICY care_events_update_own ON public.care_events
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY care_events_delete_own ON public.care_events
  FOR DELETE
  USING (author_id = auth.uid());
```

**Apply via:** Supabase Dashboard SQL Editor. Run each step in order. If a step fails, fix the issue (most likely a name mismatch from skipping pre-flight) and continue from the failed step.

**Backfill** the file to `supabase/migrations/005_care_event_author.sql` locally after success. Replayability note: this migration is NOT idempotent on a fresh DB (the FK and policy CREATE statements have no `IF NOT EXISTS`), which is intentional — replaying on a partially-migrated DB will fail loudly, telling you exactly which statement to skip on the manual replay.

---

## 4.0 — `get_my_gardens()` RPC

**File:** `supabase/migrations/006_get_my_gardens.sql` (or appended to 005 if applied in the same SQL Editor session)

**What:** Postgres function that returns the union of (a) the user's own garden, (b) gardens they are a caretaker of with non-expired access.

**Why:** A single source of truth for "what gardens can I look at right now." Used by `useGardenStore.loadGardens()`. Function rather than view because the union with role discrimination is cleaner in PL/pgSQL than in PostgREST, and avoids creating a new view that would need its own RLS.

**How:**

```sql
CREATE OR REPLACE FUNCTION public.get_my_gardens()
RETURNS TABLE (
  garden_id uuid,
  garden_owner_id uuid,
  garden_owner_display_name text,
  garden_role text,           -- 'owner' | 'caretaker'
  garden_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- own garden
  SELECT
    auth.uid() AS garden_id,
    auth.uid() AS garden_owner_id,
    COALESCE(p.display_name, '') AS garden_owner_display_name,
    'owner'::text AS garden_role,
    NULL::timestamptz AS garden_expires_at
  FROM public.profiles p
  WHERE p.id = auth.uid()
  UNION ALL
  -- caretaking gardens (non-expired only)
  SELECT
    gc.owner_id AS garden_id,
    gc.owner_id AS garden_owner_id,
    COALESCE(p.display_name, '') AS garden_owner_display_name,
    'caretaker'::text AS garden_role,
    gc.expires_at AS garden_expires_at
  FROM public.garden_caretakers gc
  LEFT JOIN public.profiles p ON p.id = gc.owner_id
  WHERE gc.caretaker_id = auth.uid()
    AND gc.accepted_at IS NOT NULL
    AND (gc.expires_at IS NULL OR gc.expires_at > now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_gardens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_gardens() TO authenticated;
```

**Notes on the design:**

- `garden_*` prefix on every output column. Phase 3's 42702 lesson — output column names must not collide with any column on any table the function body touches.
- `SECURITY INVOKER` (not DEFINER). The function relies on RLS to scope what the caller can read from `garden_caretakers` and `profiles`. Making it DEFINER would punch through RLS and require extra defensive checks.
- Expired caretaking access is filtered IN the function. The client never sees an expired garden — `gardens[]` in `useGardenStore` only ever contains valid options. This means the client never has to think about expiry.
- The `LEFT JOIN` to `profiles` is intentional: a caretaking row should still surface even if the owner's profile somehow isn't in `profiles` (shouldn't happen given the auto-creation trigger, but defense-in-depth). `garden_owner_display_name` falls back to empty string in that case; the client should handle empty/null gracefully.
- For change iteration during development, use `DROP FUNCTION IF EXISTS public.get_my_gardens(); CREATE FUNCTION ...` — `CREATE OR REPLACE` cannot change the return signature (Phase 3 42P13 lesson).

**Verify:**

```sql
-- Run as the owner account (via a service-role session or pg_session_jwt impersonation)
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, garden_role = 'owner'

-- Run as caretaker2 (UUID 2cb00f43-aa7d-4884-9423-a8593d3f917b)
SELECT * FROM public.get_my_gardens();
-- Expect: 2 rows, one role='owner' (their own garden), one role='caretaker' (caring for owner)

-- Run as a fresh user with no caretaking relationships
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, role='owner', their own garden only
```

**Depends on:** schema migration 003 + 003b applied (already shipped).

---

## 4.1 — `useGardenStore`

**File:** `src/stores/useGardenStore.ts`

**What:** Zustand store holding `ownGardenId`, `activeGardenId`, `gardens[]`, `isLoading`. Persists `activeGardenId` to AsyncStorage.

**Why:** Single source of truth for "which garden is the UI currently showing." Decouples garden state from plant state so `usePlantStore` can stay focused on plants.

**How:**

```typescript
// src/types/garden.ts
export type GardenRole = 'owner' | 'caretaker';

export interface Garden {
  gardenId: string;          // = owner's user_id
  gardenOwnerId: string;     // = owner's user_id (same as gardenId, kept for clarity)
  gardenOwnerDisplayName: string;
  gardenRole: GardenRole;
  gardenExpiresAt: string | null;
}

// src/stores/useGardenStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Garden } from '../types/garden';
import { listMyGardens } from '../services/gardenService';

interface GardenState {
  ownGardenId: string | null;
  activeGardenId: string | null;
  gardens: Garden[];
  isLoading: boolean;
  loadGardens: (currentUserId: string) => Promise<void>;
  setActiveGarden: (gardenId: string) => void;
  clearOnSignOut: () => void;
}

export const useGardenStore = create<GardenState>()(
  persist(
    (set, get) => ({
      ownGardenId: null,
      activeGardenId: null,
      gardens: [],
      isLoading: false,

      loadGardens: async (currentUserId) => {
        set({ isLoading: true });
        try {
          const gardens = await listMyGardens();
          const ownGardenId = currentUserId;
          // If persisted activeGardenId is no longer in the list, fall back silently.
          const persisted = get().activeGardenId;
          const stillValid = persisted && gardens.some(g => g.gardenId === persisted);
          set({
            gardens,
            ownGardenId,
            activeGardenId: stillValid ? persisted : ownGardenId,
            isLoading: false,
          });
        } catch (err) {
          console.warn('[useGardenStore] loadGardens failed', err);
          set({ isLoading: false });
        }
      },

      setActiveGarden: (gardenId) => set({ activeGardenId: gardenId }),

      clearOnSignOut: () => set({
        ownGardenId: null,
        activeGardenId: null,
        gardens: [],
        isLoading: false,
      }),
    }),
    {
      name: 'vira:activeGardenId',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist activeGardenId only — gardens[] and ownGardenId are derived/refetched.
      partialize: (state) => ({ activeGardenId: state.activeGardenId }),
    }
  )
);
```

**Notes:**

- The persisted shape is just `{ activeGardenId: string | null }`. `gardens[]` and `ownGardenId` are NOT persisted; they're recomputed every session from the RPC + the auth user. This avoids the staleness pitfalls of caching `gardens[]` to disk.
- `loadGardens` accepts `currentUserId` as a parameter so the store doesn't need to import `useAuthStore`. Prevents cross-store circular imports.
- The fallback-to-own logic happens inside `loadGardens`, NOT in a getter. It runs once per `loadGardens` call. The reasoning: if we made it lazy ("compute the effective active garden on every read"), every component subscribed to `activeGardenId` would have to also know about `gardens[]` to validate it. Inlining the validation at load time means consumers can trust `activeGardenId` is always either valid or `ownGardenId`.
- `clearOnSignOut` is wired in `useAuthStore` after sign-out completes (existing call site).

### Rehydration race — REQUIRED handling

Zustand `persist` middleware rehydrates **asynchronously** from AsyncStorage. The store is created with `activeGardenId: null` and the persisted value is read in the background. If `App.tsx` calls `loadGardens(userId)` before rehydration completes, `loadGardens` reads `state.activeGardenId === null` (the default, not the persisted value), and `stillValid` is `false`, so the store falls back to `ownGardenId`. **The persisted preference is silently overwritten on every cold launch.** Persistence appears to work but doesn't.

The fix uses Zustand's `persist.onFinishHydration` hook. Wait for hydration before calling `loadGardens`:

```typescript
// In App.tsx auth-change handler (or wherever loadGardens is called for the first time):
useEffect(() => {
  if (!session?.user) return;

  let cancelled = false;

  async function init() {
    // Wait for persisted activeGardenId to rehydrate before loading.
    if (!useGardenStore.persist.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = useGardenStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
    }
    if (cancelled) return;

    await useGardenStore.getState().loadGardens(session.user.id);
    if (cancelled) return;

    const activeId = useGardenStore.getState().activeGardenId;
    if (activeId) {
      await usePlantStore.getState().loadPlants(activeId);
    }
  }

  init();
  return () => { cancelled = true; };
}, [session?.user?.id]);
```

`useGardenStore.persist.hasHydrated()` returns true if rehydration already completed (likely on warm-start or hot-reload). `onFinishHydration(cb)` fires once when rehydration completes; we use it on cold launches.

The `cancelled` flag handles the unmount/re-auth case so we don't fire `loadPlants` on a stale auth state.

**Verify:** Type checks (`npx tsc --noEmit`). Manual launch as owner + as caretaker2 in the simulator after 4.2 wiring. Specifically test: switch to owner's garden as caretaker2, force-quit the app, relaunch — should reopen on owner's garden, NOT fall back to "My plants."

**Depends on:** 4.0 (the `listMyGardens` RPC must exist).

---

## 4.2 — `usePlantStore.loadPlants(gardenId)` refactor

**File:** `src/stores/usePlantStore.ts` (existing)

**What:** Change `loadPlants()` signature to `loadPlants(gardenId: string)`. Filter the plants query by `gardenId` (which equals the garden owner's `user_id` in this schema).

**Why:** Until now, `loadPlants` implicitly loaded the signed-in user's own plants via RLS. Phase 4 needs to load *some other user's* plants, scoped through the caretaker relationship. The `gardenId` parameter makes the call site self-documenting.

**How:**

```typescript
// Before (sketch):
loadPlants: async () => {
  const { data, error } = await supabase
    .from('plants')
    .select('*, care_events(*)')
    .order('created_at', { ascending: false });
  // RLS scopes to own plants
}

// After (4.2 version — author display_name embed comes in 4.5):
loadPlants: async (gardenId: string) => {
  const { data, error } = await supabase
    .from('plants')
    .select('*, care_events(*)')
    .eq('user_id', gardenId)              // explicit scope
    .order('created_at', { ascending: false });
  // RLS allows: rows where user_id = auth.uid() OR has_garden_access(user_id)
  // ... map data to plants[], replace store state via set({ plants })
}
```

**Forward reference:** the `.select('*, care_events(*)')` will be updated in 4.5 to embed the author's display name via `care_events(*, author:profiles(display_name))`. For 4.2, just change the signature and add the `.eq('user_id', gardenId)` filter — don't touch the embed yet.

**Store state replacement is full, not merge.** `loadPlants` should do `set({ plants: mapped })` — the previous garden's plants are dropped from memory on switch. Multi-garden plant state is NOT kept in the store. Each garden switch is a fresh load. Consequence: a brief loading state when switching gardens (handled by existing isLoading flag).

**Call sites that need to update:**

- `App.tsx` — auth-change handler + activeGardenId subscription (the latter wires up in 4.4). Detailed code in the rehydration section of 4.1.
- `HomeScreen` — pull-to-refresh handler. Reads `activeGardenId` from `useGardenStore`, passes to `loadPlants`.
- `usePlantStore` itself — any internal callers after a mutation.

**The auth-change handler.** Use the rehydration-aware pattern from 4.1's "Rehydration race" section. Repeat here for clarity:

```typescript
// App.tsx
useEffect(() => {
  if (!session?.user) return;
  let cancelled = false;

  async function init() {
    if (!useGardenStore.persist.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = useGardenStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
    }
    if (cancelled) return;

    await useGardenStore.getState().loadGardens(session.user.id);
    if (cancelled) return;

    const activeId = useGardenStore.getState().activeGardenId;
    if (activeId) {
      await usePlantStore.getState().loadPlants(activeId);
    }
  }

  init();
  return () => { cancelled = true; };
}, [session?.user?.id]);
```

**Notes:**

- Optimistic writes (`addPlant`, `updatePlant`, `removePlant`) MUST continue to use the authenticated user's own user_id, not `activeGardenId`. Caretakers cannot create/edit/remove plants — Phase 4 write-gating ensures the UI doesn't expose those paths, but the RLS on `plants` is also the backstop. (`plants` already has owner-only INSERT/UPDATE/DELETE policies from migration 001.)
- `markWatered` / `logCareEvent` use `auth.uid()` (the actor) for `author_id` — this is what migration 005's INSERT policy expects.
- Pre-Phase-4 the `CareEvent` type's `userId` field becomes `authorId` as part of the migration 005 repo-wide rename. Update `src/types/plant.ts` and `rowToCareEvent` in the same commit as the migration.

**Verify:** Sign in as owner, plants load. Sign in as caretaker2, the persisted `activeGardenId` (or fallback to own) loads. Switch to owner's garden via the picker (after 4.4) — plants list updates and old garden's plants disappear from memory.

**Depends on:** 4.0 (RPC), 4.1 (store), migration 005 (so `author_id` column exists for the care event INSERTs the caretaker will perform).

---

## ⏸ PAUSE POINT 1 — after 4.2

**Stop the Claude Code session here. Do not proceed to 4.3 until verification passes.**

### What to verify

**1. Migrations applied.** In Supabase Dashboard → SQL Editor:

```sql
-- care_events should have author_id, NOT user_id
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='care_events'
ORDER BY ordinal_position;
-- Expect: id, plant_id, author_id, type, source, notes, created_at

-- get_my_gardens should exist
SELECT proname, prorettype::regtype
FROM pg_proc
WHERE proname = 'get_my_gardens';
-- Expect: 1 row
```

**2. RLS smoke tests.** Run these as different impersonated JWT contexts (Supabase Dashboard → SQL Editor supports impersonation via the user picker, or use service-role + manual `SET ROLE`).

```sql
-- As owner (sam.morassutti@gmail.com):
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, garden_role='owner'

SELECT id, nickname FROM public.plants WHERE user_id = auth.uid();
-- Expect: owner's plants

-- As caretaker2 (2cb00f43-aa7d-4884-9423-a8593d3f917b):
SELECT * FROM public.get_my_gardens();
-- Expect: 2 rows. One role='owner' (own garden, empty), one role='caretaker' (owner's garden)

SELECT id, nickname FROM public.plants WHERE user_id = '<owner-uuid>';
-- Expect: owner's plants visible — first time RLS lets a non-owner read plants

-- As a third user with no caretaking access:
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, role='owner', their own garden

SELECT id, nickname FROM public.plants WHERE user_id = '<owner-uuid>';
-- Expect: zero rows (RLS denies)
```

**3. App launch smoke tests** on iPhone 17 Pro simulator:

- Sign in as owner → home shows owner's plants. Console: no errors. `useGardenStore.gardens[]` has 1 entry.
- Sign out, sign in as caretaker2 → home shows caretaker2's own (empty) garden by default per D4. `useGardenStore.gardens[]` has 2 entries.
- The app does NOT yet have the picker UI (that's 4.4). To verify `loadPlants(ownerId)` works, manually patch `App.tsx` for one launch to call `loadPlants(<owner-uuid>)` instead of own. Confirm owner's plants render. **Revert the patch before continuing.**

### If verification fails

Most likely failure modes and remediations:

- **`get_my_gardens` returns 0 rows for the caretaker case:** check `garden_caretakers.accepted_at` is non-null and `expires_at IS NULL OR > now()`.
- **`SELECT plants WHERE user_id = '<owner>'` returns 0 rows for caretaker:** `has_garden_access(uuid)` is wrong, or RLS policy on `plants` doesn't call it. Check migration 003's plants policy.
- **42702 ambiguous column on `get_my_gardens`:** an output column name collides with a table column the function body touches. Rename the offending output to a `garden_*` name.
- **Caretaker can read plants but not care_events:** migration 005 RLS policies didn't apply or have wrong column names. Re-check `pg_policy`.

### Sign-off

Update `test-results/phase-4-test.md` with:
- ✅ Migration 005 applied
- ✅ `get_my_gardens()` deployed
- ✅ RLS smoke tests pass for all three account contexts
- ✅ App launches cleanly as owner and as caretaker2
- Notes on anything surprising

Only after all four ticks: continue to 4.3.

---

## 4.3 — `gardenService.ts` + Garden type

**File:** `src/services/gardenService.ts` (new), `src/types/garden.ts` (new — already drafted in 4.1)

**What:** Thin client wrapper around the `get_my_gardens()` RPC.

**Why:** Matches the `caretakerService.ts` pattern. Encapsulates row mapping (snake_case RPC return → camelCase TS) so call sites are clean.

**How:**

```typescript
// src/services/gardenService.ts
import { supabase } from './supabase';
import { Garden, GardenRole } from '../types/garden';

interface GetMyGardensRow {
  garden_id: string;
  garden_owner_id: string;
  garden_owner_display_name: string;
  garden_role: GardenRole;
  garden_expires_at: string | null;
}

function rowToGarden(row: GetMyGardensRow): Garden {
  return {
    gardenId: row.garden_id,
    gardenOwnerId: row.garden_owner_id,
    gardenOwnerDisplayName: row.garden_owner_display_name,
    gardenRole: row.garden_role,
    gardenExpiresAt: row.garden_expires_at,
  };
}

export async function listMyGardens(): Promise<Garden[]> {
  const { data, error } = await supabase.rpc('get_my_gardens');
  if (error) {
    console.warn('[gardenService] listMyGardens failed', error);
    throw error;
  }
  return (data ?? []).map(rowToGarden);
}
```

**Notes:**

- No `GardenError` class for now — `listMyGardens` either succeeds or throws the raw Supabase error. The store catches it. If we later need typed error handling, follow the `CaretakerError` pattern from `caretakerService.ts`.
- Uses `supabase.rpc()` — cleaner than `.from(...).select()` for function calls and gets correct type inference if Supabase typegen is run.

**Verify:** Type checks. Tested implicitly via `useGardenStore.loadGardens` in 4.1.

**Depends on:** 4.0 (RPC).

---

## 4.4 — Header dropdown + GardenPickerBottomSheet + banner

**Files:**
- `src/screens/HomeScreen.tsx` (existing, modify header)
- `src/screens/PlantDetailScreen.tsx` (existing, add banner)
- `src/components/GardenPickerBottomSheet.tsx` (new)
- `src/components/CaretakerBanner.tsx` (new)

**What:** Three coordinated UI surfaces — a tappable label in the Home header that shows the active garden's owner-display-name, a bottom sheet that opens on tap and lets the user switch gardens, and a persistent banner below the header on Home + PlantDetail when the user is in caretaker mode.

**Why:** D1 — the user must always know "whose garden am I looking at." A banner is loud enough that it cannot be missed; the header label is the primary affordance for switching.

**How:**

**Header label** (in `HomeScreen.tsx`, set via `useLayoutEffect` + `navigation.setOptions`):

```typescript
const activeGarden = useGardenStore(s =>
  s.gardens.find(g => g.gardenId === s.activeGardenId) ?? null
);

useLayoutEffect(() => {
  navigation.setOptions({
    headerTitle: () => (
      <TouchableOpacity onPress={() => setPickerVisible(true)}>
        <Text style={styles.headerTitle}>
          {activeGarden?.gardenRole === 'owner'
            ? 'My plants'
            : `${activeGarden?.gardenOwnerDisplayName || 'A Vira gardener'}'s garden`}
        </Text>
        <ChevronDown size={16} />
      </TouchableOpacity>
    ),
  });
}, [navigation, activeGarden]);
```

**`GardenPickerBottomSheet`** — React Native `Modal` with `animationType="slide"` (per Q5):

```typescript
// src/components/GardenPickerBottomSheet.tsx
interface Props {
  visible: boolean;
  onClose: () => void;
}

export function GardenPickerBottomSheet({ visible, onClose }: Props) {
  const gardens = useGardenStore(s => s.gardens);
  const activeId = useGardenStore(s => s.activeGardenId);
  const setActive = useGardenStore(s => s.setActiveGarden);
  const loadGardens = useGardenStore(s => s.loadGardens);
  const userId = useAuthStore(s => s.user?.id);

  // Refresh when the sheet opens (Q4 trigger)
  useEffect(() => {
    if (visible && userId) {
      loadGardens(userId);
    }
  }, [visible, userId, loadGardens]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose a garden</Text>
          {gardens.map(g => (
            <TouchableOpacity
              key={g.gardenId}
              style={[styles.row, g.gardenId === activeId && styles.rowActive]}
              onPress={() => {
                setActive(g.gardenId);
                onClose();
              }}
            >
              <Text style={styles.rowLabel}>
                {g.gardenRole === 'owner'
                  ? 'My plants'
                  : `${g.gardenOwnerDisplayName || 'A Vira gardener'}'s garden`}
              </Text>
              {g.gardenId === activeId && <Check size={16} />}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
```

**`CaretakerBanner`** — visible only when `activeGardenId !== ownGardenId`:

```typescript
// src/components/CaretakerBanner.tsx
export function CaretakerBanner({ onPress }: { onPress: () => void }) {
  const ownId = useGardenStore(s => s.ownGardenId);
  const activeGarden = useGardenStore(s =>
    s.gardens.find(g => g.gardenId === s.activeGardenId) ?? null
  );

  if (!activeGarden || activeGarden.gardenId === ownId) return null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.banner}>
      <Text style={styles.bannerText}>
        Caring for {activeGarden.gardenOwnerDisplayName || 'A Vira gardener'}'s garden
      </Text>
    </TouchableOpacity>
  );
}
```

**Wire into `HomeScreen` and `PlantDetailScreen`** — render `<CaretakerBanner onPress={() => setPickerVisible(true)} />` directly under the header. The banner self-hides via the early return when in own garden.

**PlantDetailScreen MUST pop on garden switch.** If a caretaker is viewing PlantDetail for one of the owner's plants and then switches gardens, the displayed plant data becomes stale (the new garden doesn't contain that plant). PlantDetailScreen must detect the activeGardenId change and pop itself:

```typescript
// In PlantDetailScreen (top of component, before any render)
const activeId = useGardenStore(s => s.activeGardenId);
const initialActiveId = useRef(activeId);

useEffect(() => {
  if (activeId !== initialActiveId.current) {
    navigation.goBack();
  }
}, [activeId, navigation]);
```

This compares `activeId` against the value at mount time. If they diverge, the user switched gardens while on this screen → pop back to Home, where the plant list will reflect the new active garden.

**Hooking `loadPlants` to `activeGardenId` changes — DO THIS IN App.tsx, NOT HomeScreen:**

```typescript
// In App.tsx, alongside the auth-change effect.
// Subscribes to activeGardenId changes ONLY, regardless of which screen is showing.
useEffect(() => {
  const unsub = useGardenStore.subscribe(
    (state) => state.activeGardenId,
    (activeId) => {
      if (activeId) {
        usePlantStore.getState().loadPlants(activeId);
      }
    }
  );
  return unsub;
}, []);
```

**Why App.tsx and not HomeScreen?** If we put the effect on HomeScreen, it fires whenever HomeScreen mounts — duplicating the auth-change handler's initial load and creating a race where two `loadPlants` calls overlap. Centralizing in App.tsx means: one source of truth ("when activeGardenId changes, reload plants"), regardless of which screen the user is on.

`subscribe` is the imperative Zustand subscription API; using it from a side-effect avoids the subscriber-component pattern that would couple plant-loading to a particular screen rendering.

**Notes:**

- The banner copy is fixed ("Caring for X's garden"). No conditional grammar — D1 locked it.
- `setActiveGarden` is called inside the row press handler before `onClose`. The modal slide-out happens after the state update so the picker briefly shows the new active state highlighted.
- No `loadPlants` call inside the picker row press handler — the App.tsx subscription handles it. One write path.
- PlantDetailScreen popping on garden switch is by design. Switching gardens is an explicit "I want to look at a different garden" action; staying on a now-stale plant detail view would be confusing.

**Verify:** Visual tap-through (see pause point 2).

**Depends on:** 4.1 (store), 4.2 (loadPlants param), 4.3 (gardenService).

---

## ⏸ PAUSE POINT 2 — after 4.4

**Stop the Claude Code session here. Do not proceed to 4.5 until verification passes.**

### What to verify

Visual tap-through on iPhone 17 Pro simulator with two test accounts.

**As owner (sam.morassutti@gmail.com):**
- Header reads "My plants" with chevron.
- Tap header → bottom sheet slides up, lists 1 garden ("My plants" with check), backdrop tap closes.
- No caretaker banner visible.

**Sign out, sign in as caretaker2 (sam.morassutti+caretaker2@gmail.com):**
- Header reads "My plants" by default per D4.
- Tap header → bottom sheet shows 2 gardens: "My plants" (active, checked) and "{ownerName}'s garden".
- Tap "{ownerName}'s garden" → sheet closes, header updates to "{ownerName}'s garden", banner appears below header reading "Caring for {ownerName}'s garden", plant list updates to show owner's plants.
- Pull-to-refresh on Home — plant list reloads against the active garden.
- Tap banner → bottom sheet opens again.
- Switch back to "My plants" → banner disappears, plant list updates to caretaker2's own (empty) garden.

**Background the app, foreground it (NOT a force-quit):**
- Active garden persists. Banner stays. (This is in-memory Zustand — should just work.)

**PlantDetailScreen navigation behavior on garden switch (C4 regression test):**
- As caretaker2 viewing owner's garden, tap a plant → PlantDetailScreen opens.
- Tap the banner → picker opens. Switch to "My plants."
- **The PlantDetailScreen pops automatically** and you land back on Home showing caretaker2's own plant list. If the detail view stays open, the pop-on-switch logic is missing — re-check 4.4's `useEffect` on `[activeId]` that calls `navigation.goBack()` from PlantDetailScreen.

**Force-quit the app, relaunch as caretaker2:**
- AsyncStorage rehydrates `vira:activeGardenId`. If it was on owner's garden, the app launches into owner's garden with the banner. If on own, default state.

**Critical regression test for the rehydration fix:** While in owner's garden as caretaker2, force-quit. Wait 5 seconds. Relaunch. **The app must reopen with owner's garden active and the banner visible.** If it falls back to "My plants," the rehydration race is back — `useGardenStore.persist.onFinishHydration` is not being awaited correctly in `App.tsx`. See §4.1 "Rehydration race — REQUIRED handling."

**Edge case — revoke caretaker2's access from the owner's `ManageCaretakersScreen`, then have caretaker2 pull-to-refresh or open the picker:**
- `loadGardens` returns only caretaker2's own garden.
- Store silently falls back to `ownGardenId`.
- Banner disappears. No alert, no toast.

### If verification fails

- **Header doesn't update on garden switch:** the `useGardenStore` selector isn't subscribing to `activeGardenId` correctly. Check that the selector returns a primitive or a stable reference.
- **Plant list doesn't swap:** the `useEffect` on `[activeId]` is missing or `loadPlants` isn't accepting `gardenId`. Re-check 4.2.
- **Banner shows in own garden:** the early-return condition is wrong. Should be `if (activeGarden.gardenId === ownId) return null`.
- **Bottom sheet has no animation:** `animationType="slide"` not set, or `transparent` is false (which would render a solid backdrop and skip the sheet animation).

### Sign-off

Update `test-results/phase-4-test.md` with the tap-through results and any visual issues. Take a screenshot of caretaker2 viewing the owner's garden with the banner — useful for the Phase 6 TestFlight release notes.

Only after a clean tap-through: continue to 4.5.

---

## 4.5 — Care event attribution avatars

**File:** `src/screens/PlantDetailScreen.tsx` (existing), `src/components/CareEventAvatar.tsx` (new), possibly `src/utils/getInitials.ts` (extract from Settings)

**What:** When rendering the care history list on `PlantDetailScreen`, each care event whose `authorId !== currentUserId` gets a 20×20 initials circle (Luxor bg, Butter Moon text) next to the timestamp. Events authored by the viewing user are unmarked.

**Why:** D2 — when a caretaker logs care, the owner needs to know it was them, not a self-action they forgot. When the owner logs care, the caretaker viewing the same plant later can see it was the owner. Attribution is bidirectional but only shown for the *other* person, to keep the common case (owner viewing their own actions) clean.

**How:**

```typescript
// src/utils/getInitials.ts (extract from SettingsScreen if it lives there)
export function getInitials(displayName: string | null | undefined): string {
  if (!displayName) return '?';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// src/components/CareEventAvatar.tsx
interface Props {
  displayName: string | null;
}

export function CareEventAvatar({ displayName }: Props) {
  return (
    <View style={styles.circle}>
      <Text style={styles.initials}>{getInitials(displayName)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: viraTheme.colors.luxor,
    alignItems: 'center', justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    color: viraTheme.colors.butterMoon,
  },
});
```

**In `PlantDetailScreen`:**

```typescript
const currentUserId = useAuthStore(s => s.user?.id);

// Per care event in the history list:
{event.authorId !== currentUserId && (
  <CareEventAvatar displayName={authorDisplayNameFor(event.authorId)} />
)}
```

**Author display name lookup.** Migration 005 adds an explicit FK `care_events.author_id → profiles.id`, which is what makes the PostgREST embedded resource syntax work. Update `loadPlants` (in 4.2) to embed the author display name:

```typescript
// In usePlantStore.loadPlants
const { data, error } = await supabase
  .from('plants')
  .select('*, care_events(*, author:profiles(display_name))')
  .eq('user_id', gardenId)
  .order('created_at', { ascending: false });
```

PostgREST follows the FK on `care_events.author_id` → `profiles.id` and embeds the related `display_name`. The result shape (per care event row):

```json
{
  "id": "...",
  "plant_id": "...",
  "author_id": "...",
  "type": "water",
  "created_at": "...",
  "author": { "display_name": "Sam" }
}
```

Update the `rowToCareEvent` mapper to flatten `author.display_name` into `authorDisplayName`:

```typescript
function rowToCareEvent(row: any): CareEvent {
  return {
    id: row.id,
    plantId: row.plant_id,
    authorId: row.author_id,
    type: row.type,
    createdAt: row.created_at,
    notes: row.notes,
    authorDisplayName: row.author?.display_name ?? null,
  };
}
```

`CareEvent` type in `src/types/plant.ts` gains `authorDisplayName: string | null` (rename `userId` → `authorId` here too as part of migration 005's repo-wide rename).

**RLS on `profiles`:** the embedded select requires the caller to be allowed to SELECT from `profiles`. Migration 001 should have permissive read on `profiles.display_name` (it's how `listPendingInvitesForMe` resolves owner names in Phase 3). Verify in pre-flight if not certain.

**If the embedded select returns no `author` field:** PostgREST didn't recognize the FK. Most likely cause: pre-flight step 3 was skipped and the FK still references `auth.users(id)` instead of `profiles(id)`. Fix: re-apply migration 005 step 5 (the FK redirect).

**Notes:**

- When `authorId === currentUserId`, render no avatar (D2). The empty space is intentional — it's the visual signal that "this is me."
- Falls back gracefully when `authorDisplayName` is null: the avatar shows "?". Doesn't crash. This shouldn't happen in practice but defense-in-depth.
- The history list rendering loop already exists in `PlantDetailScreen`. This change is small: ~10 lines plus the new component.

**Verify:** Pause point 3 covers this together with write-gating.

**Depends on:** Migration 005 applied (so `author_id` exists), 4.2 (loadPlants returns the embedded author display_name).

---

## 4.6 — Write-gating

**Files:**
- `src/screens/HomeScreen.tsx` (existing — gate FAB)
- `src/screens/PlantDetailScreen.tsx` (existing — gate Edit + Remove)
- `src/screens/AddPlantScreen.tsx` (existing — guard on mount)
- `src/utils/showErrorToast.ts` (new or existing — generic toast for 42501)

**What:** Three layers of gating against caretaker writes.

**Layer 1 — UI hide.** The FAB on HomeScreen is hidden when `activeGardenId !== ownGardenId`. The header-right "Edit" button on PlantDetailScreen and the "Remove plant" button in edit mode are hidden under the same condition. AddPlantScreen, on mount, pops the navigation stack if the user has somehow reached it while not in their own garden.

**Layer 2 — RLS backstop.** The `plants` table already has owner-only INSERT/UPDATE/DELETE policies from migration 001. If a caretaker hits one of these endpoints despite the UI hiding, Postgres returns 42501.

**Layer 3 — Generic error toast.** The 42501 error fires `showErrorToast('Something went wrong. Please try again.')`. No per-action copy. The toast is strictly a bug-detection signal.

**Why:** D6 — UI gating is the user-experience layer; RLS is the security layer. Defense in depth. Generic toast because per-action copy implies the failure is part of the UX, but it's actually a bug — a caretaker should never have hit a forbidden endpoint.

**How:**

**HomeScreen FAB gate:**

```typescript
const isOwnGarden = useGardenStore(s =>
  s.activeGardenId !== null && s.activeGardenId === s.ownGardenId
);

// in render
{isOwnGarden && <FAB onPress={() => navigation.navigate('AddPlant')} />}
```

**PlantDetailScreen header Edit + Remove:**

```typescript
const isOwnGarden = useGardenStore(s =>
  s.activeGardenId !== null && s.activeGardenId === s.ownGardenId
);

useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () =>
      isOwnGarden ? (
        <Button title="Edit" onPress={() => setEditing(true)} />
      ) : null,
  });
}, [navigation, isOwnGarden]);

// In edit mode JSX:
{isOwnGarden && (
  <TouchableOpacity onPress={confirmRemove} style={styles.removeButton}>
    <Text>Remove plant</Text>
  </TouchableOpacity>
)}
```

**Notes editor read-only for caretakers** — caretakers can SEE owner notes but not edit them. This includes hiding any explicit "Save" button or auto-save mechanism on the notes field:

```typescript
<TextInput
  value={notes}
  onChangeText={setNotes}
  editable={isOwnGarden}
  // ...
/>

{/* If notes have a separate Save button: */}
{isOwnGarden && (
  <TouchableOpacity onPress={saveNotes}>
    <Text>Save notes</Text>
  </TouchableOpacity>
)}
```

If notes use auto-save on blur, gate the auto-save call by `isOwnGarden` too. The TextInput `editable={false}` prevents the user from triggering changes via the keyboard, but defense-in-depth: any code path that writes to `plants.notes` should check `isOwnGarden` before firing.

**Mark Watered / Mark Fertilized stay enabled** — they go through `logCareEvent`, which inserts into `care_events` with `author_id = auth.uid()`. Caretakers CAN do this (per migration 005's INSERT policy).

**AddPlantScreen on-mount guard (belt-and-suspenders).** Use a render-time guard to avoid a one-frame flash before navigation pops:

```typescript
export function AddPlantScreen({ navigation }: Props) {
  const ownId = useGardenStore(s => s.ownGardenId);
  const activeId = useGardenStore(s => s.activeGardenId);
  const isOwnGarden = activeId !== null && activeId === ownId;

  // Render-time guard — no flash of the screen content before pop
  useLayoutEffect(() => {
    if (!isOwnGarden) {
      navigation.goBack();
    }
  }, [isOwnGarden, navigation]);

  if (!isOwnGarden) return null;

  // ... existing screen content
}
```

`useLayoutEffect` fires synchronously after render but before paint, so the user never sees the screen's content. The `if (!isOwnGarden) return null` at the top is the visible guard — even if `useLayoutEffect` is slow on a particular device, the screen renders empty until navigation pops.

**Generic 42501 toast.** Wherever the existing error-handling code in `usePlantStore` catches a Supabase error, check for `error.code === '42501'`:

```typescript
// in addPlant/updatePlant/removePlant catch blocks:
if (error?.code === '42501') {
  showErrorToast('Something went wrong. Please try again.');
} else {
  // existing logging
}
```

If `showErrorToast` doesn't exist yet, add a thin one. Use the existing modal/toast pattern if there is one; otherwise the simplest version is a small View + Animated fade-in/out, or `react-native`'s `ToastAndroid` is iOS-incompatible so we need our own.

**Verify:** Pause point 3.

**Depends on:** 4.1 (store with `ownGardenId` + `activeGardenId`).

---

## ⏸ PAUSE POINT 3 — after 4.6

**Stop. This is the final verification before merging Phase 4 to main.**

### What to verify

End-to-end caretaker tap-through on iPhone 17 Pro simulator.

**Setup:** Sign in as owner, log a care event on a plant (e.g., "Mark watered" on Monty). Sign out.

**Sign in as caretaker2:**
1. Header reads "My plants" — own garden by default.
2. Switch to owner's garden via picker. Banner appears.
3. **HomeScreen:** No FAB visible. Cannot reach AddPlantScreen.
4. Tap any plant → PlantDetailScreen.
5. **No "Edit" button in header.** No "Remove plant" button anywhere.
6. **"Mark watered" button is enabled.** Tap it.
7. Confirmation animation fires. Care event is logged. The new entry appears in the care history.
8. Notes field is read-only — long-press to focus produces no keyboard.
9. Pull plant detail down to dismiss back to Home.
10. The owner's plant list shows the updated "last watered" timestamp.

**Sign back in as owner:**
1. Open Monty's PlantDetailScreen.
2. Care history shows two events: the one owner logged earlier (no avatar — owner viewing own action), and the one caretaker2 logged (Luxor avatar circle with caretaker2's initials).
3. The Luxor circle is 20×20pt, butterMoon text, readable.

**Negative tests** (these SHOULD trigger the generic toast):

For these tests we need to bypass the UI gate to verify the RLS backstop. The cleanest way is a temporary dev-only debug button on PlantDetailScreen that fires a forbidden write directly. Add behind a `__DEV__` check during the session, remove before merging:

```typescript
{__DEV__ && (
  <TouchableOpacity onPress={async () => {
    try {
      await usePlantStore.getState().removePlant(plant.id);
    } catch (e) {
      console.log('debug remove threw:', e);
    }
  }}>
    <Text>[DEBUG] Force remove</Text>
  </TouchableOpacity>
)}
```

Then:
1. Switch to owner's garden as caretaker2. Tap a plant. Tap [DEBUG] Force remove. Should produce 42501 in Supabase logs and the generic toast. The plant is NOT removed.
2. Without that button, tapping anything reachable in the UI should NOT produce a 42501. If it does, the UI gate has a hole.

Remove the `__DEV__` button before merging. (Add to the post-flight checklist.)

### If verification fails

- **FAB still visible as caretaker:** the `isOwnGarden` selector is wrong, or comparing `null === null` and treating as own. Check with `activeGardenId !== null && activeGardenId === ownGardenId`.
- **Avatar shows for own actions:** the `event.authorId !== currentUserId` check is wrong, or `currentUserId` is undefined.
- **Mark watered fails for caretaker with 42501:** migration 005 INSERT policy is wrong. Re-check that the policy uses `has_garden_access(p.user_id)` not `p.user_id = auth.uid()`.
- **Owner sees no avatar on caretaker's action:** `authorId` is missing from the joined query. Re-check 4.5's PostgREST embedded select.

### Sign-off

`test-results/phase-4-test.md` final section:
- ✅ Caretaker UI gating: FAB hidden, Edit hidden, Remove hidden, AddPlant unreachable, notes read-only.
- ✅ Caretaker can mark watered + fertilized.
- ✅ Care event attribution: Luxor avatar shows for non-self actions, hidden for self.
- ✅ Generic toast fires on synthetic 42501; does NOT fire on normal caretaker actions.
- ✅ Owner-side: care history shows attributed events.

**Ready to merge.** Branch → PR → main.

---

## Notification rescheduling — special case

**File:** `src/services/notificationService.ts`

`scheduleWateringNotification(plant)` is called after every `markWatered`. Currently it schedules a local notification on the device for the plant's next watering. Phase 4 needs a gate.

**Rule:** notifications schedule ONLY for plants in the user's OWN garden. If a caretaker marks the owner's plant watered, no notification is scheduled on the caretaker's phone — they don't live with the plant.

**Implementation:** pass `currentUserId` as an explicit parameter, captured at the call site. This follows the same lesson as Phase 3's "don't read Zustand state after async" pattern — by the time `scheduleWateringNotification` runs, `useAuthStore.getState().user` could in principle be stale.

```typescript
// notificationService.ts — updated signature
export async function scheduleWateringNotification(
  plant: Plant,
  currentUserId: string,
): Promise<void> {
  if (plant.userId !== currentUserId) {
    // Not our plant. Skip notification.
    return;
  }
  // ... existing scheduling logic
}

// usePlantStore markWatered — capture user ID before any await
markWatered: async (plantId) => {
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId) return;

  // ... existing optimistic update + Supabase insert ...

  await scheduleWateringNotification(updatedPlant, currentUserId);
},
```

`cancelWateringNotification(plantId)` doesn't need a similar gate — it's idempotent and cheap, and the caretaker's phone won't have a notification with that ID anyway.

**Verify:** Mark a plant watered as caretaker2. Background the app. Wait. No notification fires. Mark a plant watered as owner. Notification fires at 9 AM the next day per existing behavior.

---

## Risk areas

These are the seams where Phase 4 is most likely to leak. Each maps to a specific verification in the pause points.

### RLS is not just a config — it's the entire feature

Phase 4 is the first time `has_garden_access(uuid)` is exercised by non-owner reads. The Phase 0 tests verified the helper compiled and ran for the owner case (which is trivially true). The pause-1 RLS smoke tests above are the first real exercise. If they fail, nothing downstream works.

If `SELECT * FROM plants WHERE user_id = '<owner>'` returns zero rows for caretaker2, the chain to debug is:
1. Is `garden_caretakers` row correct? (`accepted_at` non-null, `expires_at` null or future, `caretaker_id` = caretaker2's UUID)
2. Does `has_garden_access('<owner-uuid>')` return true when called as caretaker2?
3. Does the `plants` table's SELECT policy actually call `has_garden_access`?

Migration 003 set up step 3, but step 3 has never been verified end-to-end. Pause 1 is where it gets verified.

### Zustand persist + rehydrate race

Zustand `persist` middleware rehydrates asynchronously. On a cold app launch, the order is:
1. JS bundle loads.
2. Zustand stores initialize with default state (`activeGardenId: null`).
3. AsyncStorage read fires.
4. Rehydration completes, `activeGardenId` is set to the persisted value.

Steps 2 and 3 are async and can race. If `App.tsx` reads `activeGardenId` between 2 and 4, it sees `null`.

**Mitigation in this plan:** the auth-change effect in `App.tsx` explicitly waits for hydration via `useGardenStore.persist.onFinishHydration()` before calling `loadGardens`. See §4.1 "Rehydration race — REQUIRED handling" for the full code. Without this, the persisted `activeGardenId` is silently overwritten on every cold launch.

**Edge case:** if the user opens the app, force-quits during the AsyncStorage read, and reopens, the state is whatever was last fully written. Zustand's `persist` is last-write-wins; this is not a Phase 4 concern.

### Optimistic updates + cross-garden state

`markWatered` writes optimistically to `usePlantStore` then fires Supabase. If the caretaker marks a plant watered and immediately switches gardens, the optimistic write lives in the store under the old garden's plant list. When they switch back, `loadPlants(activeGardenId)` overwrites the store with fresh data — usually fine, but a race could drop the optimistic write before Supabase confirms it.

**Decision:** accept the race as a known cosmetic limitation. The Supabase write still goes through; the next `loadPlants` will pick it up. No partition by gardenId — that would be a much larger refactor for an edge case the user is unlikely to hit (who switches gardens immediately after marking watered?).

If this turns out to bite, the fix is: partition `usePlantStore.plants` by gardenId, so `plants[gardenId][plantId]` instead of `plants[plantId]`. Defer.

### Notification rescheduling

Already addressed above in §"Notification rescheduling — special case." The risk is forgetting the gate; the mitigation is the explicit `currentUserId` parameter on `scheduleWateringNotification`, captured at the call site, plus the verify step in pause 3.

### Care event author display name + PostgREST FK detection

The embedded select `care_events(*, author:profiles(display_name))` requires PostgREST to detect a foreign-key relationship from `care_events.author_id` to `profiles.id`. Migration 005 explicitly adds this FK (step 5 of the migration). Without it, PostgREST returns `care_events` rows without the embedded `author` field, and the avatar renders as "?" for everyone.

**Verify during 4.5:** the first `loadPlants` call after migration 005 should produce care_events with `row.author = { display_name: "..." }`. Console.log a row to confirm. If `author` is undefined, the FK didn't get added (pre-flight step 3 skipped) — re-apply step 5 of migration 005.

### Account-switch loses persisted activeGardenId

The persisted `vira:activeGardenId` is per-device, not per-account. If user A signs out, user B signs in, B navigates to a garden, B signs out, A signs in — A's previously-active garden preference has been overwritten by B's. Acceptable limitation. Document in CLAUDE.md so it's not a future bug report.

---

## Pre-flight checklist (before starting Claude Code session)

- [ ] On `main`, fully synced with remote (`git pull origin main`).
- [ ] `CLAUDE.md` is up to date with Phase 3 post-ship bugfix round (already verified — was committed in `3cc7566`).
- [ ] `test-results/phase-3-test.md` reflects the simulator tap-through pass.
- [ ] Optional housekeeping done or explicitly skipped: self-invite row cleanup, migration 004 idempotency fix.
- [ ] **Run the "Critical pre-flight verification" SQL above** to confirm `plants` SELECT policy allows caretaker reads via `has_garden_access`. If it doesn't, add migration 005a as documented. **Skipping this step is the most likely way Phase 4 fails at pause 1.**
- [ ] **Run pre-flight steps 1–4 from §Migration 005** to capture actual policy/index/FK names so the migration applies cleanly.
- [ ] `npm install` is current (`npm ls` shows no missing).
- [ ] iPhone 17 Pro simulator boots cleanly. Metro on port 8081 is free (`lsof -ti:8081`).
- [ ] Supabase Dashboard SQL Editor open in a tab — migrations 005 (+ optional 005a) + 006 will be applied through it during the session.
- [ ] Two test accounts ready: owner (sam.morassutti@gmail.com) and caretaker2 (sam.morassutti+caretaker2@gmail.com).
- [ ] Verify caretaker2 still has accepted access to owner's garden (`SELECT * FROM garden_caretakers WHERE caretaker_id = '2cb00f43-aa7d-4884-9423-a8593d3f917b';`). If not, re-run a Phase 3 invite + accept flow before starting.

---

## Post-flight cleanup

After Phase 4 ships:

- [ ] **Remove the `[DEBUG] Force remove` button** from PlantDetailScreen if it was added during pause point 3 testing.
- [ ] Update `CLAUDE.md` with Phase 4 entry in the Done section, mirroring the Phase 2/3 entries' structure.
- [ ] Update `CLAUDE.md` Caretaker Mode Integration Pattern with `useGardenStore`, `gardenService.ts`, `get_my_gardens()` RPC, the write-gating pattern, and the notification scheduling gate.
- [ ] Document the rehydration-handling pattern in CLAUDE.md Deployment Learnings (`useGardenStore.persist.onFinishHydration` is reusable for any future persisted store).
- [ ] Document the `account-switch persist limitation` in CLAUDE.md so it's not a future bug report.
- [ ] Generate `Vira_Session_Handoff_2026-MM-DD.docx` for the session.
- [ ] Move "Caretaker Mode Phase 4" off the "Next up" list in `CLAUDE.md`.
- [ ] Add Phase 4 lessons to Deployment Learnings (anything new discovered during execution).
- [ ] Move on to Phase 5 planning (caretaker notes).

---

## Phase 5 — Caretaker notes (sketch)

Caretakers add timestamped notes to plants. Owners and other caretakers see them in the care history. Authorship attribution mirrors Phase 4's care event avatars.

Schema is already in place (`caretaker_notes` table, migration 003). Phase 5 work:
- `caretakerNotesService.ts` — `listNotes(plantId)`, `addNote(plantId, body)`, `deleteNote(noteId)`. RLS author-only delete.
- `PlantDetailScreen` — new "Notes" section under care history. Shows note body, author avatar, relative timestamp. Owner + caretakers can add. Each author can delete their own.
- No Edge Function — direct PostgREST.

Defer detailed planning until Phase 4 ships.

---

## Phase 6 — TestFlight build 6 + e2e cross-account test (sketch)

Bump CFBundleVersion to 6, clean archive to `/tmp/ViraPlantsTemp6.xcarchive`, upload via xcodebuild CLI. Internal testing with two real Apple IDs to confirm the full owner ↔ caretaker loop works on physical devices.

Defer detailed planning until Phase 5 ships.

---

*End of v3.0 plan. Authored Apr 24, 2026 from the Phase 4 planning handoff + Q1–Q5 resolutions.*
