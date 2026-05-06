# Claude Code Session Prompt — Caretaker Mode Phase 4

**Plan:** `docs/plans/caretaker-mode-ce-plan-v3.0.md`
**Mode:** Single session with three pause points. NOT fully autonomous.
**Estimated wall clock:** 2–3 hours active, plus pause-point verification time between blocks.

---

## Read this first

You are executing Phase 4 of caretaker mode for the Vira Plants iOS app. The full plan is at `docs/plans/caretaker-mode-ce-plan-v3.0.md`. **Read it completely before writing any code.** It contains the locked design decisions, the migration SQL, the open questions resolved with reasoning, and the verification criteria for each pause point.

You are also bound by the conventions in `CLAUDE.md` and the `vira-mobile-engineer` skill. The non-negotiable ones for this session:

- **TypeScript strict mode.** No `any`, no `@ts-ignore`. Use proper types from `src/types/`.
- **Theme tokens only.** Every color comes from `src/theme/vira.ts`. Grep for hardcoded hex (`#[0-9A-Fa-f]{3,6}`) before committing — should match zero new occurrences in your changes.
- **Zustand selectors only.** `useStore(s => s.thing)`, never `const store = useStore()`.
- **Navigation types in `src/types/navigation.ts` only.** Don't define route params inline in screens.
- **Supabase patterns:** `supabase.functions.invoke()` not raw fetch; `arrayBuffer()` not `blob()` for file uploads; deploy Edge Functions with `--no-verify-jwt`.

If anything in this prompt conflicts with `CLAUDE.md` or the v3.0 plan, **the plan wins.** Flag the conflict in `questions.md` and continue with the plan.

---

## Critical pre-session check (do this BEFORE writing any code)

The v3.0 plan's "Critical pre-flight verification" section requires confirming the `plants` SELECT policy allows caretaker reads via `has_garden_access`. **If this check has not been done by the human, STOP and ask before proceeding.** The whole Phase 4 read story collapses at pause 1 if this RLS isn't right.

Specifically, the human should have run:

```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_clause
FROM pg_policy
WHERE polrelid = 'public.plants'::regclass
  AND polcmd = 'r';
```

…and confirmed the policy references `has_garden_access`. If they didn't run it, ask them to run it before starting. If the policy is missing, apply migration `005a_plants_caretaker_select.sql` first (template in plan §"Critical pre-flight verification").

---

## Branching and commits

- Branch from `main`: `git checkout -b phase-4-caretaker-mode`
- Commit at every pause point with a clear message:
  - After 4.2: `feat(caretaker): phase 4.0-4.2 — schema migration 005, get_my_gardens RPC, useGardenStore, loadPlants(gardenId)`
  - After 4.4: `feat(caretaker): phase 4.3-4.4 — gardenService, header dropdown, GardenPickerBottomSheet, banner`
  - After 4.6: `feat(caretaker): phase 4.5-4.6 — care event attribution avatars, write-gating, notification gate`
- **Do NOT merge to main without human sign-off at pause 3.**
- Final PR is opened by the human, not by you, after pause 3 is signed off.

---

## Execution blocks

### Block 1 — schema, store, and plant loading (4.0–4.2)

Goal: schema is in place, `useGardenStore` is wired, `usePlantStore.loadPlants(gardenId)` works, and the app can launch as both owner and caretaker without crashing.

**Tasks:**

1. **Apply migration 005** (`care_events.user_id → author_id`).
   - Read plan §"Migration 005 — `care_events.author_id`" carefully. Run pre-flight steps 1–4 first to confirm actual policy/index/FK names in the live DB.
   - If pre-flight reveals different names than the plan's defaults, update the migration SQL accordingly before pasting into Supabase Dashboard SQL Editor.
   - Apply via Dashboard SQL Editor, statement-by-statement (no BEGIN/COMMIT).
   - Backfill the migration file to `supabase/migrations/005_care_event_author.sql` after success.
   - Migration includes: drop policies, drop FK, drop indexes, RENAME column, add new FK to `profiles.id`, recreate indexes, recreate policies (with the new caretaker access patterns from the plan).
2. **Repo-wide rename**: grep for every reference to `care_events.user_id`, the string `'user_id'` near care-event code, `rowToCareEvent`, and the `CareEvent.userId` type field. Update each to `author_id` / `authorId`. Expected hits per the plan: `src/services/plantService.ts`, `src/types/plant.ts`, possibly `usePlantStore.ts`'s `markWatered` / `logCareEvent`.
3. **Apply migration 006** (`get_my_gardens()` RPC).
   - SQL is in plan §"4.0 — `get_my_gardens()` RPC". Run via Dashboard SQL Editor.
   - Backfill to `supabase/migrations/006_get_my_gardens.sql`.
   - Verify with `SELECT proname, prorettype::regtype FROM pg_proc WHERE proname = 'get_my_gardens';` — expect 1 row.
