# Phase 4 — Garden Switching, RLS, Write-Gating — Test Record

Branch: `phase-4-caretaker-mode`
Author: Claude Code (Phase 4 v3.0 session)
Started: 2026-05-06
Pause-1 sign-off: ✅ Sam (May 6, 2026) — RLS smoke tests + simulator launches passed for owner and caretaker2.
Pause-2 sign-off: ✅ Sam (May 6, 2026) — picker, banner, plant-detail pop-on-switch, force-quit-relaunch rehydration, revocation fallback all confirmed.
Pause-3 sign-off: ✅ Sam (May 6, 2026) — write-gating, attribution avatars, generic 42501 toast, notification gate all confirmed. Ready to merge.

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

### Code changes landed in Block 2

- `App.tsx` — added the activeGardenId subscription. Single source of truth: when `state.activeGardenId !== prevState.activeGardenId && state.activeGardenId`, fire `usePlantStore.loadPlants(activeGardenId)`. Plain `subscribe` with `(state, prevState)` diff — no `subscribeWithSelector` middleware needed.
- `src/components/CaretakerBanner.tsx` — Hemlock background, Butter Moon Montserrat SemiBold copy. Returns null when `activeGardenId === ownGardenId` (own garden). Tappable; calls the `onPress` prop to open the picker. Min-height 44pt.
- `src/components/GardenPickerBottomSheet.tsx` — RN `Modal` with `animationType="slide"` and `transparent`. Backdrop press closes (Pressable with the same `onClose`). Lists gardens; active row gets a Luxor check icon + bolded label. Refreshes `loadGardens(userId)` whenever `visible` becomes true (Q4 trigger). Min row height 56pt; Cancel button min 44pt. No new dependency.
- `src/screens/HomeScreen.tsx` — header title is now a `TouchableOpacity` set via `useLayoutEffect` showing the active garden's display name plus chevron (▾). Reads from `useGardenStore` selectors. Banner renders directly under the header (above the FlatList). Pull-to-refresh added via `RefreshControl` calling `loadPlants(activeGardenId)`. Picker modal mounted at screen root. **FAB write-gating is Block 3.**
- `src/screens/PlantDetailScreen.tsx` — banner renders at the top of the ScrollView (above the hero photo) so the caretaker context is unmissable. New `useEffect` watches `activeGardenId` against an `initialActiveGardenId.current` ref and calls `navigation.goBack()` on divergence (the C4 regression test). Picker modal mounted at screen root. Edit/Remove gating is Block 3.

### Verifications run after code changes

- ✅ `npx tsc --noEmit` — zero errors.
- ✅ Hardcoded-hex scan on new + modified files — zero matches.
- ✅ `any`/`@ts-ignore` scan on new + modified files — zero matches.
- ✅ Unselectored Zustand store destructure scan (`useGardenStore()`, `useAuthStore()`, `usePlantStore()` standalone) — zero matches.

### Pause Point 2 — verification checklist (for Sam)

**Owner (sam.morassutti@gmail.com):**
- [ ] Header reads "My plants" with chevron.
- [ ] Tap header → bottom sheet slides up, lists 1 garden ("My plants" with check), backdrop tap closes, Cancel closes.
- [ ] No caretaker banner visible.

**Sign out, sign in as caretaker2 (sam.morassutti+caretaker2@gmail.com):**
- [ ] Header reads "My plants" by default per D4.
- [ ] Tap header → bottom sheet shows 2 gardens: "My plants" (active, checked) and "{ownerName}'s garden".
- [ ] Tap "{ownerName}'s garden" → sheet closes, header updates, banner appears below header reading "Caring for {ownerName}'s garden", plant list updates to show owner's plants.
- [ ] Pull-to-refresh on Home — plant list reloads against the active garden.
- [ ] Tap banner → bottom sheet opens.
- [ ] Switch back to "My plants" → banner disappears, plant list updates to caretaker2's own (empty) garden.

**Background/foreground (NOT a force-quit):**
- [ ] Active garden persists. Banner stays.

**PlantDetailScreen pop-on-switch (C4 regression test):**
- [ ] As caretaker2 viewing owner's garden, tap a plant → PlantDetailScreen opens.
- [ ] Tap the banner → picker opens. Switch to "My plants."
- [ ] PlantDetailScreen pops automatically; user lands on Home with caretaker2's own list.

**Force-quit + relaunch as caretaker2 (rehydration regression test):**
- [ ] While in owner's garden, force-quit. Wait 5 seconds. Relaunch.
- [ ] **App reopens with owner's garden active and the banner visible.** If it falls back to "My plants," the rehydration race is back.

