# Vira Plants Mobile App

Self-watering plant system companion app. 
Phase 1 = free plant companion (distribution play). 
V1 Launch Posture (locked May 5, 2026)

V1 ships within 6 weeks of the May 5 planning call — target submission June 16, launch window June 16–22. Definition of done: complete plant care loop + functional Caretaker Mode Phases 1–5, polished, tested, on the App Store. Tight scope, ruthless prioritization. Anything outside the V1 Scope list below is V1.1 or later.

V1 Scope (in)
- Phase 1–5 Caretaker Mode (Phase 5 = caretaker notes, in progress). Phase 6 = TestFlight build with full caretaker loop on real devices.
- Manual watering schedule override per plant. (Manual fertilizer override TBD — see Open V1 Decisions.)
- Plant ID accuracy: integrate at least one free indoor-plant database to supplement species_cache before falling back to Claude Vision.
- "Your garden awaits" cold-launch flash fix.
- Notification reliability audit + explicit Caretaker Mode notification policy.
- Vira Pot teaser: emoji → ViraLeafMark.
- RN performance pass (New Arch confirmation, re-render audit, list/image perf).
- Header chevron polish (Unicode ▾ → lucide ChevronDown).
- Apple Sign-In re-wire (App Store policy hard requirement).
- Info.plist: remove or fill NSLocationWhenInUseUsageDescription (currently empty — Apple will reject).
- Privacy policy + terms hosted at viraplants.com.
- App Store listing assets (screenshots, description, App Privacy questionnaire).
- Supabase usage audit + documented upgrade triggers (default: stay on free; flip to Pro only if Storage trends past 70% of 1 GB, real backup-needed scenario surfaces, or 1-day log retention blocks a debugging session).

V1 Scope (out — explicitly deferred)
- Phase 2 BLE / Vira Pot integration. BLE scaffold stays as-is, unwired. Revisit ~6 months post-launch.
- Flutter migration. Re-evaluate post-V1 with real-user perf data, not before. (Decision rationale: planning call handoff, May 5.)
- Plant sharing or extended caretaker mode beyond Phases 1–5.
- Owner-side owner_seen_at acceptance signal (parked indefinitely).
- Real-time subscriptions on garden_caretakers.
- Per-action 42501 error copy (generic toast is intentional).
- Push notifications to owner when caretaker logs care.
- Android Play Store release. Codebase still supports Android; we just don't ship it in V1. Real keystore, Notifee Android config, Android Google Sign-In OAuth client, Play Store listing, Android-device testing all deferred to V1.1+.

Open V1 Decisions (resolve in week 1 — May 7–13)
- D1: Caretaker Mode notification policy. Owner only? Caretaker only? Both with different copy?
- D2: Free indoor-plant database choice. License + indoor coverage + watering data quality.
- D3: Manual fertilizer override in same V1 release as watering, or defer to V1.1?
- D4: Supabase free-tier audit. Default: stay on free for V1 (unless Storage approaches 1 GB / backup-needed moment surfaces / log-retention blocks debugging). Pro is operational maturity, not scaling.
- D5: iOS-only V1 (locked, recommended). Android deferred to V1.1+. Confirm no core stakeholder is Android-only for beta testing.

V1 Critical-path workstreams (in rough sequence)
1. Caretaker Mode Phase 5 (notes) — schema already in migration 003; reuse getInitials + CareEventAvatar pattern.
2. Manual watering schedule override per plant.
3. Plant ID accuracy: free-DB integration in analyze-plant Edge Function before Vision fallback.
4. RN perf pass + cold-launch flash fix.
5. Apple Sign-In re-wire.
6. Phase 6 TestFlight build (CFBundleVersion 6) with full caretaker loop verified on two real devices.
7. Pre-submission cleanup (Info.plist, privacy policy, App Store listing).
8. Beta + bug bash + RC build (build 7) — code freeze June 9.
9. Submit June 11–12, target launch June 16–22.

See Vira_V1_Execution_Plan.md (May 7) for the full week-by-week schedule, decision rationales, and risk register.

Phase 2 = Vira pot controller via BLE. Every decision must serve both phases.

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

## Current State (April 23, 2026)

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
- **Caretaker mode Phase 0 + 1 (pre-Apr 21, 2026):** Resend account set up with verified domain `viraplants.com` (SPF/DKIM/MX/DMARC). `RESEND_API_KEY` stored as Supabase Edge Function secret. Shared helper `supabase/functions/_shared/sendEmail.ts` (REST-only, no SDK) calls Resend with from-address `Vira <hello@viraplants.com>`. Schema migration 003 applied remotely: `garden_caretakers`, `garden_invites`, `caretaker_notes` tables + RLS + `has_garden_access(uuid)` SECURITY DEFINER helper. Live RLS behavioral test deferred to Phase 4. Migration SQL lives in Supabase Dashboard, not yet checked into the local `supabase/migrations/` tree.
- **Caretaker mode Phase 2 complete (Apr 21, 2026):** Owner-side invite flow.
  - Edge Function `supabase/functions/invite-caretaker/index.ts` — decodes JWT (gateway validates signature), validates email + optional caretaker expiry, guards against self-invite / already-invited / already-caretaker, generates a base64url token, inserts into `garden_invites` via service role, sends the branded HTML email via `sendEmail` helper, rolls back the invite row if email send fails. Returns `{ success: true, inviteId }` or `{ error: { code, message } }` with codes: `invalid_email`, `already_invited`, `already_caretaker`, `self_invite`, `email_send_failed`, `unauthorized`, `invalid_expiry`, `bad_request`, `internal`.
  - Client service `src/services/caretakerService.ts` — typed wrapper exporting `inviteCaretaker`, `listMyInvites`, `listMyCaretakers`, `cancelInvite`, `revokeCaretaker`, `updateCaretakerExpiry` for Phase 2. Stubs for Phase 3+ (`listGardensImCaretaking`, `listPendingInvitesForMe`, `acceptInvite`, `declineInvite`) throw `CaretakerError('not_implemented', …)`. `CaretakerError` exposes a typed `.code`. Error body parsing uses `FunctionsHttpError.context` (a `Response`) and reads the nested `{ error: { code, message } }` shape the Edge Function returns.
  - Screens — `ManageCaretakersScreen` (Hemlock background; two sections "People caring for your garden" and "Pending invites" with Butter Moon cards, remove/cancel/resend actions, pull-to-refresh, calm empty states, bottom Vermillion "Invite a caretaker" CTA). `InviteCaretakerScreen` (modal presentation; autofocused email input, optional expiry switch with +/− stepper and a tomorrow-minimum guard, Cancel/Send row, inline error messages mapped from Edge Function error codes exactly per the Phase 2 plan).
  - Navigation — added `ManageCaretakers` and `InviteCaretaker` to `RootStackParamList`; both registered in `App.tsx` (the latter with `presentation: 'modal'`).
  - Settings — new **Caretakers** nav row in `SettingsScreen` ("Invite someone to help care for your plants") deep-links to `ManageCaretakers`.
  - Verification — `npx tsc --noEmit` zero errors; hardcoded-hex scan, unselectored-store scan, and `any`/`@ts-ignore` scans all pass on new code; iPhone 17 Pro simulator build + launch succeeded; Edge Function deployed to project `yxidmviucaaztdnkxxvw`. Full test record in `test-results/phase-2-test.md` — interactive tap-through flow A–I is the remaining human reviewer step.
