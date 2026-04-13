# Overnight Build Report — Apr 11, 2026

**Session:** Edit Plant + Profile Editing
**Branch:** `feature/edit-plant-profile`
**Mode:** build

---

## What was built

### Task 1 — Edit mode on PlantDetailScreen ✅

`src/screens/PlantDetailScreen.tsx` now has a full edit mode.

- Header-right **Edit** button (Luxor, Montserrat Bold) wired via
  `useLayoutEffect` + `navigation.setOptions`. Hidden while editing.
- In edit mode:
  - Nickname renders as a `TextInput` inside the hero overlay (white text,
    butterMoon underline, maxLength 50).
  - Location renders as a `TextInput` card below the hero (maxLength 100).
  - Pot size renders as a chip row (same `POT_SIZES` as AddPlantScreen).
  - Hero tap opens the pickImage Alert (Camera / Library / Cancel). The
    chosen URI is staged in `pendingPhotoUri` and **not uploaded** until
    the user taps Save.
  - **Re-identify plant** button (Butter Moon background, Hemlock text). If
    a new photo is staged it is uploaded first to get a Storage URL for the
    Edge Function; the Storage URL is cached in `pendingUploadedUrl` so Save
    doesn't re-upload. Loading state copy: "Getting to know your plant..."
  - Save (Vermillion) and Cancel (Butter Moon) buttons at the bottom.
- Save logic:
  - Builds a `Partial<Plant>` containing only changed fields.
  - Uploads the pending photo if not yet uploaded; deletes the old remote
    photo from Storage.
  - Merges re-identify AI results (`name`, `health`, `careNotes`,
    `waterFrequencyDays`, `fertilizeFrequencyDays`).
  - Calls `usePlantStore.updatePlant(id, updates)` (already accepts partials).
  - Reschedules the watering notification when `waterFrequencyDays` changes,
    using the `{ ...plant, ...updates }` pattern to avoid the stale-state
    bug documented in `markWatered`.
  - Alert with brand-tone copy on failure, stays in edit mode.
- Cancel logic: deletes any orphaned re-identify upload from Storage, clears
  all pending state, exits edit mode.
- `KeyboardAvoidingView` wrapping the ScrollView with
  `keyboardShouldPersistTaps="handled"`.
- Full accessibility labels on every interactive element; min 44pt touch
  targets on all buttons/chips.
- Read-only mode (care countdowns, notes, history, Vira Pot placeholder,
  Remove button) is unchanged.

**No store or service changes were needed** — `updatePlant` in
`usePlantStore.ts` already accepts `Partial<Plant>`, and
`plantService.updatePlantRemote` already maps each column conditionally, so
only changed fields are sent to Supabase.

### Task 2 — Profile editing in Settings ✅

- `src/services/auth.ts`: added `updateProfile(userId, {displayName})` that
  writes to `profiles.display_name`.
- `src/screens/SettingsScreen.tsx`: added inline edit mode for the display
  name.
  - "Edit" text button next to the name (Luxor, Montserrat Bold).
  - TextInput (maxLength 50, autoFocus, returnKeyType="done") with inline
    Save (Vermillion text) and Cancel (Hemlock text) buttons.
  - Empty-name guard, Alert on save failure, stays in edit mode on error.
  - Email stays read-only (Supabase Auth email change flow is out of scope).
  - No `useAuthStore` changes needed — SettingsScreen already manages its
    own local display name state.

### Task 3 — Verify, audit, document ✅

- `npx tsc --noEmit` — **zero errors.**
- Grep audits — **clean** after one pre-existing drift fix:
  - `src/screens/OnboardingScreen.tsx:590` — hardcoded `'#FFFFFF'` replaced
    with `colors.white`.
  - `src/screens/OnboardingScreen.tsx:122` — destructured
    `usePlantStore()` replaced with two targeted selectors.
- `CLAUDE.md` updated with completed work, new "Next up" list, and
  implementation notes for the Edit Plant pattern and Profile editing.

---

## Files changed

- `src/screens/PlantDetailScreen.tsx` — Edit mode (rewrite of the main
  component, styles extended; read-only render path preserved).
- `src/screens/SettingsScreen.tsx` — Display name edit mode.
- `src/services/auth.ts` — `updateProfile()`.
- `src/screens/OnboardingScreen.tsx` — 2 drift fixes surfaced by the audit.
- `CLAUDE.md` — session notes + next-up list.
- `report.md` — this file.

No changes to `src/store/usePlantStore.ts`, `src/services/plantService.ts`,
`src/store/useAuthStore.ts`, or navigation types.