4. **Create `src/types/garden.ts`** with the `Garden` interface and `GardenRole` type per plan §4.1.
5. **Create `src/services/gardenService.ts`** with the `listMyGardens()` function per plan §4.3. Include the `rowToGarden` mapper. Skip the `GardenError` class for now — the plan accepts raw error throws here.
6. **Create `src/stores/useGardenStore.ts`** per plan §4.1. Include:
   - State: `ownGardenId`, `activeGardenId`, `gardens`, `isLoading`.
   - Actions: `loadGardens(currentUserId)`, `setActiveGarden(gardenId)`, `clearOnSignOut()`.
   - `persist` middleware with `partialize` to persist only `activeGardenId`. Storage key: `vira:activeGardenId`.
   - The `loadGardens` fallback logic: if persisted `activeGardenId` is no longer in the gardens list, fall back to `ownGardenId`.
7. **Refactor `usePlantStore.loadPlants` to accept `gardenId`** per plan §4.2.
   - New signature: `loadPlants(gardenId: string): Promise<void>`.
   - Add `.eq('user_id', gardenId)` to the existing PostgREST query.
   - **Do NOT touch the `.select` embed yet** — that comes in 4.5.
   - `set({ plants })` does full replacement, not merge.
8. **Wire App.tsx auth-change handler with rehydration awaiting**.
   - Use the exact pattern from plan §4.1 "Rehydration race — REQUIRED handling": await `useGardenStore.persist.onFinishHydration()` if `hasHydrated()` is false, THEN call `loadGardens`, THEN call `loadPlants(activeId)`.
   - Use the `cancelled` flag pattern to handle re-auth cleanly.
9. **Wire `clearOnSignOut`** in `useAuthStore`'s sign-out flow.
10. **Update `acceptInvite` flow** to call `useGardenStore.getState().loadGardens(userId)` after success (replaces the `TODO(phase-4)` in `SettingsScreen.handleAcceptInvite`).

**Constraints during this block:**

- Do NOT add the picker UI, banner, or write-gating yet. Those are blocks 2 and 3.
- The app should compile and launch as both owner and caretaker. Caretakers will land on their own (empty) garden — that's correct per D4.
- TypeScript clean: `npx tsc --noEmit` zero errors.
- Update `test-results/phase-4-test.md` with what was applied.

**Commit and STOP.** Output a clear pause message asking for human verification of pause point 1.

---

### ⏸ PAUSE POINT 1

**Output to the human:**

```
PAUSE POINT 1 reached. Phase 4.0–4.2 complete.

Please verify before I continue:
- [ ] Migration 005 applied successfully (run the SQL probes from plan §"Pause Point 1 — What to verify")
- [ ] Migration 006 (get_my_gardens) applied successfully
- [ ] RLS smoke tests pass for all three account contexts (owner / caretaker2 / unrelated user)
- [ ] App launches cleanly as owner (own plants render)
- [ ] App launches cleanly as caretaker2 (own empty garden renders by default per D4)

The picker UI is NOT in yet. To verify caretaker can READ owner plants at all,
the plan suggests temporarily patching App.tsx to call loadPlants(<owner-uuid>)
for one launch. Revert before saying OK.

Reply "continue" to proceed to block 2 (UI surfaces). Reply with any failure
mode and I'll debug before continuing.
```

**Do not proceed without explicit human "continue" reply.**

---

### Block 2 — picker, banner, header (4.3–4.4)

Goal: the user can see whose garden is active in the header, switch via a bottom sheet picker, see the persistent banner when in caretaker mode, and have plant detail pop on garden switch.

**Tasks:**

1. **Header label** in `HomeScreen.tsx`, set via `useLayoutEffect` + `navigation.setOptions`. Reads from `useGardenStore`. Tappable, opens picker. Includes chevron-down icon. Plan §4.4 has the exact code shape.
2. **Create `src/components/GardenPickerBottomSheet.tsx`**.
   - React Native `Modal` with `animationType="slide"` and `transparent`.
   - Lists gardens from `useGardenStore`. Active garden is highlighted with a check icon.
   - Tap a row → `setActiveGarden(id)` then `onClose()`.
   - On `visible` becoming true, calls `loadGardens(userId)` to refresh (Q4 trigger).
   - Backdrop press closes.