- **Caretaker mode Phase 2 bugfix round 1 (Apr 21, 2026):** three bugs from the first iPhone 17 Pro smoke test resolved:
  - **Bug 1** (`permission denied for table users` on ManageCaretakersScreen): RLS SELECT policy on `garden_invites` subqueries `auth.users`, which fails for all non-service-role callers. Worked around by adding `supabase/functions/caretaker-invites/index.ts` (service-role; action discriminator `list` / `cancel`; re-verifies ownership from JWT `sub` on cancel). `listMyInvites()` and `cancelInvite()` now invoke the Edge Function instead of hitting PostgREST. Logged in `questions.md` Q1.
  - **Bug 2** (`column garden_caretakers.created_at does not exist`): migration 003's `garden_caretakers` uses `invited_at`/`accepted_at`, not `created_at`. Renamed `CaretakerRow.created_at` → `invited_at` in `caretakerService.ts` and updated SELECT columns + ORDER BY + row mapper. Public `GardenCaretaker.createdAt` shape unchanged.
  - **Bug 3** (generic `Something went wrong` on valid invite submit): `invite-caretaker` was deployed without `--no-verify-jwt`, so the Edge Runtime platform rejected the new ES256 user JWTs with `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM` before the handler ran. That platform error body is flat (`{code, message}`), which `extractFunctionError` didn't recognize, so it fell through to `unknown`. Redeployed `invite-caretaker` and `caretaker-invites` with `--no-verify-jwt` and hardened `extractFunctionError` with a third branch. Logged in `questions.md` Q2.
  - All three reverified via curl against deployed Edge Functions (list empty, create, list populated, cancel, cancel-after-delete, self-invite, invalid email, duplicate invite). Interactive tap-through still gated on human sign-in since the agent can't drive the login flow.