---

## Verification status

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ zero errors |
| No hardcoded colors outside `theme/vira.ts` | ✅ clean |
| All `RootStackParamList` references in `navigation.ts` or imports | ✅ clean |
| No unselectored `usePlantStore()` / `useAuthStore()` | ✅ clean |
| `accessibilityLabel` on every new interactive element | ✅ |
| 44×44pt minimum touch targets on new buttons/chips | ✅ |
| Partial updates via `updatePlant` | ✅ (no store change needed) |
| Photo upload uses `arrayBuffer()` pattern | ✅ (via existing `photoService`) |
| `analyzePlant` called via `supabase.functions.invoke` | ✅ (via existing `aiService`) |
| iOS simulator build + manual flow test | ⏳ **deferred** — autonomous session |

---

## Open items for morning session

1. **Manual smoke test on iPhone 17 Pro simulator.** The plan's Task 3
   checklist includes a live navigation pass through edit mode on
   PlantDetail and Settings. This requires interaction and was skipped in
   the autonomous run. Things to exercise:
   - Tap Edit → change nickname → Save → confirm name updates in Home
     list and in hero on re-entry.
   - Tap Edit → change photo (gallery) → Save → confirm new photo loads
     from Supabase Storage after reload, old photo is gone from bucket.
   - Tap Edit → change photo → tap Re-identify → confirm species/care
     frequencies update, then tap Save.
   - Tap Edit → change pot size → Save → confirm persistence after
     killing and relaunching the app (checks Supabase sync).
   - Tap Edit → make changes → tap Cancel → confirm nothing persisted.
   - Rate-limit path: open dev tools and force an `AnalysisError` with
     code `rate_limited` during re-identify — confirm the alert shows
     and the screen stays in edit mode.
   - Settings → Edit display name → Save → reload → confirm the name
     comes back from the `profiles` table.
   - Keyboard avoidance: focus the location TextInput on a small
     simulator and confirm it scrolls into view above the keyboard.

2. **TestFlight build 2.** Once the manual smoke passes, archive + upload
   via `xcodebuild` CLI with `-allowProvisioningUpdates` (remember the
   post-pull `DEVELOPMENT_TEAM` sed fix if needed).

3. **Notifee on Ninja Sam.** Still pending from the previous session —
   unrelated to this branch but worth confirming after TestFlight build 2
   since TestFlight sidesteps the iOS 26 Local Network issue.

---

## Design decisions worth flagging

- **Single screen, not a new route.** The plan explicitly said not to add
  a new screen, so edit mode is an `isEditing` state inside
  `PlantDetailScreen`. This keeps navigation simple and means the header
  Edit button can sit on the existing transparent header.

- **Header Edit button wired via `useLayoutEffect`.** React Navigation's
  recommended pattern for dynamic headers. Hidden while editing so the
  primary action is the bottom Save button (avoids the "two Save buttons"
  confusion).

- **`pendingPhotoUri` + `pendingUploadedUrl` pattern.** The trickiest bit
  of Task 1 was the interaction between "stage photo locally" and
  "re-identify needs a Storage URL." Separating the two state slots lets
  Save reuse an already-uploaded URL without double-uploading, while
  Cancel can still clean up an orphaned upload if the user bails out
  after re-identify.

- **AI results stored in `aiOverrides` rather than applied immediately.**
  This means re-identify doesn't mutate the plant until the user taps
  Save — consistent with the rest of edit mode being all-or-nothing. If
  the user re-identifies and then cancels, no data is touched.

- **No store changes.** `updatePlant` was already partial-safe. Sticking
  to "don't refactor beyond the task" per the CE guidance paid off here.

- **Drift fixes in OnboardingScreen.** The plan's grep audits would have
  flagged these as failures, and they pre-existed this branch. Fixed them
  in-scope since they were 2 lines each and directly in the audit path.
  Called out separately in CLAUDE.md so they don't get attributed to the
  Edit Plant feature during review.

---

## Risk notes for Sam

- **I did not run the iOS simulator.** Everything compiles, audits pass,
  and the logic mirrors the existing Add Plant / photo upload patterns,
  but there's no substitute for actually tapping through the flow. Do the
  manual smoke before shipping TestFlight build 2.

- **`plant.name` update on re-identify overwrites the species.** This is
  intentional per the plan but worth flagging — if a user re-identifies
  a mis-ID'd plant, their original species string is lost. No undo.

- **Pot size chip row width.** Six chips sharing `flex: 1` may be tight
  on smaller simulators. Visual verification on iPhone SE–sized screens
  would be worthwhile before a release.
