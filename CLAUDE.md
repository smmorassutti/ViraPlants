# Vira Plants Mobile App

Self-watering plant system companion app. Phase 1 = free plant companion (distribution play). Phase 2 = Vira pot controller via BLE. Every decision must serve both phases.

## Tech Stack

- **React Native 0.84** — bare workflow, NOT Expo (BLE requires native modules)
- **TypeScript** — strict mode
- **Zustand** — state management (lightweight, excellent TS support)
- **Supabase** — backend (Postgres, Auth, Storage, Edge Functions)
- **react-native-image-picker** — camera + photo library access (1200x1200, quality 0.8)
- **react-native-ble-plx** — installed, not configured yet (Phase 2). BLE scaffold in `src/services/bleService.ts`, `src/types/ble.ts`, `src/store/useBleStore.ts`.
- **@notifee/react-native 9.1.8** — installed, native linking FIXED for RN 0.84 New Architecture. Degradation wrapper removed — direct static import. Physical device confirmation still pending (Metro blocked by iOS 26).
- **@react-native-async-storage/async-storage** — installed and working
- **@react-native-google-signin/google-signin 16.x** — installed, wired, and confirmed working in simulator. OAuth client ID configured in Supabase and URL scheme added to Info.plist.
- **@invertase/react-native-apple-authentication 2.x** — installed but UI deferred. Required before App Store submission (Apple policy for apps offering third-party sign-in). Will be re-wired pre-submission along with Xcode capability, Supabase provider config, and Apple Services ID.
- **Montserrat** — brand typeface (ExtraBold for H1, Bold for H2/buttons, Regular for body, SemiBold for labels)

## Build & Run

```bash
npx react-native run-ios          # Build and run on iOS simulator
npx react-native start --reset-cache  # Fix Metro/state issues
cd ios && pod install              # After adding native dependencies
lsof -i :8081 | grep LISTEN       # Find port conflicts
```

To reset onboarding state: delete app from simulator and reinstall.

## Project Structure

```
src/
├── screens/           # One file per screen, typed navigation props
├── components/        # Reusable UI components
├── store/
│   ├── usePlantStore.ts   # Plant data store, syncs to Supabase
│   ├── useAuthStore.ts    # Auth session state (session, user, isLoading)
│   └── useBleStore.ts     # BLE connection state (Phase 2 scaffold)
├── theme/
│   └── vira.ts            # Brand colors, typography, spacing
├── utils/
│   ├── pickImage.ts       # Camera/library image picker wrapper
│   └── careUtils.ts       # getDaysUntilCare, getLastCareDate helpers
├── types/
│   ├── navigation.ts      # ALL navigation types live here
│   ├── plant.ts           # Plant, PlantInput, CareEvent, Reminder, Profile
│   └── ble.ts             # ViraPot, WateringSchedule, BleConnectionState, BleError
├── config/
│   └── env.ts             # Supabase URL + anon key (gitignored)
└── services/
    ├── supabase.ts              # Singleton Supabase client
    ├── auth.ts                  # signUp, signIn, signOut, googleSignIn, getProfile, onAuthStateChange
    ├── plantService.ts          # Plant CRUD + care events (row ↔ type mappers)
    ├── photoService.ts          # Upload/delete plant photos to Supabase Storage
    ├── notificationService.ts   # Notifee watering notifications (direct import)
    ├── aiService.ts             # analyzePlant() — calls analyze-plant Edge Function
    └── bleService.ts            # BLE Vira Pot communication (Phase 2 scaffold)
```

## Hard Rules — Never Break These

1. **Never call Anthropic API from the mobile app.** Always proxy through Supabase Edge Functions.
2. **Never store API keys in the client.** Supabase anon key is the only key allowed.
3. **Never use Expo Go.** Bare React Native only — BLE needs native modules.
4. **Never declare navigation types outside `src/types/navigation.ts`.** Prevents circular deps.
5. **Never hardcode colors.** Always use `viraTheme.colors`, `viraTheme.spacing`, etc.
6. **Always include `connectionType` on plant records.** Default to `"manual"`. Phase 2 flips this to `"vira_pot"` — the entire transition depends on this field existing from day one.
7. **Always compress images before upload.** Target max 500KB per photo.
8. **Always check species cache before calling Claude.** A free app at scale can't afford fresh AI calls for every common plant.