3. **Create `src/components/CaretakerBanner.tsx`**.
   - Reads `activeGardenId` and `ownGardenId` from `useGardenStore`.
   - Returns null when `activeGardenId === ownGardenId`.
   - Renders `Caring for {ownerDisplayName || 'A Vira gardener'}'s garden`. Note capitalization — match Phase 3's PendingInviteCard.
   - Hemlock background, Butter Moon text, Montserrat SemiBold, padding per existing card patterns.
   - Tappable, opens picker.
4. **Wire banner into `HomeScreen` and `PlantDetailScreen`** directly under the header. Banner self-hides when in own garden.
5. **PlantDetailScreen pop-on-switch.** Add the `useEffect` that watches `activeGardenId` against `initialActiveId.current` and calls `navigation.goBack()` on divergence. See plan §4.4 for the exact pattern.
6. **App.tsx subscription for activeGardenId changes.**
   - Use `useGardenStore.subscribe((state) => state.activeGardenId, (activeId) => { ... })` to fire `loadPlants(activeId)` whenever activeId changes.
   - This is the SINGLE source of truth for "when garden switches, reload plants." Do NOT also put a `useEffect` on activeId in HomeScreen — that creates a double-fetch race.
7. **HomeScreen pull-to-refresh** reads `activeGardenId` and passes it to `loadPlants`.

**Constraints during this block:**

- Do NOT touch write-gating yet (FAB, Edit, Remove, AddPlant guard, notes editable). That's block 3.
- Care event avatars are still missing — that's also block 3.
- Bottom sheet uses Modal + slide. Do NOT pull in `@gorhom/bottom-sheet` or any new dependency.
- TypeScript clean. Theme tokens only. Selectors only.
- All tappable elements at minimum 44×44pt (banner, header label, picker rows).
- Update `test-results/phase-4-test.md` with build status.

**Commit and STOP.** Pause point 2.

---

### ⏸ PAUSE POINT 2

**Output to the human:**

```
PAUSE POINT 2 reached. Phase 4.3–4.4 complete.

Please verify before I continue (full tap-through script in plan §"Pause Point 2 — What to verify"):

- [ ] As owner: header reads "My plants", picker shows 1 garden, no banner.
- [ ] As caretaker2: defaults to own garden. Picker shows 2 entries.
- [ ] Switch to owner's garden → header updates, banner appears, plant list shows owner's plants.
- [ ] Pull-to-refresh on Home reloads against active garden.
- [ ] Switch back to "My plants" → banner disappears, list updates.

REGRESSION TESTS (these are the post-stress-test fixes — verify carefully):
- [ ] Force-quit the app while in owner's garden as caretaker2. Relaunch.
      App MUST reopen with owner's garden active and banner visible.
      If it falls back to "My plants", the rehydration race is back.
- [ ] As caretaker2 viewing owner's plant detail: tap banner, switch to "My plants"
      via picker. PlantDetailScreen MUST pop automatically.
- [ ] Take a screenshot of caretaker2 viewing owner's garden — useful for Phase 6.

Reply "continue" to proceed to block 3 (write-gating + attribution avatars).
```

**Do not proceed without explicit human "continue" reply.**

---

### Block 3 — write-gating, attribution avatars, notification gate (4.5–4.6 + notification special case)

Goal: caretakers cannot reach write paths (FAB hidden, Edit/Remove hidden, AddPlant unreachable, notes read-only); owner can see attributed avatars on caretaker-logged events; notifications schedule only for own plants.

**Tasks:**

1. **Update `loadPlants` `.select` to embed author display name.**
   - Change `.select('*, care_events(*)')` to `.select('*, care_events(*, author:profiles(display_name))')`.
   - This is the change deferred from 4.2.
   - Update `rowToCareEvent` to flatten `row.author?.display_name` into `authorDisplayName`. Update `CareEvent` type in `src/types/plant.ts` to add `authorDisplayName: string | null`.
2. **Extract or create `src/utils/getInitials.ts`.**
   - If a getInitials util already exists in SettingsScreen, extract it. Otherwise create per plan §4.5.
   - Update SettingsScreen's avatar to import from the shared util.
3. **Create `src/components/CareEventAvatar.tsx`** per plan §4.5.
   - 20×20pt circle, Luxor background, Butter Moon Montserrat SemiBold 10pt text.
   - Falls back to "?" when displayName is null.
4. **Wire avatar into PlantDetailScreen care history list.**
   - For each care event, render `CareEventAvatar` only when `event.authorId !== currentUserId`.
   - `currentUserId` from `useAuthStore(s => s.user?.id)`.