- **Caretaker mode Phase 3 complete (Apr 23, 2026):** Caretaker-side invite acceptance.
  - Migration `supabase/migrations/004_accept_invite_rpc.sql` — new Postgres RPC `accept_garden_invite(p_invite_id uuid, p_caretaker_id uuid) RETURNS TABLE(owner_id, owner_display_name, owner_email)`, `SECURITY DEFINER`, `search_path = public, auth`, `EXECUTE` granted only to `service_role`. Loads the invite with `FOR UPDATE` to prevent concurrent-accept races, validates state (not accepted, not past `invite_expires_at`), inserts into `garden_caretakers` (copying `expires_at` from `garden_invites.expires_at`, NOT `invite_expires_at`) and flips `accepted_at` on the invite atomically. The `already_caretaker` branch still resolves the invite so it stops appearing as pending. Owner name lookup joins `auth.users` for email + `profiles` for display_name. **Applied via Supabase Dashboard SQL Editor (same pattern as migrations 003 / 003b).**
  - Edge Function `supabase/functions/accept-invite/index.ts` — decodes JWT (sub + email), validates `inviteId` as UUID, loads invite via service role to check for existence and email-match (case-insensitive against `lower(auth.jwt() 'email')`) before calling the RPC. Maps RPC `RAISE EXCEPTION` messages to error codes: `invite_not_found` (404), `invite_already_accepted` (409), `invite_expired` (410), `already_caretaker` (409), otherwise `internal` (500). Strips `owner_email` from the response — private; only exposed inside the RPC as a display-name fallback. Deployed with `--no-verify-jwt`.
  - Client service `src/services/caretakerService.ts` — three methods added: `listPendingInvitesForMe()` does a direct PostgREST SELECT on `garden_invites` (RLS `invitee_can_view_own_invites` scopes by JWT email) + a second SELECT on `profiles` to resolve owner names, falling back to "A Vira gardener" when display_name is null (caretakers can't read owner emails via PostgREST); `acceptInvite(inviteId)` invokes the `accept-invite` Edge Function and reuses the existing `extractFunctionError` helper; `declineInvite(inviteId)` is a plain PostgREST DELETE (RLS `owner_or_invitee_can_delete` handles scoping). New `AcceptedInvite` type. Phase 3 stubs removed; `listGardensImCaretaking` remains as the only remaining stub.
  - Shared util `src/utils/formatDate.ts` — `formatFullDate`, `formatRelative`, `isInviteExpired` extracted from `ManageCaretakersScreen` unchanged so `PendingInviteCard` reuses the same formatting.
  - Component `src/components/PendingInviteCard.tsx` — Butter Moon card with Vermillion "Accept" + outlined "Decline" buttons (both ≥44×44pt). Expired invites dim to 0.5 opacity and collapse to a single "Dismiss" button that calls decline. Inline Vermillion error message below the buttons on failure, mapped from `CaretakerError.code` via local `mapErrorCodeToMessage`. Keep this in sync with the Phase 3 plan's error table when adding new codes.
  - Screen — `src/screens/SettingsScreen.tsx` now wraps in a ScrollView with `RefreshControl`, renders a new "Pending invitations" section at the very top (above the profile card) when `listPendingInvitesForMe()` returns rows. Section vanishes when the last pending invite is accepted or declined. Refetches on mount and on pull-to-refresh. No real-time subscription.
  - Accept/decline feedback is intentionally silent — no toasts, no alerts. Accept leaves a `TODO(phase-4)` comment: Phase 4's home-header garden list is the durable confirmation surface, so a transient toast would just be a shadow of permanent UI.
  - Verification — `npx tsc --noEmit` zero errors; hardcoded-hex, `any`/`@ts-ignore`, and unselectored-store scans all pass on new files; iPhone 17 Pro simulator build + launch succeeded; `accept-invite` Edge Function deployed to project `yxidmviucaaztdnkxxvw` with `--no-verify-jwt` and confirmed live via agent-run probes (401 unauthorized + 401 could-not-decode-token, both with nested `{error: {code, message}}` shape, proving our handler runs — not the platform ES256 rejection). Full test record and remaining human-executed curl runbook in `test-results/phase-3-test.md`.
- **Caretaker mode Phase 4 complete (May 6, 2026):** Garden switching, RLS reads, and write-gating. The architectural hinge of the feature — first time a non-owner read goes through `has_garden_access(uuid)` and the first time an action by one user lands in another user's care history.
  - Migration `supabase/migrations/005_care_event_author.sql` — pure rename `care_events.user_id → author_id` with the FK redirected to `public.profiles(id)` so PostgREST can embed `author:profiles(display_name)`. Drops + recreates RLS with explicit caretaker SELECT/INSERT branches via `has_garden_access(plants.user_id)`. The "own events" SELECT branch (`author_id = auth.uid() OR …`) intentionally preserves a former caretaker's view of their own historical contributions after access is revoked. Indexes on `author_id` and `(author_id, created_at DESC)` added (none existed pre-migration). Applied via Supabase Dashboard SQL Editor; pre-flight probes captured actual policy/index/FK names so the migration applied cleanly.
  - Migration `supabase/migrations/006_get_my_gardens.sql` — `public.get_my_gardens()` SECURITY INVOKER RPC returning the union of (a) the caller's own garden, (b) non-expired caretaking gardens. Output columns are `garden_*`-prefixed per the Phase 3 42702 lesson. Expired access is filtered IN the function — the client never sees an expired garden. `EXECUTE` granted to `authenticated`.
  - State + services — `src/types/garden.ts` (`Garden`, `GardenRole`); `src/services/gardenService.ts` (thin `listMyGardens()` wrapper around the RPC + `rowToGarden` mapper); `src/store/useGardenStore.ts` (Zustand `persist` middleware, `partialize` to persist only `activeGardenId` under key `vira:activeGardenId`, silent fallback to `ownGardenId` when persisted ID is no longer in the gardens list).
  - `usePlantStore.loadPlants(gardenId: string)` — explicit garden parameter (Q3). Full state replacement on switch (no temp-plant merge across gardens). `fetchPlants` switched to a single embedded select `*, care_events(*, author:profiles(display_name))` — relies on migration 005's FK to make the embed work. `CareEvent` type gained `authorId` (renamed from `userId`) and `authorDisplayName: string | null`. Optimistic temp care events set `authorId` from the auth user.
  - `App.tsx` — auth-change handler awaits `useGardenStore.persist.onFinishHydration()` before calling `loadGardens` (the rehydration race fix; without it the persisted `activeGardenId` would be silently overwritten on every cold launch). A separate `useEffect` subscribes to `useGardenStore` with a `(state, prevState)` diff and fires `loadPlants(activeGardenId)` whenever activeId changes — single source of truth (no HomeScreen useEffect on activeId, avoiding the double-fetch race called out in plan §4.4). Sign-out clears both `usePlantStore.plants` and `useGardenStore.clearOnSignOut()`.
  - UI surfaces — `HomeScreen` header is now a tappable label set via `useLayoutEffect` showing the active garden's owner display name + chevron. `src/components/CaretakerBanner.tsx` (Hemlock bg + Butter Moon copy "Caring for {owner}'s garden", returns null in own garden, tappable). `src/components/GardenPickerBottomSheet.tsx` (RN `Modal` slide+transparent — no new dep per Q5 — backdrop press closes, active row gets a Luxor check, refreshes `loadGardens(userId)` on visible→true per Q4). `PlantDetailScreen` mounts the banner at the top of the ScrollView and pops back when `activeGardenId` diverges from the value captured at mount (`initialActiveGardenId.current`). `HomeScreen` got a `RefreshControl` wired to `loadPlants(activeGardenId)`.
  - Care event attribution — `src/utils/getInitials.ts` shared util ("?" fallback, single-word → first 2, multi-word → first+last initials); `src/components/CareEventAvatar.tsx` 20×20 Luxor circle with Butter Moon Montserrat SemiBold 10pt initials. `PlantDetailScreen` `HistoryItem` renders the avatar only when `event.authorId !== currentUserId` (per D2 the user's own actions stay unmarked).
  - Write-gating (UI layer) — `HomeScreen` FAB hidden when `!isOwnGarden`; EmptyState shows a different copy variant + no CTA for caretakers. `PlantDetailScreen` hides Edit (header-right), hides Remove plant, hides the Notes Add/Edit link, and only mounts the Notes TextInput when both editing and own-garden. Mark Watered + Mark Fertilized stay enabled — caretakers CAN log care, that's the whole point. `AddPlantScreen` pops on mount via `useLayoutEffect` + render-time `return null` guard, no content flash.
  - Generic 42501 toast (RLS backstop UI) — `src/utils/showErrorToast.ts` tiny Zustand store + `showErrorToast(message)`; `src/components/Toast.tsx` 220ms fade-in, 2s visible, Hemlock bg + Butter Moon text, mounted at App root. `usePlantStore` `addPlant`/`updatePlant`/`removePlant` catch blocks check `error.code === '42501'` and fire the generic toast. No per-action copy — the toast is a bug-detection signal.
  - Notification gate — `scheduleWateringNotification(plant, currentUserId)` returns early when `plant.userId !== currentUserId` so caretakers don't get reminders for someone else's plants. `markWatered` / `addPlant` / `handleSaveEdits` all capture `currentUserId` BEFORE any await (the Phase 3 "don't read Zustand state after async" lesson).
  - `SettingsScreen.handleAcceptInvite` now triggers `useGardenStore.loadGardens(currentUserId)` after a successful accept — replaces the Phase 3 `TODO(phase-4)`. The home-header garden picker IS the durable confirmation surface; no toast.
  - Verification — `npx tsc --noEmit` zero errors; hardcoded-hex, `any`/`@ts-ignore`, and unselectored-store scans pass on all new and modified files. Migrations 005 + 006 applied to project `yxidmviucaaztdnkxxvw`. Pause-1 RLS smoke tests (owner / caretaker2 / unrelated user) confirmed `has_garden_access` works for non-owner plant reads — the first live exercise of the helper. Pause-2 simulator tap-through covered the picker, banner, plant-detail pop-on-switch, force-quit-relaunch (rehydration regression test), and revocation fallback. Pause-3 covered write-gating, attribution avatars, generic 42501 toast (via a `__DEV__` debug button that's removed pre-merge), and the notification gate. Full test record in `test-results/phase-4-test.md`.

**Deferred:**
- **Apple Sign-In:** `@invertase/react-native-apple-authentication` package remains installed, but all UI (buttons, handlers) and the `appleSignIn()` function were removed on Apr 10, 2026. Apple requires Sign In with Apple for any app offering third-party sign-in (e.g. Google), so this MUST be re-wired before App Store submission. Pre-submission work: re-add `appleSignIn()` in `src/services/auth.ts`, restore `AppleButton` on LoginScreen + SignUpScreen, enable "Sign In with Apple" capability in Xcode → Signing & Capabilities, enable Apple provider in Supabase Dashboard → Authentication → Providers → Apple, create Apple Services ID + secret key in Apple Developer portal. Do not implement until pre-submission.

**In progress:**
- **Notifee on physical device:** Degradation wrapper removed, direct static import in place, simulator confirmed working. Physical device confirmation still pending Metro fix on Ninja Sam.
- **Metro on Ninja Sam:** Info.plist fix applied (`NSLocalNetworkUsageDescription` + `NSBonjourServices` with `_http._tcp`). Rebuild done. Physical device test still pending — check Settings → Privacy & Security → Local Network for ViraPlantsMobileApp after next launch.
- **Cold-launch empty-state flash:** "Your garden awaits" briefly appears before stores hydrate, even when plants exist. Phase 4 fixed the rehydration *mechanism* (persisted activeGardenId is now correctly restored — see Deployment Learnings "Zustand persist rehydration awaiting"), but HomeScreen still renders before hydration completes, so the empty-state copy flashes briefly before the real state loads. Distinct from the hydration race itself. Fix: gate App.tsx render on `useGardenStore.persist.hasHydrated()` returning true; show a Butter Moon screen during hydration. ~10 lines. Documented in commit 680a16c (May 6, post-Phase-4). Targeted for week 1 of the V1 plan.
**Pending setup (manual steps for Sam):**
1. Apple Sign-In (pre-submission only): Enable Apple provider in Supabase Dashboard → Authentication → Providers → Apple. Add "Sign In with Apple" capability in Xcode → Signing & Capabilities. Create Apple Services ID + secret key in Apple Developer portal. Re-wire UI + `appleSignIn()` in auth.ts.
2. Confirm Metro + Notifee on Ninja Sam physical device after rebuild.

**Next up (in order):**
Next up (in order, V1-aligned):

V1 critical path
1. Resolve D1–D5 (see V1 Launch Posture). Targets week 1.
2. Quick polish PR (single session): Vira logo in Pot teaser, lucide ChevronDown for header, migration 004 idempotency (DROP FUNCTION IF EXISTS), CLAUDE.md housekeeping (stale owner_email line, test-results/phase-3-test.md update, self-invite row cleanup), generate_handoff_phase4.py decision (parameterize → generate_handoff.py or delete).
3. Cold-launch flash fix — gate App.tsx render on useGardenStore.persist.hasHydrated() && !useAuthStore.isLoading. Show splash (Hemlock bg + ViraLeafMark) until both resolve. ~10–20 lines.
4. Notification reliability audit + D1 implementation. Verify Notifee schedules + fires correctly across foreground/background/killed states. Confirm or fix on physical device (Ninja Sam).
5. Caretaker Mode Phase 5 — caretaker notes. New caretakerNotesService.ts (listNotes/addNote/deleteNote), Caretaker Notes section on PlantDetailScreen with avatar + author + relative timestamp and RLS author-only delete. Reuse getInitials util + the avatar pattern from CareEventAvatar. Stress-test the CE plan before kicking off Claude Code (Phase 4 caught 4 critical + 6 high issues this way).
6. Manual watering schedule override (per plant). Surface waterFrequencyDays as directly editable on PlantDetailScreen edit mode. Notification reschedule already wired — verify, don't rebuild. Apply D3 decision re: fertilizer.
7. Plant ID accuracy — integrate the chosen free DB (D2) into analyze-plant Edge Function. Order: species_cache → free DB → Claude Vision → cache result. Calibrate confidence language in UI based on data source.
8. RN performance pass — confirm New Architecture, React DevTools re-render audit, image caching, FlatList review, Hermes config.
9. Apple Sign-In re-wire (Pre-submission only — App Store policy requires it if any third-party OAuth is offered). Re-add appleSignIn() in src/services/auth.ts, restore AppleButton on LoginScreen + SignUpScreen, enable "Sign In with Apple" capability in Xcode → Signing & Capabilities, enable Apple provider in Supabase Dashboard, create Apple Services ID + secret key in Apple Developer portal.
10. Info.plist cleanup — remove or fill NSLocationWhenInUseUsageDescription.
11. Privacy policy + terms hosted at viraplants.com (coordinate with Rory).
12. Caretaker Mode Phase 6 TestFlight — bump CFBundleVersion to 6, clean archive to /tmp/ViraPlantsTemp6.xcarchive, upload, end-to-end test with second Apple ID for full owner ↔ caretaker loop on real devices. Confirm Notifee on physical device.
13. App Store listing — screenshots, description, keywords, support URL, marketing URL, App Privacy questionnaire.
14. Supabase plan upgrade per D4.
15. Beta with 5–10 internal testers. Bug bash. P0/P1 fixes. Code freeze June 9.
16. RC build 7 to TestFlight by June 10. Submit for review June 11–12. Launch June 16–22.

Post-V1 (V1.1 candidates)
- Owner-facing acceptance signal (owner_seen_at) — only if real user request surfaces.
- Manual fertilizer override (if not in V1 per D3).
- Owner-side caretaker-invites Edge Function cleanup — replace listMyInvites / cancelInvite with direct PostgREST calls now that migration 003b patched RLS policies. Delete supabase/functions/caretaker-invites/.
- Push notification to owner when caretaker logs care.
- Real-time subscriptions on garden_caretakers.
- Android V1.1 — replace debug keystore with real signing key.

Phase 2 (~6 months post-launch)
- BLE permissions + Vira Pot wiring. Existing scaffold (src/types/ble.ts, src/services/bleService.ts, src/store/useBleStore.ts) is the starting point.
- Flutter re-evaluation — only if real-user RN perf data justifies a spike. Per planning call rationale (May 5), the perceived sluggishness is more likely fixable in RN than a Flutter rewrite.

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
- **Caretaker invite flow (Phase 2)** — three coordinated surfaces: `invite-caretaker` Edge Function, `caretakerService.ts` client wrapper, and two screens (`ManageCaretakersScreen`, `InviteCaretakerScreen`). The Edge Function always sets `invite_expires_at` to 7 days from now; the client-passed `expiresAt` is stored separately on `garden_invites.expires_at` and carried forward into `garden_caretakers.expires_at` on acceptance (Phase 3). If an expired invite exists for the same `(owner_id, invitee_email)`, the Edge Function deletes it before creating a fresh one — users can retry stale invites without manually cancelling.
- **Caretaker invite email body** (matches the Phase 2 plan exactly) — hardcoded template in `invite-caretaker/index.ts :: buildInviteEmailHtml`. HTML-escapes `ownerName` and `inviteeEmail` before interpolation. Subject: `"{ownerName} wants you to help care for their plants"`. Text fallback is auto-generated by Resend (no manual `text` field).
- **Caretaker error-code → UI copy mapping** lives only in `InviteCaretakerScreen :: mapErrorCodeToMessage`. Keep this in sync with the plan's "Error display mapping" table when adding new codes. `already_invited`, `already_caretaker`, `self_invite`, `invalid_email`, `email_send_failed` each have a dedicated string; anything else falls back to the generic "Something went wrong" message.
- **ManageCaretakersScreen refresh strategy** — loads on mount, on pull-to-refresh, and on `navigation.addListener('focus', …)` so returning from InviteCaretakerScreen picks up the new pending invite without a dedicated callback. No real-time subscription. "Resend" for an expired invite is a client-side cancel + re-invite (two separate calls), which means the Edge Function's duplicate-detection will still see the old row if the cancel fails — acceptable for v1 because cancel via RLS rarely fails.
- **InviteCaretakerScreen expiry stepper** — chose a simple ± stepper over a native `DateTimePicker` to avoid pulling in `@react-native-community/datetimepicker` just for Phase 2. Default is today + 14 days; min is tomorrow 00:00 local. If the human flow finds this awkward, swapping in the community picker is a one-screen, no-Edge-Function change.
- **Caretaker accept flow (Phase 3)** — `accept-invite` Edge Function + `accept_garden_invite` SECURITY DEFINER RPC (migration 004). The RPC does both writes (INSERT `garden_caretakers` + UPDATE `garden_invites.accepted_at`) atomically in a single transaction; doing it as two separate writes from the Edge Function specifically causes the "stale pending invite for a caretaker who already has access" class of bug. The Edge Function pre-checks email match against `invitee_email` (case-insensitive) before calling the RPC so `email_mismatch` can be returned without revealing whether the invite exists. `owner_email` is returned by the RPC (for display-name fallback inside the RPC itself) but stripped from the Edge Function response — private. RPC EXECUTE is granted only to `service_role`; regular clients must go through the Edge Function.
- **Phase 3 PendingInviteCard error mapping** lives only in `PendingInviteCard.tsx :: mapErrorCodeToMessage` and covers `invite_expired`, `invite_already_accepted`, `already_caretaker`, `email_mismatch`, `invite_not_found`, and a generic fallback. Keep in sync with the Phase 3 plan's error table when adding new codes.
- **PendingInvite owner name fallback** — `listPendingInvitesForMe` joins `profiles.display_name` client-side (a second `.in('id', ownerIds)` SELECT). Caretakers cannot read owner emails via PostgREST, so when `display_name` is null the card falls back to "A Vira gardener" via `PendingInviteCard` rather than the email prefix used elsewhere.
- **Shared date helpers** — `formatFullDate`, `formatRelative`, `isInviteExpired` live in `src/utils/formatDate.ts`. `isInviteExpired` accepts any object with `inviteExpiresAt` so both `GardenInvite` (Phase 2) and `PendingInvite` (Phase 3) can feed it. `ManageCaretakersScreen` imports from here now — do NOT duplicate the logic.
- **Garden state shape (Phase 4)** — `useGardenStore` lives at `src/store/useGardenStore.ts` (singular, matching the existing convention; the Phase 4 plan's `src/stores/` was a typo, see `questions.md` Q3). State: `ownGardenId` (signed-in user's UUID), `activeGardenId` (currently selected garden), `gardens[]` (full list from `get_my_gardens`), `isLoading`. `partialize` persists ONLY `activeGardenId`. The store does NOT import `useAuthStore`; `loadGardens(currentUserId: string)` accepts the user ID as a parameter to prevent cross-store circular imports.
- **Zustand `persist` rehydration awaiting (Phase 4)** — `useGardenStore.persist.onFinishHydration(cb)` fires once when AsyncStorage rehydration completes. `App.tsx` awaits it before `loadGardens` on the auth-change init path: `if (!persist.hasHydrated()) { await new Promise(resolve => { const unsub = persist.onFinishHydration(() => { unsub(); resolve(); }); }); }`. **Without this**, the cold-launch race overwrites the persisted `activeGardenId` with `ownGardenId` on every relaunch — persistence appears to work but doesn't. The pattern is reusable for any future persisted store.
- **`loadPlants(gardenId: string)` signature (Phase 4)** — explicit garden ID. Was `loadPlants()` reading `auth.uid()` via RLS pre-Phase-4. Rationale (Q3 in plan v3.0): when scoping bugs surface, you grep for `loadPlants(` and see every call site's garden ID immediately. Cross-store hidden coupling makes those bugs harder to trace.
- **`CareEvent.authorId` (renamed from `userId` in Phase 4 / migration 005)** — the actor (the person who logged the care). Owner OR caretaker. `CareEvent.authorDisplayName: string \| null` carries the embedded `profiles.display_name`. The `userId` field on `CareEventRow` is gone; PostgREST embed shape is `row.author?.display_name`.
- **PostgREST embed for care_events author** — `*, care_events(*, author:profiles(display_name))`. Works because migration 005 explicitly added the FK `care_events.author_id → profiles.id`. PostgREST does NOT infer the relationship through `auth.users` — if the embed comes back without an `author` field, that FK is missing or wrong.
- **`isOwnGarden` selector pattern** — every screen that gates writes computes `useGardenStore(s => s.activeGardenId !== null && s.activeGardenId === s.ownGardenId)` as a derived boolean. Two-layer defense: UI hides controls, RLS rejects anything that slips through with 42501 (which fires the generic `showErrorToast` via `usePlantStore`).
- **`scheduleWateringNotification(plant, currentUserId)` notification gate** — second positional arg added in Phase 4. Returns early when `plant.userId !== currentUserId`. Caretakers don't get reminders for someone else's plants. Call sites MUST capture `currentUserId` BEFORE any await (Phase 3 lesson) — `markWatered`, `addPlant`, `handleSaveEdits` all do this. `cancelWateringNotification` is unchanged.
- **`getInitials` shared util (Phase 4)** — at `src/utils/getInitials.ts`. Returns "?" for null/empty, first two letters for single-word names, first+last initials for multi-word. Used by `CareEventAvatar` and any future avatar surface (Phase 5 caretaker notes will reuse). `ManageCaretakersScreen` retains its own `getInitials(name, fallback)` because it has a different signature (takes a fallback string instead of "?") — leave it alone.
- **`showErrorToast` toast primitive (Phase 4)** — `src/utils/showErrorToast.ts` exposes a tiny Zustand store + `showErrorToast(message)` function. `<Toast />` (`src/components/Toast.tsx`, mounted at App root) animates fade-in/out with a 220ms transition and 2s visible window. Currently fires only for the 42501 caretaker write-block backstop in `usePlantStore`; Phase 5 may extend it for caretaker-note errors. Use `showErrorToast` from imperative call sites; subscribe to `useToastStore` from React if you need fine-grained control of the toast UI elsewhere (you shouldn't).

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

## Caretaker Mode Integration Pattern (Phases 0–4 complete)

- **Schema** (`supabase/migrations/003_caretaker_mode.sql` + `003b_garden_invites_rls_patch.sql` + `004_accept_invite_rpc.sql` + `005_care_event_author.sql` + `006_get_my_gardens.sql`, all applied remotely; 003 + 003b + 004 + 005 + 006 backfilled locally): `garden_caretakers` (owner_id, caretaker_id, expires_at), `garden_invites` (owner_id, invitee_email lowercased, token, invite_expires_at default 7d, expires_at for caretaker access, accepted_at), `caretaker_notes` (plant_id, author_id, body), `care_events.author_id` (renamed from `user_id` in 005, FK redirected to `public.profiles(id)` to enable PostgREST embed). RLS helper `has_garden_access(uuid)` is SECURITY DEFINER. 003b rewrote the `garden_invites` SELECT + DELETE policies to use `auth.jwt() ->> 'email'` instead of subqueries against `auth.users` (see Deployment Learnings). 004 adds `public.accept_garden_invite(uuid, uuid)` — SECURITY DEFINER, EXECUTE granted only to `service_role`, called by the `accept-invite` Edge Function. 005 recreates `care_events` RLS with caretaker SELECT/INSERT branches via `has_garden_access(plants.user_id)`. 006 adds `public.get_my_gardens()` — SECURITY INVOKER, returns own + non-expired caretaking gardens with `garden_*`-prefixed columns; expired access is filtered IN the function so the client never sees it. EXECUTE granted to `authenticated`.
- **Invite Edge Function** at `supabase/functions/invite-caretaker/index.ts` — Deno runtime, decodes JWT (gateway-validated), validates input, uses service role client to insert into `garden_invites` and send a Resend email via the shared `_shared/sendEmail.ts` helper (from-address `Vira <hello@viraplants.com>`). Rolls back the invite row on email failure. Nested error shape `{ error: { code, message } }`.
- **Accept Edge Function** at `supabase/functions/accept-invite/index.ts` — decodes JWT (sub + email), validates `inviteId` as UUID, rejects email mismatch with 403 before touching the RPC, calls `accept_garden_invite` via service role, maps RPC `RAISE EXCEPTION` messages to HTTP error codes (`invite_not_found`, `invite_already_accepted`, `invite_expired`, `already_caretaker`, `internal`). Strips `owner_email` from the response — private. Deploy with `--no-verify-jwt`.
- **Garden state** (`src/store/useGardenStore.ts`, `src/services/gardenService.ts`, `src/types/garden.ts`) — `useGardenStore` holds `ownGardenId`, `activeGardenId`, `gardens[]`, `isLoading`. Persists ONLY `activeGardenId` to AsyncStorage under key `vira:activeGardenId` via `partialize` — `gardens[]` and `ownGardenId` are recomputed every session from `get_my_gardens()` + auth user. `loadGardens(currentUserId)` runs the RPC and validates the persisted ID against the result, falling back silently to `ownGardenId` when the persisted garden is no longer in the list (revoked / expired / different account). `gardenService.listMyGardens()` is the thin wrapper around the RPC; no `GardenError` class — it throws raw on failure, the store catches.
- **Client service** (`src/services/caretakerService.ts`) — one service for all caretaker invite/accept APIs.
  - Owner side: `inviteCaretaker` (Edge Function), `listMyInvites` + `cancelInvite` (Edge Function `caretaker-invites`, historical workaround — see next bullet), `listMyCaretakers` + `revokeCaretaker` + `updateCaretakerExpiry` (direct PostgREST).
  - Caretaker side: `listPendingInvitesForMe` (direct PostgREST SELECT on `garden_invites` + separate SELECT on `profiles` for owner names), `acceptInvite` (Edge Function `accept-invite`), `declineInvite` (direct PostgREST DELETE). Phase 3's `listGardensImCaretaking` stub is now superseded by `gardenService.listMyGardens()` + filtering on `gardenRole === 'caretaker'`; the stub method was deleted in Phase 4.
- **`caretaker-invites` Edge Function is a historical workaround** — exists because of the `auth.users` RLS bug fixed in migration 003b. `listMyInvites()` and `cancelInvite()` still route through it for stability; swapping them back to direct PostgREST is a clean small cleanup PR for post-Phase-6 (logged in the Next up list).
- **Plant loading is garden-scoped (Phase 4).** `usePlantStore.loadPlants(gardenId: string)` accepts the explicit garden ID. Full state replacement on switch (no temp-plant merge across gardens). The `App.tsx` auth-change handler awaits `useGardenStore.persist.onFinishHydration()` before calling `loadGardens` — without this, the persisted `activeGardenId` is silently overwritten on every cold launch (see Deployment Learnings). A separate `useEffect` subscribes to `useGardenStore` with a `(state, prevState)` diff and fires `loadPlants(activeGardenId)` whenever activeId changes — single source of truth for "garden switched → reload plants" (no HomeScreen useEffect on activeId).
- **Care event attribution.** `care_events.author_id` (Phase 4 rename) is the actor — owner OR caretaker. PostgREST embed `*, care_events(*, author:profiles(display_name))` brings the author display_name in via the migration 005 FK to `profiles.id`. `CareEvent.authorId` + `CareEvent.authorDisplayName: string \| null` carry it client-side. `PlantDetailScreen` renders a `CareEventAvatar` (20×20 Luxor circle, Butter Moon initials) only when `authorId !== currentUserId` — the user's own actions stay unmarked (D2). `getInitials` shared util at `src/utils/getInitials.ts`.
- **Write-gating is two layers.** UI: `isOwnGarden = activeGardenId !== null && activeGardenId === ownGardenId`. HomeScreen FAB hidden, EmptyState button hidden; PlantDetailScreen header Edit hidden, Remove plant hidden, Notes Add/Edit hidden, Notes TextInput unmounted (only mounts when `isEditingNotes && isOwnGarden`); AddPlantScreen guards on mount with `useLayoutEffect` `goBack()` plus a render-time `if (!isOwnGarden) return null` — no content flash. Mark Watered + Mark Fertilized stay enabled (caretakers SHOULD be able to log care). RLS backstop: any caretaker write that reaches Postgres returns 42501; `usePlantStore` `addPlant`/`updatePlant`/`removePlant` catch blocks call `showErrorToast(FORBIDDEN_TOAST)` for that code only. Toast is bug-detection signal, not user-facing UX.
- **Notification gate.** `scheduleWateringNotification(plant, currentUserId)` returns early when `plant.userId !== currentUserId` — caretakers don't get reminders for someone else's plants. Call sites (`markWatered`, `addPlant`, `handleSaveEdits`) capture `currentUserId` BEFORE any await (Phase 3 lesson). `cancelWateringNotification` is unchanged (idempotent, cheap).
- **UI surfaces** — `HomeScreen` header is a tappable label set via `useLayoutEffect` showing the active garden's owner display name + chevron (▾). `CaretakerBanner` (Hemlock bg, Butter Moon copy "Caring for {owner}'s garden", null in own garden) sits directly under the header on HomeScreen and at the top of the ScrollView on PlantDetailScreen. `GardenPickerBottomSheet` is RN `Modal` slide+transparent (no new dep per Q5), backdrop press closes, active row gets a Luxor check, refreshes `loadGardens(userId)` on visible→true (Q4). `PlantDetailScreen` pops back when `activeGardenId` diverges from `initialActiveGardenId.current`. `SettingsScreen` carries the Phase 3 "Pending invitations" section at the top; `handleAcceptInvite` now triggers `useGardenStore.loadGardens(currentUserId)` after success — the home-header garden list is the durable confirmation surface, no toast.
- **Phase 4 specifically does NOT add** the owner-facing `owner_seen_at` acceptance signal (parked indefinitely — `ManageCaretakersScreen` already shows accepted caretakers), real-time subscriptions on `garden_caretakers`, deep linking into a specific caretaking garden, owner-side expiry-greying UI, push notification to owner when caretaker logs care, or any per-action 42501 error copy.

Edge Function secrets in play for caretaker mode: `RESEND_API_KEY`, `SERVICE_ROLE_KEY`.

V1 Plant ID Accuracy Pattern (planned, not yet implemented)

The current analyze-plant Edge Function flow is: species_cache lookup (if userSpeciesGuess given) → Claude Vision call → cache result. The V1 accuracy improvement adds one layer between cache and Vision: a free indoor-plant database query.

Planned flow (post-D2 resolution):
1. Cache hit on species_cache → return cached.
2. Cache miss → query the chosen free DB (one of: USDA Plants, GBIF, OpenFarm, iNaturalist, etc.).
3. Free DB hit with sufficient confidence → use it; cache the result.
4. Free DB miss or low confidence → call Claude Vision (existing flow); cache the result.

Constraints:
- License must permit redistribution (we're caching the result and serving it to users).
- Indoor / houseplant coverage is the priority — most general plant DBs are weak here.
- The DB query is server-side in the Edge Function, NOT a new client dependency.
- Watering frequency specifically must be present or derivable — many DBs have light/temp but not water days, which is what we actually need.
- Latency budget per Vision call is currently ~3–6 seconds; the free DB query should be sub-second so it doesn't degrade the perceived performance of the AI flow.

UI implication: confidence language in AddPlantScreen / Re-identify results may differ when the source is free DB vs Vision. Calm-and-capable voice stays the same; avoid false certainty when the data is uncertain. Don't expose the source type explicitly to the user.

Decision (D2) tracked in Vira_V1_Execution_Plan.md week-1 deliverables.

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
- **Resend as the transactional email provider (Apr 2026)** — chose REST (raw fetch) over the Resend SDK in `_shared/sendEmail.ts` to keep Deno deps lean and avoid local/deploy version drift. API key stored as `RESEND_API_KEY` Edge Function secret. Domain `viraplants.com` verified via SPF/DKIM/MX/DMARC; from-address `Vira <hello@viraplants.com>` is hardcoded in the helper.
- **`FunctionsHttpError.context` is a Response, not the parsed body** (supabase-js 2.99) — to read the Edge Function's error body on the client, call `.json()` on `error.context` (see `caretakerService.ts :: extractFunctionError`). The earlier `aiService.ts` read `error.context` as a plain object, which silently falls through to the generic fallback message; prefer the caretakerService pattern for new code.
- **Edge Function error shape convention** — new Edge Functions (starting with `invite-caretaker`) return the nested `{ error: { code, message } }` shape specified in the CE plan. Legacy `analyze-plant` returns the flat `{ error: 'code', message: '…' }` shape. The caretaker client handles both, plus the Supabase platform's flat `{ code, message }` shape (see next entry) — three branches in `extractFunctionError`.
- **Always deploy Edge Functions with `--no-verify-jwt` in this project (Apr 2026)** — Supabase now issues ES256-signed user JWTs, but the Edge Runtime platform's default JWT verifier still only accepts HS256. A function deployed without the flag returns HTTP 401 with body `{"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm ES256"}` for every authenticated call, BEFORE your handler can run. `analyze-plant`, `invite-caretaker`, `caretaker-invites`, and `accept-invite` are all deployed with this flag; each function decodes the JWT payload manually (base64-decode `sub`) and trusts the API gateway's upstream signature verification. See `questions.md` Q2. Without this flag, `supabase.functions.invoke(...)` from the mobile app will fall through to a generic "Something went wrong" error because the platform-generated error body doesn't match the app's Edge Function error shape.
- **SECURITY DEFINER RPC for multi-row-write transactions (Apr 23, 2026)** — `public.accept_garden_invite(uuid, uuid)` from migration 004 is the first Postgres RPC in this project. Pattern: use a SECURITY DEFINER function when an Edge Function needs to do 2+ writes atomically AND needs to read from a privileged table (`auth.users` in this case, for email lookup). Two separate writes from the Edge Function would leave a stale pending invite if the second write fails — specifically the class of bug Phase 3 was shaped to avoid. `search_path` must be set explicitly (`public, auth` here) and `EXECUTE` revoked from `PUBLIC` and granted only to `service_role`. Error signalling via `RAISE EXCEPTION '<code>'` with the Edge Function doing case-insensitive `.includes()` string-matching on `rpcError.message` is good enough; the strings come from our own code so no SQLSTATE discipline needed.
- **RLS on `garden_invites` and `auth.users` (Apr 22, 2026)** — migration 003 originally shipped with SELECT + DELETE policies on `garden_invites` that subqueried `auth.users`, which `anon` and `authenticated` can't read. This made direct PostgREST queries fail with `42501 permission denied for table users`. **Fixed in production on Apr 22** by rewriting both policies to use `auth.jwt() ->> 'email'` instead — no schema migration needed, just `DROP POLICY` + `CREATE POLICY` in SQL Editor. Direct client SELECT/DELETE on `garden_invites` now works correctly. The `caretaker-invites` Edge Function (created as a service-role workaround during bugfix round 1) still exists and works, but is no longer strictly needed; a future cleanup pass can replace `listMyInvites()` and `cancelInvite()` with direct PostgREST calls and delete the Edge Function. Phase 3 (invite acceptance) can safely query `garden_invites` directly from the client where appropriate. Questions.md Q1 marked resolved.
- **Zustand `persist` rehydration awaiting (May 6, 2026 — Phase 4)** — `persist` middleware rehydrates asynchronously from AsyncStorage. The store is created with default state and the persisted value is read in the background. If init code (e.g. `App.tsx` auth-change handler) calls `loadGardens()` before rehydration completes, it reads the default value, computes a fallback, and writes back — silently overwriting the persisted preference on every cold launch. **Persistence appears to work but doesn't.** Fix: await `useGardenStore.persist.onFinishHydration()` (or check `hasHydrated()` first) before any code path that reads or writes the persisted slice on init. The pattern is generic — any future persisted Zustand store should use the same idiom. See `App.tsx` Phase 4 init effect for the canonical implementation. Pause-2 force-quit-relaunch test catches regressions of this bug.
- **PostgREST embedded resource requires explicit FK (May 6, 2026 — Phase 4)** — the embed `*, care_events(*, author:profiles(display_name))` only works because migration 005 explicitly added the FK `care_events.author_id → public.profiles(id)`. PostgREST does NOT infer relationships through `auth.users`; the original `care_events.user_id_fkey → profiles(id)` happened to be correct but the Phase 3 / pre-Phase-4 schema didn't guarantee it (the v3.0 plan worried about an `auth.users` target). Lesson: when using PostgREST embed, the FK must directly reference the table you're embedding from. If the embed comes back without the joined object, re-check `pg_constraint` for the actual target. This is also why migration 005 explicitly drops + recreates the FK rather than relying on the rename to preserve it.
- **First live RLS exercise of `has_garden_access(uuid)` (May 6, 2026 — Phase 4)** — the helper has been in place since Phase 0 / migration 003 but until Phase 4 was only ever called by the owner himself, which is trivially true. Phase 4 pause-1 RLS smoke tests are the first time it's been called by a non-owner read on `plants` and `care_events`. Pre-Phase-4 invariant: "any caretaker_id with `accepted_at` and non-expired `expires_at` can read the owner's plants" was a *theoretical* property of the schema, not an empirically verified one. Now it is. If you ever change the helper or migrate the underlying tables, re-run the pause-1 SQL probes (owner / caretaker / unrelated) before assuming RLS still works.
- **Account-switch loses persisted activeGardenId (May 6, 2026 — Phase 4 known limitation)** — `vira:activeGardenId` is per-device, not per-account. If user A signs out, user B signs in, B switches to a caretaking garden, B signs out, A signs in — A's previously-active garden preference has been overwritten by B's. Acceptable trade-off; the alternative (per-account namespacing of AsyncStorage keys) adds machinery for an edge case that doesn't match how the product is used (one user per phone, almost always). Documented here so it doesn't get logged as a future bug report.
- **Generic 42501 toast over per-action copy (May 6, 2026 — Phase 4)** — caretaker write-block backstop fires `showErrorToast('Something went wrong. Please try again.')` and that's it. Per-action copy was considered and rejected: per-action copy implies the failure is part of the UX, but a 42501 from a caretaker is actually a bug — the UI gate had a hole. The generic toast is a bug-detection signal. If a real user ever sees it in production, that's a UI gating regression to investigate, not a UX deficiency to soften.

## Pre-Launch Checklist

Pre-Launch Checklist
- Apple Sign-In re-wired and tested end-to-end. Required by App Store policy when any third-party OAuth is offered. Status: deferred from Apr 10, 2026; package still installed.
- NSLocationWhenInUseUsageDescription is currently empty in Info.plist — Apple will reject the app. Either remove the key (default — location not used) or add a real usage string.
- Android release build is signed with debug keystore. Decision (D5, locked): iOS-only V1; Android deferred to V1.1+. Codebase still supports Android — we just don't ship to Play Store. Real keystore, Notifee Android config, Android Google Sign-In OAuth client, Play Store listing, and Android-device testing all become V1.1+ work.
- Apple Developer enrollment approved — Individual account, Team ID Z3M79BTP5M. Active Xcode project is at ios/ViraPlantsTemp.xcodeproj (the ios/ root — not the ios/ViraPlantsTemp/ subdirectory copy).
- Privacy policy hosted at viraplants.com/privacy (Rory owns the domain — coordinate).
- Terms of service hosted at viraplants.com/terms.
- Supabase plan decision (D4): default stay on free for V1. Document current usage numbers (DB size, Storage, bandwidth, function invocations, MAU) and the upgrade triggers (Storage > 70% of 1 GB / first backup-needed moment / first log-retention block / first paid users) here when the audit completes. Pre-launch mitigations on free: manual pg_dump before each migration; weekly Storage bucket inventory export.
- App Store listing complete: screenshots (6.5" iPhone primary), description, keywords, support URL, marketing URL, App Privacy questionnaire (photos, email, name, plant data, no tracking IDs).
- Phase 6 TestFlight build verified end-to-end on at least 2 real devices with 2 Apple IDs.
- Notifee verified on physical device (Ninja Sam) — long-pending item.
- All P0 / P1 bugs from beta closed.
- Code freeze: June 9 EOD. RC build 7 uploaded by June 10.

## Hardware Context (for Phase 2 awareness)

- Pot MCU: Nordic nRF54L05 (BLE peripheral, sleep/wake cycle)
- Hub MCU: ESP32-C6 (WiFi + BLE bridge, optional add-on)
- Communication: BLE GATT — phone connects during pot's 50ms listen window
- Battery: 4×AA, 1–2 year life
- Pot firmware: sleep → advertise → listen → check RTC → valve pulse → sleep