## Code Conventions

**Screen props:** Every screen uses `NativeStackScreenProps<RootStackParamList, 'ScreenName'>` for typed navigation and route params.

**Imports:** `RootStackParamList` is always imported from `'../types/navigation'`.

**Store pattern:** Always use targeted selectors: `usePlantStore(s => s.actionName)`. Never destructure the whole store (`const {...} = usePlantStore()`), as it subscribes to all state changes. Use `getState()` for non-reactive reads (e.g., initial route check in App.tsx).

**Theme usage:** All styles reference `viraTheme.colors.hemlock`, `viraTheme.spacing.md`, etc. Never use raw hex values.

## Brand Colors

| Token | Hex | Role | Budget |
|-------|-----|------|--------|
| hemlock | #5B5F45 | Primary — headers, active states | 40% |
| butterMoon | #FCFEE6 | Primary — backgrounds, cards | 40% |
| luxor | #9A9331 | Secondary — highlights, labels | 15% |
| thistle | #D0CE94 | Secondary — borders, muted accents | — |
| lagoon | #181E14 | Dark text | — |
| vermillion | #E34234 | CTAs only | 5% max |

Vermillion is restricted to call-to-action buttons. Overuse breaks the calm aesthetic.

## Brand Voice

Write like a calm, capable friend. Use the plant's nickname. Be warm, grounded, reassuring.

**Use:** "Let's meet your plant", "Getting to know your plant...", "Time to water Monty"
**Avoid:** "Analyze & Save", "Processing request", "AI health checks"

## Data Model (src/types/plant.ts)

Key fields on every Plant record: `id`, `nickname`, `name` (species from Claude), `location`, `orientation`, `potSize`, `photoUrl`, `health`, `careNotes`, `notes` (user-editable), `waterFrequencyDays`, `fertilizeFrequencyDays`, `connectionType` ("manual" | "vira_pot"), `viraPotId` (null until paired), `careEvents[]`, `reminders[]`.

## Current State (April 11, 2026)

