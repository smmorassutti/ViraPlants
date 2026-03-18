# Vira Plants Mobile App

Self-watering plant system companion app. Phase 1 = free plant companion (distribution play). Phase 2 = Vira pot controller via BLE. Every decision must serve both phases.

## Tech Stack

- **React Native 0.84** — bare workflow, NOT Expo (BLE requires native modules)
- **TypeScript** — strict mode
- **Zustand** — state management (lightweight, excellent TS support)
- **Supabase** — backend (Postgres, Auth, Storage, Edge Functions)
- **react-native-image-picker** — camera + photo library access (1200x1200, quality 0.8)
- **react-native-ble-plx** — installed, not configured yet (Phase 2)
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
│   └── useAuthStore.ts    # Auth session state (session, user, isLoading)
├── theme/
│   └── vira.ts            # Brand colors, typography, spacing
├── utils/
│   ├── pickImage.ts       # Camera/library image picker wrapper
│   └── careUtils.ts       # getDaysUntilCare, getLastCareDate helpers
├── types/
│   ├── navigation.ts      # ALL navigation types live here
│   └── plant.ts           # Plant, PlantInput, CareEvent, Reminder, Profile
├── config/
│   └── env.ts             # Supabase URL + anon key (gitignored)
└── services/
    ├── supabase.ts        # Singleton Supabase client
    ├── auth.ts            # signUp, signIn, signOut, onAuthStateChange
    ├── plantService.ts    # Plant CRUD + care events (row ↔ type mappers)
    ├── photoService.ts    # Upload/delete plant photos to Supabase Storage
    └── notifications.ts   # (placeholder — Notifee integration)
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

## Current State (March 2026)

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

**Next up (in order):**
1. Reminders via Notifee
4. AsyncStorage offline cache for Zustand
5. Apple Sign-In + Google Sign-In
6. Settings screen enhancements
7. BLE service scaffold (Phase 2 prep)

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
- **Photo upload** — `uploadPlantPhoto()` fetches local URI as blob, uploads to `plant-photos/{userId}/{plantId}/{timestamp}.jpg`. Bucket is public-read, upload scoped to user folder via RLS. Old photos deleted on replacement.
- **DB schema** in `supabase/migrations/001_initial_schema.sql` — apply via SQL Editor. Includes `updated_at` trigger, profile auto-creation trigger, RLS on all tables, Storage bucket + policies. `species_cache` table is read-only for clients (service role writes via Edge Functions). Migration 002 adds `analysis_count`/`analysis_reset_at` to profiles and renames species_cache columns.
- **aiService.ts** — `analyzePlant({ imageUrl, context })` calls the Edge Function with session JWT. Returns typed `AnalyzeResult`. Throws `AnalysisError` with `.code` for UI error handling.
- **Edge Function** at `supabase/functions/analyze-plant/index.ts` — Deno runtime, uses Anthropic SDK (`npm:@anthropic-ai/sdk`). Validates response shape before mapping. Retries once on JSON parse failure. Service role client for species_cache writes.

## AI Integration Pattern

AddPlantScreen calls `analyzePlant()` from `src/services/aiService.ts`, which POSTs to the `analyze-plant` Edge Function with the plant photo's Storage URL. The Edge Function:

1. Validates JWT auth
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

Edge Function secrets (set via `supabase secrets set`): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Pre-Launch Checklist

1. **Android release build is signed with debug keystore** — must replace with a real signing key before any release build.
2. **`NSLocationWhenInUseUsageDescription` is empty in Info.plist** — Apple will reject the app. Either add a real usage string or remove the key if location isn't needed.

## Hardware Context (for Phase 2 awareness)

- Pot MCU: Nordic nRF54L05 (BLE peripheral, sleep/wake cycle)
- Hub MCU: ESP32-C6 (WiFi + BLE bridge, optional add-on)
- Communication: BLE GATT — phone connects during pot's 50ms listen window
- Battery: 4×AA, 1–2 year life
- Pot firmware: sleep → advertise → listen → check RTC → valve pulse → sleep
