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
│   └── usePlantStore.ts   # Single Zustand store, all app state
├── theme/
│   └── vira.ts            # Brand colors, typography, spacing
├── utils/
│   ├── pickImage.ts       # Camera/library image picker wrapper
│   └── careUtils.ts       # getDaysUntilCare, getLastCareDate helpers
├── types/
│   ├── navigation.ts      # ALL navigation types live here
│   └── plant.ts           # Plant, CareEvent, Reminder, ConnectionType
└── services/              # Backend integrations (being built)
    ├── supabase.ts
    ├── plantApi.ts
    ├── aiAnalysis.ts
    └── notifications.ts
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
- Add Plant flow (3 steps) — Photo (real image picker), Details, Results (with mock AI)
- Zustand store with all actions (add/update/remove plant, log care events, mark watered/fertilized)
- Theme system with full brand palette
- Navigation with typed params
- HomeScreen — list + grid views with toggle, upcoming care tasks section, FAB to add plant, warm empty state
- PlantDetailScreen — hero photo (tap to update), gradient overlay, quick stats, care countdowns + mark done, editable notes, care history log, Vira Pot placeholder, remove plant with confirmation
- Components: PlantCard (list view), PlantGridItem (grid view), CareCountdown (countdown logic with overdue/urgent states, compact mode), MarkDoneButton (success animation, water-blue/green variants, lastDone display), ViraPotPlaceholder (coming soon card with dashed border)
- react-native-image-picker — `src/utils/pickImage.ts` wrapping camera/library with Alert chooser, integrated in AddPlantScreen + PlantDetailScreen hero
- Plant type includes `notes?: string` for user-editable notes (separate from AI-generated `careNotes`)
- Review fixes complete: dead `selectedPlant` removed from store, 12 theme color tokens added (no more hardcoded colors), Zustand selectors targeted across all screens, `Plant` type tightened (core fields required) with `PlantInput` for `addPlant`, care date logic extracted to `src/utils/careUtils.ts`, `maxLength` on all TextInputs, MarkDoneButton setTimeout cleanup

**Next up (in order):**
1. Supabase project + schema + RLS
2. Auth (email + Google + Apple)
3. Photo upload to Supabase Storage
4. Edge Function for Claude AI plant analysis (with species cache)
5. Replace mockAnalyzePlant() with real fetch call
6. Reminders via Notifee
7. AsyncStorage persistence for Zustand
8. Settings screen
9. BLE service scaffold (Phase 2 prep)

## Implementation Notes

- **Care utils in `src/utils/careUtils.ts`** — `getDaysUntilCare()`, `getLastCareDate()`, `getLastCareDateOrUndefined()`. Used by CareCountdown (re-exports for backward compat), HomeScreen, PlantGridItem, PlantDetailScreen.
- **`Plant` vs `PlantInput`** — `Plant` has required `id`, `connectionType`, `createdAt`, `updatedAt`, `careEvents`, `reminders`. `PlantInput` (used by `addPlant`) omits auto-generated fields. No more `!` non-null assertions needed for `plant.id`.
- **Theme tokens** — `vira.ts` has utility colors (`white`, `black`), overlays (`overlayDark`, `overlayLight`, `overlayBadge`, `whiteTranslucent`), status backgrounds (`overdueBackground`, `urgentBackground`, `overdueBadge`, `urgentBadge`), and care type colors (`waterBlue`, `scheduleWater`, `scheduleFertilize`).
- **MarkDoneButton uses Animated API** — 1s success state with scale pulse, auto-resets. Timer cleaned up via `useRef` + `useEffect`. Disabled during animation to prevent double-taps.
- **pickImage returns `string | null`** — callers just check for null (cancelled/error). No compression yet — that happens at upload time (Supabase Storage step).
- **PlantDetailScreen hero is a TouchableOpacity** — uses same Alert chooser pattern as AddPlantScreen for consistency. Updates plant via `updatePlant({ photoUrl })`.
- **FlatList `key` prop** — HomeScreen sets `key={viewMode}` to force remount when toggling list/grid (required when changing `numColumns`).
- **TextInput limits** — nickname: 50, location: 100, notes: 500.

## AI Integration Pattern

AddPlantScreen has a `mockAnalyzePlant()` function returning hardcoded results after a 2s delay. The response shape matches the real Edge Function contract:

```typescript
{ name: string, health: string, careNotes: string, waterFrequencyDays: number, fertilizeFrequencyDays: number }
```

When the Edge Function is ready, swap `mockAnalyzePlant()` for a `fetch()` call — drop-in replacement, no UI changes needed.

## Pre-Launch Checklist

1. **Android release build is signed with debug keystore** — must replace with a real signing key before any release build.
2. **`NSLocationWhenInUseUsageDescription` is empty in Info.plist** — Apple will reject the app. Either add a real usage string or remove the key if location isn't needed.

## Hardware Context (for Phase 2 awareness)

- Pot MCU: Nordic nRF54L05 (BLE peripheral, sleep/wake cycle)
- Hub MCU: ESP32-C6 (WiFi + BLE bridge, optional add-on)
- Communication: BLE GATT — phone connects during pot's 50ms listen window
- Battery: 4×AA, 1–2 year life
- Pot firmware: sleep → advertise → listen → check RTC → valve pulse → sleep