**Done:**
- Onboarding flow (4 screens) — Welcome, Features, Quick Setup, Add First Plant
- Add Plant flow (3 steps) — Photo (real image picker), Details, Results (real AI via Claude Vision)
- Zustand store with all actions (add/update/remove plant, log care events, mark watered/fertilized)
- Theme system with full brand palette
- Navigation with typed params
- HomeScreen — list + grid views with toggle, upcoming care tasks section, FAB to add plant, warm empty state
- PlantDetailScreen — hero photo (tap to update), gradient overlay, quick stats, care countdowns + mark done, editable notes, care history log, Vira Pot placeholder, remove plant with confirmation
- Components: PlantCard (list view), PlantGridItem (grid view), CareCountdown (countdown logic with overdue/urgent states, compact mode), MarkDoneButton (success animation, water-blue/green variants, lastDone display), ViraPotPlaceholder (coming soon card with dashed border)
- react-native-image-picker — `src/utils/pickImage.ts` wrapping camera/library with Alert chooser, integrated in AddPlantScreen + PlantDetailScreen hero
- Plant type includes `notes?: string` for user-editable notes (separate from AI-generated `careNotes`)
- Review fixes complete: dead `selectedPlant` removed from store, 12 theme color tokens added (no more hardcoded colors), Zustand selectors targeted across all screens, `Plant` type tightened (core fields required) with `PlantInput` for `addPlant`, care date logic extracted to `src/utils/careUtils.ts`, `maxLength` on all TextInputs, MarkDoneButton setTimeout cleanup
- Supabase integrated: client wired (`@supabase/supabase-js` + `react-native-url-polyfill`), full DB schema with RLS (profiles, plants, care_events, reminders, species_cache), Storage bucket `plant-photos` with per-user scoping
- Auth: email/password via Supabase Auth — LoginScreen, SignUpScreen, `useAuthStore`, auto-profile creation trigger, session persistence, sign-out in SettingsScreen
- Data sync: `usePlantStore` actions are optimistic (update Zustand immediately, sync to Supabase in background). `plantService.ts` handles row ↔ type mapping (snake_case DB ↔ camelCase TS). `loadPlants()` hydrates store on auth
- Photo upload: `photoService.ts` uploads to `plant-photos/{userId}/{plantId}/{timestamp}.jpg`, returns public URL. AddPlantScreen uploads after creation, PlantDetailScreen uploads on photo change (deletes old remote photo)
- Navigation gating: no session → Login/SignUp stack; authenticated → main app stack (Home, PlantDetail, AddPlant, Settings). Onboarding shown only if `!hasOnboarded`
- AI plant analysis: `analyze-plant` Edge Function calls Claude Vision (Sonnet) for species ID + care data. Species cache prevents redundant API calls. Rate limited to 10/user/day. `aiService.ts` client with typed errors. All failure modes (not_a_plant, rate_limited, network error) gracefully handled with manual-entry fallback.
- Local watering notifications: `src/services/notificationService.ts` — schedules a notification at 9 AM on next watering due date, reschedules on `markWatered`, cancels on `removePlant`. Direct static import (degradation wrapper removed Apr 2026). `requestPermission()` called once in App.tsx when `hasOnboarded && isAuthenticated`. Simulator confirmed working; physical device confirmation pending (Metro blocked by iOS 26).
- `hasOnboarded` persisted via AsyncStorage (key: `'hasOnboarded'`). Read in App.tsx first `useEffect` before `getSession` to prevent onboarding flash on relaunch. Written in `setHasOnboarded(true)` in usePlantStore.
- TestFlight: build 1.0 (1) submitted, internal tester (Sam M personal email) added, auto-distribution enabled for future builds.
- ViraLeafMark updated to use real brand PNG assets from `assets/images/` — `variant` prop (`'butterMoon' | 'hemlock' | 'luxor' | 'thistle' | 'black' | 'white'`) replaces old `color` prop. react-native-svg still installed but unused — remove when convenient.
- Brand assets: 8 icon PNGs in `assets/images/VIRA_Icon_*_RGB.png` (source: Vira - Logos/PNG/ICON/). Known issue: PNGs are RGB (no alpha channel) — if icon background is visible at runtime, transparency versions needed from designer.
- App icon set added to Xcode asset catalog (`ios/ViraPlantsTemp/Images.xcassets/AppIcon.appiconset/`).
- Metro on physical device: `NSLocalNetworkUsageDescription` + `NSBonjourServices` (`_http._tcp`) added to Info.plist. Rebuild required to test on Ninja Sam.
- Notifee degradation wrapper removed — direct static import of `@notifee/react-native`. All 3 public functions unchanged. Physical device confirmation still pending (Metro blocked by iOS 26 beta).
- **Google Sign-In complete:** `@react-native-google-signin/google-signin` installed, `googleSignIn()` in `src/services/auth.ts`, "Continue with Google" button on LoginScreen and SignUpScreen. `configureGoogleSignIn()` called in App.tsx on init. `GOOGLE_IOS_CLIENT_ID` in `src/config/env.ts`. Google OAuth client ID configured in Supabase Dashboard. URL scheme (reversed client ID) added to Info.plist `CFBundleURLTypes`. Confirmed working in simulator (Apr 10, 2026).
- **Settings screen complete:** Hemlock background, Butter Moon profile card with ViraLeafMark avatar, display name (OAuth full_name or email prefix), email, member since date, Vermillion sign-out CTA.
- **BLE scaffold complete (placeholder only):** `src/types/ble.ts` (ViraPot, WateringSchedule, BleConnectionState, BleError), `src/services/bleService.ts` (singleton, methods log/throw), `src/store/useBleStore.ts` (Zustand store with pots, connectionState, connectedPotId). Nothing wired to screens — ready for Phase 2 implementation.
- Fixed duplicate `requestPermission()` useEffect in App.tsx.
- **Edit Plant complete (Apr 11, 2026):** PlantDetailScreen now has an edit mode triggered from the header-right "Edit" button. Users can change nickname, location, and pot size inline, stage a new photo without uploading, and optionally tap "Re-identify plant" to run a fresh Claude Vision analysis. Save only uploads/updates changed fields, deletes the old remote photo, and reschedules the watering notification when `waterFrequencyDays` changes. Cancel cleans up any re-identify upload. `KeyboardAvoidingView` added. No new navigation route.
- **Profile editing in Settings complete (Apr 11, 2026):** Display name is now editable via an inline "Edit" link on SettingsScreen. Tapping shows a TextInput (maxLength 50) with Save/Cancel. New `updateProfile(userId, {displayName})` in `src/services/auth.ts` writes to `profiles.display_name`. Email and member-since remain read-only.
- **Drift cleanup (Apr 11, 2026):** Fixed one hardcoded `'#FFFFFF'` in `OnboardingScreen.tsx` (now `colors.white`) and one unselectored `usePlantStore()` destructure (now targeted selectors). Audits pass cleanly.

