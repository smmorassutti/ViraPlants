# Phase 4 — Garden Switching, RLS, Write-Gating — Test Record

Branch: `phase-4-caretaker-mode`
Author: Claude Code (Phase 4 v3.0 session)
Started: 2026-05-06

---

## Block 1 — Schema, store, plant loading (Tasks 4.0–4.2)

### Pre-flight verification (BEFORE any migration)

**Plants SELECT policy still references has_garden_access:** ✅ confirmed by Sam in the Phase 4 session prompt before code work began. Output captured below for the record:

```
plants policies (SELECT only):
  garden_members_can_view_plants — using_clause: has_garden_access(user_id)
```

**Profiles SELECT permissive enough for caretaker reads of display_name:** ✅ `own_or_garden_member_profile_readable` allows bidirectional garden-member reads of `profiles.display_name`. PostgREST embed `author:profiles(display_name)` in 4.5 will work.

### Migration 005 — pre-flight probes

Captured live from project `yxidmviucaaztdnkxxvw` on 2026-05-06 before applying:

| object | name | notes |
|--------|------|-------|
| RLS policy | `Users can delete own care events` | DELETE — `auth.uid() = user_id` |
| RLS policy | `Users can update own care events` | UPDATE — `auth.uid() = user_id` |
| RLS policy | `garden_members_can_create_care_events` | INSERT — already gated by `has_garden_access` |
| RLS policy | `garden_members_can_view_care_events` | SELECT — already gated by `has_garden_access` |
| FK | `care_events_user_id_fkey` | references `public.profiles(id) ON DELETE CASCADE` (NOT `auth.users` — the plan's worst-case path is not in play) |
| Indexes | only `care_events_pkey` | no `user_id` indexes to drop |

Migration 005 SQL was authored against these exact names — `005_care_event_author.sql` checked into `supabase/migrations/`.

### Migration 005 — applied

- [ ] **Sam to apply** via Supabase Dashboard SQL Editor by pasting the contents of `supabase/migrations/005_care_event_author.sql` step-by-step.
- [ ] After apply, run the verification probe:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='care_events'
  ORDER BY ordinal_position;
  -- Expect: id, plant_id, author_id, type, source, notes, created_at
  ```

### Migration 006 — applied

- [ ] **Sam to apply** via Supabase Dashboard SQL Editor by pasting the contents of `supabase/migrations/006_get_my_gardens.sql`.
- [ ] After apply, run the verification probe:
  ```sql
  SELECT proname, prorettype::regtype
  FROM pg_proc
  WHERE proname = 'get_my_gardens';
  -- Expect: 1 row, prorettype = 'record'
  ```

### Pause Point 1 — RLS smoke tests

To be run by Sam after migrations apply. SQL probes (impersonate via Dashboard user picker):

```sql
-- As owner (sam.morassutti@gmail.com):
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, garden_role='owner'

SELECT id, nickname FROM public.plants WHERE user_id = auth.uid();
-- Expect: owner's plants (existing data)

-- As caretaker2 (2cb00f43-aa7d-4884-9423-a8593d3f917b):
SELECT * FROM public.get_my_gardens();
-- Expect: 2 rows. role='owner' (own garden, empty), role='caretaker' (owner's garden)

SELECT id, nickname FROM public.plants WHERE user_id = '<owner-uuid>';
-- Expect: owner's plants (FIRST live exercise of has_garden_access for non-owner read)

-- As an unrelated third user:
SELECT * FROM public.get_my_gardens();
-- Expect: 1 row, role='owner', their own garden

SELECT id, nickname FROM public.plants WHERE user_id = '<owner-uuid>';
-- Expect: zero rows (RLS denies)
```

- [ ] Owner case ✅ / ❌
- [ ] Caretaker2 case ✅ / ❌
- [ ] Unrelated user case ✅ / ❌

### Pause Point 1 — App launch smoke tests

iPhone 17 Pro simulator, after migrations apply.

- [ ] Sign in as owner → home shows owner's plants. Console: no errors. `useGardenStore.gardens[]` has 1 entry.
- [ ] Sign out, sign in as caretaker2 → home shows caretaker2's own (empty) garden by default per D4. `useGardenStore.gardens[]` has 2 entries.
- [ ] Optional: temporarily patch App.tsx to call `loadPlants(<owner-uuid>)` for one launch. Confirm owner's plants render. Revert before continuing.

### Code changes landed in Block 1

- `src/types/garden.ts` — `Garden` interface, `GardenRole` type.
- `src/services/gardenService.ts` — `listMyGardens()` wraps `get_my_gardens` RPC; `rowToGarden` mapper. No `GardenError` class for now (per plan).
- `src/store/useGardenStore.ts` — Zustand store with `persist` middleware, `partialize` to persist only `activeGardenId` under key `vira:activeGardenId`. `loadGardens` falls back to `ownGardenId` when persisted ID is no longer in the gardens list.
- `src/store/usePlantStore.ts` — `loadPlants` signature changed to `loadPlants(gardenId: string)`; full state replacement on load (no temp-plant merge across garden switches per plan §"Risk areas"). Optimistic care-event tempEvent now sets `authorId`.
- `src/services/plantService.ts` — `CareEventRow.user_id → author_id`, `rowToCareEvent` flattens `row.author?.display_name → authorDisplayName`, `addCareEvent` insert uses `author_id`. `fetchPlants` parameter renamed from `userId` → `gardenId` for clarity.
- `src/types/plant.ts` — `CareEvent.userId → authorId`, added `authorDisplayName: string | null`.
- `App.tsx` — auth-state-change handler no longer calls `loadPlants` directly. New `useEffect` keyed on `userId` awaits `useGardenStore.persist.onFinishHydration()` before `loadGardens` + `loadPlants(activeId)`. Sign-out clears both `usePlantStore.plants` and `useGardenStore`. (The `activeGardenId` subscription is Block 2.)
- `src/screens/SettingsScreen.tsx` — `handleAcceptInvite` now triggers `useGardenStore.loadGardens(currentUserId)` after successful accept (replaces the Phase 3 TODO).

### Verifications run after code changes

- ✅ `npx tsc --noEmit` — zero errors.
- ✅ Hardcoded-hex scan on new files — zero matches.
- ✅ `any`/`@ts-ignore`/`@ts-expect-error` scan on new + modified files — zero matches.

---

## Block 2 — Picker, banner, header (Tasks 4.3–4.4)

_Pending Block 1 sign-off._

---

## Block 3 — Write-gating, attribution, notification gate (Tasks 4.5–4.6)

_Pending Block 2 sign-off._