5. **Add `isOwnGarden` selector** in HomeScreen, PlantDetailScreen, AddPlantScreen.
   - `useGardenStore(s => s.activeGardenId !== null && s.activeGardenId === s.ownGardenId)`.
6. **HomeScreen FAB gate**: render only when `isOwnGarden`.
7. **PlantDetailScreen Edit/Remove/notes gating**:
   - Header-right "Edit" button: render only when `isOwnGarden`.
   - "Remove plant" button in edit mode: render only when `isOwnGarden`.
   - Notes TextInput: `editable={isOwnGarden}`.
   - Any save-notes button or auto-save call: gate by `isOwnGarden`.
   - Mark Watered / Mark Fertilized: NO gating — caretakers can use these.
8. **AddPlantScreen on-mount guard**: render-time `if (!isOwnGarden) return null` plus `useLayoutEffect` calling `navigation.goBack()` per plan §4.6. No flash.
9. **Generic 42501 error toast.**
   - Create `src/utils/showErrorToast.ts` if it doesn't exist. Simple View + Animated fade-in/out, 2s auto-dismiss, Hemlock background with Butter Moon text.
   - In `usePlantStore` `addPlant`, `updatePlant`, `removePlant` catch blocks: check `error?.code === '42501'` and call `showErrorToast('Something went wrong. Please try again.')`. No per-action copy.
10. **Notification gate.**
    - Update `scheduleWateringNotification(plant, currentUserId)` signature in `src/services/notificationService.ts`.
    - Inside: `if (plant.userId !== currentUserId) return;`
    - Update `markWatered` in `usePlantStore` to capture `currentUserId = useAuthStore.getState().user?.id` BEFORE any await, then pass it to `scheduleWateringNotification(updatedPlant, currentUserId)`.
    - `cancelWateringNotification` does NOT need a similar gate.
11. **Add the `__DEV__` debug button to PlantDetailScreen** for pause-point-3 negative testing. Per plan §"Pause Point 3 — Negative tests". Position it inconspicuously (e.g., bottom of the screen). It calls `removePlant(plant.id)` in a try/catch that logs the error.
12. Update `test-results/phase-4-test.md` with the build status.

**Constraints during this block:**

- TypeScript clean. Theme tokens only. Selectors only.
- The `__DEV__` debug button is for testing only — remember this is in the post-flight checklist for removal.
- Generic toast only fires on 42501 — other errors keep their existing handling.
- After this block: `npx tsc --noEmit` zero errors, hardcoded-hex scan zero new occurrences.

**Commit and STOP.** Pause point 3.

---

### ⏸ PAUSE POINT 3

**Output to the human:**

```
PAUSE POINT 3 reached. Phase 4.5–4.6 complete. This is the FINAL verification before merge.

Please run the full end-to-end script in plan §"Pause Point 3 — What to verify".
Key checks:

- [ ] Caretaker UI gating: FAB hidden, Edit hidden, Remove hidden, notes read-only.
- [ ] AddPlantScreen unreachable as caretaker (no UI path; render-time guard catches direct nav).
- [ ] Mark Watered + Mark Fertilized work for caretaker.
- [ ] Care event attribution: as owner, view a plant where caretaker logged an event.
      Luxor avatar circle with caretaker's initials shows.
      Owner's own actions are unmarked.
- [ ] Notification gate: caretaker marks watered → no notification fires on caretaker's
      device. Owner marks watered → notification fires at 9 AM next watering day.
- [ ] Negative test (with the [DEBUG] button): caretaker tap → 42501 in Supabase logs,
      generic toast fires, plant NOT removed.

Reply "continue" if all checks pass — I'll then:
  1. Remove the [DEBUG] button.
  2. Update CLAUDE.md with the Phase 4 entry.
  3. Update CLAUDE.md Caretaker Mode Integration Pattern.
  4. Add Deployment Learnings entries (rehydration pattern, account-switch limitation).
  5. Open the PR.

Reply with any failure mode and I'll debug before continuing.
```

**Do not proceed without explicit human "continue" reply.**

---

### Block 4 — final cleanup (after pause 3 signed off)

1. **Remove the `__DEV__` debug button** from PlantDetailScreen.
2. **Update `CLAUDE.md`**:
   - Add Phase 4 entry to the Done section (mirror Phase 2/3 structure).
   - Update Caretaker Mode Integration Pattern with `useGardenStore`, `gardenService.ts`, `get_my_gardens()` RPC, write-gating pattern, notification gate.
   - Update Implementation Notes with the rehydration-handling pattern, `loadPlants(gardenId)` signature change, `CareEvent.authorId` rename.
   - Move "Caretaker Mode Phase 4" off the "Next up" list.