**Deferred:**
- **Apple Sign-In:** `@invertase/react-native-apple-authentication` package remains installed, but all UI (buttons, handlers) and the `appleSignIn()` function were removed on Apr 10, 2026. Apple requires Sign In with Apple for any app offering third-party sign-in (e.g. Google), so this MUST be re-wired before App Store submission. Pre-submission work: re-add `appleSignIn()` in `src/services/auth.ts`, restore `AppleButton` on LoginScreen + SignUpScreen, enable "Sign In with Apple" capability in Xcode → Signing & Capabilities, enable Apple provider in Supabase Dashboard → Authentication → Providers → Apple, create Apple Services ID + secret key in Apple Developer portal. Do not implement until pre-submission.

**In progress:**
- **Notifee on physical device:** Degradation wrapper removed, direct static import in place, simulator confirmed working. Physical device confirmation still pending Metro fix on Ninja Sam.
- **Metro on Ninja Sam:** Info.plist fix applied (`NSLocalNetworkUsageDescription` + `NSBonjourServices` with `_http._tcp`). Rebuild done. Physical device test still pending — check Settings → Privacy & Security → Local Network for ViraPlantsMobileApp after next launch.

**Pending setup (manual steps for Sam):**
1. Apple Sign-In (pre-submission only): Enable Apple provider in Supabase Dashboard → Authentication → Providers → Apple. Add "Sign In with Apple" capability in Xcode → Signing & Capabilities. Create Apple Services ID + secret key in Apple Developer portal. Re-wire UI + `appleSignIn()` in auth.ts.
2. Confirm Metro + Notifee on Ninja Sam physical device after rebuild.

**Next up (in order):**
1. Manual smoke test: Edit Plant + Profile Editing on iPhone 17 Pro simulator
2. Confirm Metro + Notifee on Ninja Sam physical device
3. TestFlight build 2 (ships Edit Plant + Profile Editing)
4. Plant sharing / caretaker mode — Invite by email, caretaker can view plants and mark watered/fertilized but can't edit or delete. Needs: `shared_access` DB table + migration, RLS updates on `plants` and `care_events`, invite Edge Function, app UI (invite flow, incoming invitations screen, "Caring for" section on HomeScreen, read-only gating for caretakers), revoke access from owner side. Multi-session feature — plan in conversation first.
5. Confirm Notifee on physical device via TestFlight
6. BLE permissions + Phase 2 wiring
7. Pre-submission: re-wire Apple Sign-In

## Implementation Notes