**Edge case — owner revokes caretaker2's access during session:**
- [ ] Caretaker2 pull-to-refresh or open the picker → `loadGardens` returns only own garden. Store falls back to `ownGardenId`. Banner disappears. No alert/toast.

**Screenshot:** take one of caretaker2 viewing owner's garden with the banner — useful for Phase 6 release notes.

---

## Block 3 — Write-gating, attribution, notification gate (Tasks 4.5–4.6)

### Code changes landed in Block 3

- `src/services/plantService.ts` — `fetchPlants` now uses a single embedded select `*, care_events(*, author:profiles(display_name))`. Two-query pattern dropped. Care events sorted client-side by `createdAt DESC` post-flatten so the existing UI ordering is preserved.
- `src/types/plant.ts` — already gained `authorDisplayName: string | null` in Block 1; no changes here.
- `src/utils/getInitials.ts` — new shared util. Returns "?" for null/empty, first two letters for single-word names, first+last initials for multi-word.
- `src/components/CareEventAvatar.tsx` — 20×20pt Luxor circle with Butter Moon Montserrat SemiBold 10pt initials. `displayName: string | null` prop; falls back to "?" via the shared util.
- `src/screens/PlantDetailScreen.tsx` — `HistoryItem` accepts `currentUserId`. Renders `CareEventAvatar` only when `event.authorId !== currentUserId` (the user's own events stay unmarked, per D2).
- `src/utils/showErrorToast.ts` — new. Tiny Zustand store + `showErrorToast(message)` function.
- `src/components/Toast.tsx` — fade-in/out, 2s visible, animated `opacity` only (`useNativeDriver: true`). Hemlock background, Butter Moon text. Mounted at `App.tsx` root inside the navigation container.
- `src/store/usePlantStore.ts` — `addPlant`/`updatePlant`/`removePlant` now check `error?.code === '42501'` and call `showErrorToast(FORBIDDEN_TOAST)`. Other errors keep existing console.warn.
- `src/services/notificationService.ts` — `scheduleWateringNotification(plant, currentUserId)`. Returns early when `plant.userId !== currentUserId` so caretakers don't get reminders for someone else's plants. `cancelWateringNotification` is unchanged (idempotent).
- `src/store/usePlantStore.ts` `markWatered` — captures `useAuthStore.getState().user?.id` BEFORE any await, passes it to `scheduleWateringNotification`. `addPlant` does the same on the post-create reschedule.
- `src/screens/PlantDetailScreen.tsx` `handleSaveEdits` — passes `userId` (already in scope) to `scheduleWateringNotification`.
- `src/screens/HomeScreen.tsx` — `isOwnGarden` selector. FAB hidden when `!isOwnGarden`. EmptyState button gated too: caretakers viewing the owner's empty garden see "No plants here yet / This gardener hasn't added any plants yet" with no Add button.
- `src/screens/PlantDetailScreen.tsx` — `isOwnGarden` selector. Header-right Edit hidden, Remove plant section hidden, Notes "Add/Edit" link hidden, Notes TextInput unmounted (only renders when `isEditingNotes && isOwnGarden`). Mark Watered + Mark Fertilized stay enabled per plan §4.6.
- `src/screens/AddPlantScreen.tsx` — `useLayoutEffect` calls `navigation.goBack()` if `!isOwnGarden`, plus a render-time `if (!isOwnGarden) return null` guard so there's no content flash before pop.
- **`src/screens/PlantDetailScreen.tsx` __DEV__ debug button** — discreet `[DEBUG] Force remove` text below the danger section, only renders when `__DEV__ === true`. Calls `removePlant(plant.id)` in a try/catch. **Block 4 removes this before merge.**

### Verifications run after code changes

- ✅ `npx tsc --noEmit` — zero errors.
- ✅ Hardcoded-hex scan on new + modified files — zero matches.
- ✅ `any`/`@ts-ignore` scan on new + modified files — zero matches.
- ✅ Unselectored Zustand store destructure scan — zero matches.

### Pause Point 3 — verification checklist (for Sam)

**Setup:** sign in as owner, mark a plant watered (so owner has a self-authored event in history), sign out.

**Sign in as caretaker2:**
1. [ ] Header reads "My plants" — own (empty) garden by default.
2. [ ] Switch to owner's garden via picker. Banner appears.
3. [ ] **HomeScreen:** No FAB visible. EmptyState (if applicable) shows no Add button.
4. [ ] Tap any plant → PlantDetailScreen.
5. [ ] **No "Edit" button in header.** No "Remove plant" button. No "Add/Edit" link on Notes.
6. [ ] **"Mark watered" button is enabled.** Tap it. Confirmation animation fires; care event appears in history.
7. [ ] Notes field shows the owner's notes (or "No notes from the owner yet."). Cannot tap Add. Cannot focus a TextInput.
8. [ ] Pop back to Home. The plant's "last watered" updates after a refresh.

**Negative test (the [DEBUG] button):**
9. [ ] On a plant detail in owner's garden, tap **[DEBUG] Force remove**. Generic toast fires ("Something went wrong. Please try again."). Plant is NOT removed (rollback). Supabase logs show 42501 on `plants` DELETE.
10. [ ] Without the [DEBUG] button: nothing reachable in the UI produces a 42501. (If anything else does, the UI gate has a hole.)

**Sign back in as owner, open the same plant:**
11. [ ] Care history shows two events: owner's earlier mark-watered (no avatar) and caretaker2's mark-watered (Luxor circle with caretaker2's initials, Butter Moon text).
12. [ ] Owner's own actions stay unmarked (D2).

**Notification gate:**
13. [ ] As caretaker2 marking owner's plant watered: no notification scheduled on caretaker's device.
14. [ ] As owner marking own plant watered: notification fires at 9 AM next watering day per existing behavior.

**AddPlant route guard (manual check):**
15. [ ] As caretaker2 in owner's garden, attempt to navigate to AddPlant via any deep-link or programmatic nav (typing into Metro debug menu, etc.). Screen pops back immediately with no content flash.

**Post-flight cleanup (Block 4):** I'll remove the [DEBUG] button after sign-off.

---

## Final pass record

| Pause | Block | Sign-off | Notes |
|-------|-------|----------|-------|
| 1     | 4.0–4.2 | ✅ Sam (May 6) | Migrations 005 + 006 applied via Dashboard SQL Editor. RLS smoke tests passed for owner / caretaker2 / unrelated user — first live exercise of `has_garden_access(uuid)` for non-owner reads. App launches as owner and as caretaker2 clean. |
| 2     | 4.3–4.4 | ✅ Sam (May 6) | Picker opens, switches gardens, banner shows/hides correctly. Pull-to-refresh wired to active garden. Force-quit → relaunch reopens on owner's garden (rehydration race confirmed fixed). PlantDetailScreen pops automatically when active garden changes. Revoke-mid-session falls back silently to own. |
| 3     | 4.5–4.6 | ✅ Sam (May 6) | Caretaker UI gating clean (FAB hidden, Edit/Remove hidden, Notes read-only, AddPlantScreen unreachable). Mark Watered/Fertilized work for caretaker. Care event attribution avatars render only for non-self events (D2). [DEBUG] Force remove confirmed 42501 + generic toast + no removal. Notification gate confirmed: caretaker → no notification, owner → notification at 9 AM next day. |

### Block 4 cleanup

- ✅ `__DEV__` debug `[DEBUG] Force remove` button removed from `PlantDetailScreen`.
- ✅ `CLAUDE.md` Done section updated with Phase 4 entry.
- ✅ `CLAUDE.md` Caretaker Mode Integration Pattern updated to "Phases 0–4 complete" with Phase 4 schema, store, write-gating, attribution, notification-gate sections.
- ✅ `CLAUDE.md` Implementation Notes — added Phase 4 entries: garden state shape + naming, Zustand `persist` rehydration awaiting, `loadPlants(gardenId)` signature, `CareEvent.authorId` rename, PostgREST embed FK requirement, `isOwnGarden` selector pattern, notification gate signature, `getInitials` shared util, `showErrorToast` toast primitive.
- ✅ `CLAUDE.md` Deployment Learnings — added Phase 4 entries: Zustand persist rehydration awaiting, PostgREST FK requirement, first live RLS exercise of `has_garden_access`, account-switch persisted-id limitation, generic 42501 toast philosophy.
- ✅ `CLAUDE.md` Next-up — Phase 4 removed; Phase 5 (caretaker notes) moved to position 1.
- ✅ Final `npx tsc --noEmit`: 0 errors. Hardcoded-hex / `any` / unselectored-store scans on full Phase 4 surface: 0 matches.
- ✅ Session handoff doc generated at `Vira_Session_Handoff_2026-05-06.docx` (via `scripts/generate_handoff_phase4.py`, mirroring the Phase 3 generator).