3. **Add Deployment Learnings entries** to CLAUDE.md:
   - **Zustand `persist` rehydration awaiting** — the `useGardenStore.persist.onFinishHydration` pattern is reusable for any future persisted store. Without it, persisted values are silently overwritten on every cold launch.
   - **PostgREST embedded resource requires explicit FK** — caches the lesson that `author:profiles(display_name)` only works because migration 005 explicitly added `care_events.author_id → profiles.id`. PostgREST does not infer the relationship through `auth.users`.
   - **Account-switch loses persisted activeGardenId** — known per-device limitation, not per-account.
   - **First live RLS exercise of `has_garden_access`** — Phase 4 was the first time the helper was called by a non-owner read. (Plus any new wrinkles you discovered during execution.)
4. **Update `test-results/phase-4-test.md`** with the final pass record (all three pause points + sign-offs).
5. **Generate the session handoff doc**: `Vira_Session_Handoff_2026-MM-DD.docx` mirroring the structure of `Vira_Session_Handoff_2026-04-24.docx`.
6. **Commit the cleanup** and **open the PR via `gh pr create`** with a comprehensive description that links to the v3.0 plan.
7. **Do NOT merge to main yourself.** The human reviews the PR and merges.

---

## Behavioral expectations

- **Read the plan completely before starting.** Don't skim. The stress-tested v3.0 plan has 4 critical fixes and 6 high-severity fixes that prevent real bugs — they need to be executed exactly.
- **At each pause point, output the explicit pause message and stop.** Do not continue based on guessing what the human wants. Wait for "continue."
- **Use Tab 3 for file inspection** when debugging — Claude Code summarizes shell output rather than displaying raw content.
- **If a Supabase migration fails partway through**, do NOT re-run the whole thing blindly. Read the error, identify which statement failed, fix the cause, and continue from that statement. Migration 005's pre-flight steps should prevent failures.
- **If TypeScript errors after the migration 005 rename**, that's expected — work through them by updating each reference to `author_id` / `authorId`. Don't suppress with `any` or `@ts-ignore`.
- **If `npx tsc --noEmit` produces ANY errors at the end of a block**, STOP and ask. Do not commit broken types.
- **Keep edits surgical.** Don't rewrite files end-to-end when a targeted change is enough. Cursor-style edits are preferred — read the existing file, change only what needs changing.
- **Log unexpected findings to `questions.md`** as you go. The human reviews these between pause points.

---

## Failure mode reminders

If you hit one of these, the v3.0 plan and CLAUDE.md have the answer:

- **42702 ambiguous column** in `get_my_gardens` → output column name collides with a table column. Rename to `garden_*` prefix.
- **42P13 cannot change return type** when iterating on `get_my_gardens` → DROP the function with explicit argument types first, then CREATE.
- **42501 permission denied** during caretaker reads → either the pre-flight RLS check on `plants` was skipped, or migration 005's policies aren't right.
- **`UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`** on Edge Function calls → deploy with `--no-verify-jwt`.
- **PostgREST returns care_events without `author` field** → migration 005 step 5 (FK to `profiles.id`) didn't apply. Re-run that statement.
- **Persisted activeGardenId reset on every cold launch** → `useGardenStore.persist.onFinishHydration` not awaited in App.tsx. Re-check 4.1.
- **PlantDetail stays open on garden switch** → 4.4's `useEffect` watching `activeGardenId` is missing from PlantDetailScreen.

---

## Tools you have

- Tab 1 (Metro): already running per session start. Reset cache via `npx react-native start --reset-cache` if state gets weird.
- Tab 2 (you): Claude Code.
- Tab 3 (general terminal): file inspection, `git`, `xcodebuild`, Supabase Dashboard SQL Editor in browser.
- `caffeinate -i` running to prevent Mac sleep during long-running steps.
- `--dangerously-skip-permissions` enabled — but for migrations and PR creation, prefer to ASK the human via the pause-point output rather than assume you have permission.

---

## End state when done

- All Phase 4 tasks complete.
- `main` is unchanged. Branch `phase-4-caretaker-mode` has the work.
- PR is open and tagged for review by the human.
- `CLAUDE.md` and `test-results/phase-4-test.md` reflect the work.
- Session handoff `.docx` generated.
- `[DEBUG] Force remove` button is gone.
- `npx tsc --noEmit` zero errors.
- Hardcoded-hex scan zero new occurrences.

If you can't reach this end state, STOP and ask. Do NOT merge a partial Phase 4 to main.

---

*Generated for the Phase 4 v3.0 plan. Authored Apr 24, 2026.*