- **Care utils in `src/utils/careUtils.ts`** — `getDaysUntilCare()`, `getLastCareDate()`, `getLastCareDateOrUndefined()`. Used by CareCountdown (re-exports for backward compat), HomeScreen, PlantGridItem, PlantDetailScreen.
- **`Plant` vs `PlantInput`** — `Plant` has required `id`, `connectionType`, `createdAt`, `updatedAt`, `careEvents`, `reminders`. `PlantInput` (used by `addPlant`) omits auto-generated fields. No more `!` non-null assertions needed for `plant.id`.
- **Theme tokens** — `vira.ts` has utility colors (`white`, `black`), overlays (`overlayDark`, `overlayLight`, `overlayBadge`, `whiteTranslucent`), status backgrounds (`overdueBackground`, `urgentBackground`, `overdueBadge`, `urgentBadge`), and care type colors (`waterBlue`, `scheduleWater`, `scheduleFertilize`).
- **MarkDoneButton uses Animated API** — 1s success state with scale pulse, auto-resets. Timer cleaned up via `useRef` + `useEffect`. Disabled during animation to prevent double-taps.
- **pickImage returns `string | null`** — callers just check for null (cancelled/error). Images resized to 1024x1024 max, quality 0.8 (optimized for Vision API token cost and Storage size).
- **PlantDetailScreen hero is a TouchableOpacity** — uses same Alert chooser pattern as AddPlantScreen for consistency. Updates plant via `updatePlant({ photoUrl })`.
- **FlatList `key` prop** — HomeScreen sets `key={viewMode}` to force remount when toggling list/grid (required when changing `numColumns`).
- **TextInput limits** — nickname: 50, location: 100, notes: 500.
- **Supabase client** — singleton in `src/services/supabase.ts`, reads credentials from gitignored `src/config/env.ts`. `.env.example` documents required vars.
- **Auth flow** — `useAuthStore` holds session/user/isLoading. `App.tsx` subscribes to `onAuthStateChange` and gates navigation. Onboarding → Login → Home. Profile auto-created via DB trigger on sign-up.
- **Data sync is optimistic** — Zustand updates immediately, then fires Supabase call. On failure: `removePlant` rolls back, others log warnings. `loadPlants()` called on auth change to hydrate from server.
- **plantService row mappers** — `rowToPlant()` and `rowToCareEvent()` convert snake_case DB rows to camelCase TS types. `Plant.name` maps to `plants.species` column. `CareEvent.occurredAt` is deprecated — DB uses `created_at` only.
- **Photo upload** — `uploadPlantPhoto()` fetches local URI as `arrayBuffer()` (not `blob()` — blob drops content for `file://` URIs in React Native), uploads to `plant-photos/{userId}/{plantId}/{timestamp}.jpg`. Bucket is public-read, upload scoped to user folder via RLS. Old photos deleted on replacement.
- **DB schema** in `supabase/migrations/001_initial_schema.sql` — apply via SQL Editor. Includes `updated_at` trigger, profile auto-creation trigger, RLS on all tables, Storage bucket + policies. `species_cache` table is read-only for clients (service role writes via Edge Functions). Migration 002 adds `analysis_count`/`analysis_reset_at` to profiles and renames species_cache columns.
- **aiService.ts** — `analyzePlant({ imageUrl, context })` calls the Edge Function via `supabase.functions.invoke()` (auto-injects auth header). Returns typed `AnalyzeResult`. Throws `AnalysisError` with `.code` for UI error handling.
- **Edge Function** at `supabase/functions/analyze-plant/index.ts` — Deno runtime, uses Anthropic SDK (`npm:@anthropic-ai/sdk`). Validates response shape before mapping. Retries once on JSON parse failure. Service role client for species_cache writes.
- **notificationService.ts** — direct static import of `@notifee/react-native` (degradation wrapper removed Apr 2026). Three exported functions: `requestPermission()`, `scheduleWateringNotification(plant)`, `cancelWateringNotification(plantId)`. Notification ID format: `watering-{plantId}`.
- **markWatered notification reschedule pattern** — construct `updatedPlant` with `{ ...plant, careEvents: [...plant.careEvents, { type: 'water', createdAt: now }] }` and pass that to `scheduleWateringNotification`. Do NOT read from store state after calling `logCareEvent` — the Supabase sync is async and state may not have flushed yet.
- **AsyncStorage + hasOnboarded** — `setHasOnboarded(true)` writes `AsyncStorage.setItem('hasOnboarded', 'true')`. App.tsx reads it at the top of the first `useEffect` (before `getSession`) and calls `setHasOnboarded(true)` if found. This prevents the onboarding screen from flashing on every relaunch.
- **Notifee native linking fix (RN 0.84 New Arch)** — root cause was `use_frameworks! :linkage => :static` conflicting with RN 0.84's precompiled `.xcframework` binaries, breaking the Interop Layer that Notifee (a legacy bridge module) depends on. Fix: removed unconditional `use_frameworks!` from Podfile. Also added `UNUserNotificationCenterDelegate` extension to `AppDelegate.swift` so Notifee receives foreground events. `pod 'RNNotifee'` is still declared explicitly inside the target block.
- **ViraLeafMark** — `src/components/ViraLeafMark.tsx` uses `Image` from react-native backed by PNG assets in `assets/images/`. Props: `variant` (default `'butterMoon'`) and `size` (default `48`). Use `variant="butterMoon"` on Hemlock backgrounds, `variant="hemlock"` on Butter Moon backgrounds.
- **Metro on physical device (Ninja Sam)** — iOS 26 beta blocks Local Network access for dev builds. Info.plist now has `NSLocalNetworkUsageDescription` + `NSBonjourServices` with `_http._tcp`. Rebuild required to test.
- **Google Sign-In** — `configureGoogleSignIn()` called in App.tsx first useEffect (before auth check). `googleSignIn()` in `src/services/auth.ts` calls `GoogleSignin.signIn()` → gets ID token → passes to `supabase.auth.signInWithIdToken({ provider: 'google', token })`. Returns null if user cancels. `GOOGLE_IOS_CLIENT_ID` read from `src/config/env.ts`. URL scheme (reversed client ID, e.g. `com.googleusercontent.apps.<id>`) must be in Info.plist `CFBundleURLTypes` for OAuth redirect to return to the app.
- **Apple Sign-In (deferred)** — Package `@invertase/react-native-apple-authentication` is still installed but UI was removed Apr 10, 2026 because Apple only enforces third-party sign-in parity at App Store review. Pre-submission: re-add `appleSignIn()` calling `appleAuth.performRequest()` with EMAIL + FULL_NAME scopes, pass identity token to `supabase.auth.signInWithIdToken({ provider: 'apple', token })`. Error code `1001` = user cancelled (suppress in UI).
- **Settings screen** — `getProfile(userId)` in `src/services/auth.ts` fetches `display_name` and `created_at` from `profiles` table. SettingsScreen displays name (OAuth full_name > email prefix), email, member since (formatted via `Intl.DateTimeFormat`). Hemlock background, Butter Moon profile card, Vermillion sign-out CTA.
- **BLE scaffold** — `src/types/ble.ts` defines `ViraPot`, `WateringSchedule`, `BleConnectionState`, `BleError`. `src/services/bleService.ts` exports singleton with placeholder methods (startScan/stopScan log, others throw). `src/store/useBleStore.ts` is a Zustand store with `pots`, `connectionState`, `connectedPotId`. None of these are wired to any screen or imported anywhere in the app yet.
- **Edit Plant pattern** — `PlantDetailScreen` is a single screen with `isEditing` state. Header-right Edit button is wired via `useLayoutEffect` + `navigation.setOptions`. Edit mode swaps the read-only view for TextInputs (nickname in hero, location + pot size chips below), adds a "Re-identify plant" button, and Save/Cancel at the bottom. Photo picks in edit mode store a `pendingPhotoUri` locally — they are only uploaded on Save (or on Re-identify, which needs a Storage URL for the Edge Function). `pendingUploadedUrl` tracks any upload made for re-identify so that (a) Save doesn't re-upload and (b) Cancel can delete the orphaned upload. AI results from Re-identify are stored in `aiOverrides` and merged into the update payload on Save. The watering notification is rescheduled when `waterFrequencyDays` changes (construct `updatedPlant = { ...plant, ...updates }` and call `cancelWateringNotification` then `scheduleWateringNotification`).
- **`updatePlant` store action** — Already accepts `Partial<Plant>` and `plantService.updatePlantRemote` already maps each field conditionally, so partial updates send only changed columns to Supabase. No store changes were needed for Edit Plant.
- **Profile editing** — `updateProfile(userId, {displayName})` in `src/services/auth.ts` writes to `profiles.display_name`. SettingsScreen manages edit state locally (no store caching of profile data) — after save, it just updates the local `displayName` string. Email change is out of scope (requires Supabase Auth email flow).

## AI Integration Pattern

AddPlantScreen calls `analyzePlant()` from `src/services/aiService.ts`, which POSTs to the `analyze-plant` Edge Function with the plant photo's Storage URL. The Edge Function:

1. Extracts user ID from JWT payload (base64 decode — gateway already validated signature)
2. Checks rate limit (10/user/day via `profiles.analysis_count`)
3. Checks `species_cache` if `userSpeciesGuess` provided
4. Calls Claude Vision (`claude-sonnet-4-20250514`) with the photo
5. Validates and maps the response to the client schema
6. Caches the result in `species_cache` (service role write)

Client response shape:
```typescript
{ name: string, health: string, careNotes: string, waterFrequencyDays: number, fertilizeFrequencyDays: number, cacheHit?: boolean, warning?: string }
```

Error codes: `not_a_plant` (422), `rate_limited` (429), `analysis_failed` (422), `vision_unavailable` (502), `unauthorized` (401). All failures allow manual-entry fallback.

Edge Function secrets (set via `supabase secrets set`): `ANTHROPIC_API_KEY`, `SERVICE_ROLE_KEY`.

## Deployment Learnings (Mar 2026)

- **"Verify JWT with legacy secret" must be OFF** — Supabase Edge Function setting in Dashboard → Edge Functions → Settings. Must be disabled for functions receiving user JWTs, otherwise auth will silently fail.
- **Supabase secrets cannot use `SUPABASE_` prefix** — the CLI reserves that namespace. Use `SERVICE_ROLE_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`.
- **React Native `fetch().blob()` drops content for local `file://` URIs** — use `fetch().arrayBuffer()` instead when uploading to Supabase Storage.
- **Use `supabase.functions.invoke()` instead of raw `fetch`** for calling Edge Functions — it auto-injects the auth header and handles the function URL.
- **Decode JWT payload directly in Edge Functions** instead of calling `getUser()` — the Supabase gateway already validates the signature. Base64-decode the middle segment and extract `sub` for the user ID.
- **Metro cache holds stale env values** — run `npx react-native start --reset-cache` after changing `src/config/env.ts`.
- **Metro on physical device blocked by iOS 26 beta** — iOS 26 blocks Local Network access. Use simulator. Fix requires `NSLocalNetworkUsageDescription` + `_http._tcp` Bonjour entry in Info.plist.
- **do NOT add `use_frameworks! :linkage => :static` to Podfile unconditionally** — it conflicts with RN 0.84 precompiled `.xcframework` binaries and silently breaks native module registration via the Interop Layer. Only add if a specific dependency requires it, and test immediately after.
- **Always specify `--simulator` flag** when a physical device is connected, otherwise `run-ios` may target the device unexpectedly.
- **Supabase anon key** is a long JWT starting with `eyJ`, found in Dashboard → Settings → API.
- **Edge Function redeployment required** after changing project config (e.g., rotating keys) — the running function keeps stale env values until redeployed via `supabase functions deploy`.

## Pre-Launch Checklist

1. **Android release build is signed with debug keystore** — must replace with a real signing key before any release build.
2. **`NSLocationWhenInUseUsageDescription` is empty in Info.plist** — Apple will reject the app. Either add a real usage string or remove the key if location isn't needed.
3. **Apple Developer enrollment approved** — Individual account, Team ID `Z3M79BTP5M`. Active Xcode project is at `ios/ViraPlantsTemp.xcodeproj` (the `ios/` root — not the `ios/ViraPlantsTemp/` subdirectory copy).

## Hardware Context (for Phase 2 awareness)

- Pot MCU: Nordic nRF54L05 (BLE peripheral, sleep/wake cycle)
- Hub MCU: ESP32-C6 (WiFi + BLE bridge, optional add-on)
- Communication: BLE GATT — phone connects during pot's 50ms listen window
- Battery: 4×AA, 1–2 year life
- Pot firmware: sleep → advertise → listen → check RTC → valve pulse → sleep
