# Vira Plants App — Cursor Build Spec

## Product
Vira is a plant companion app that later becomes the control app for Vira self-watering pots.

The app has two phases:
- Phase 1: free standalone plant care app
- Phase 2: same app adds connected-pot control

The architecture must support both from day one.

## Core Principles
The app should feel:
- calm
- premium
- simple
- reliable
- beautiful
- low-maintenance

Brand voice:
“A calm, capable friend helping you care for your plants.”

## Required Stack
Use:
- Bare React Native with TypeScript
- React Navigation
- Zustand
- Supabase
  - Postgres
  - Auth
  - Storage
  - Edge Functions
- AsyncStorage
- Notifee for local notifications
- react-native-ble-plx installed from the beginning

Do not use:
- Expo Go
- direct Anthropic calls from the client
- API keys in the app
- Firebase or another backend unless explicitly requested
- architecture that only works as a prototype

## Product Phases

### Phase 1
Must support:
- onboarding
- plant collection
- list and gallery views
- add plant flow
- photo-based plant identification
- care recommendations
- watering log
- fertilizing log
- reminders
- health checks
- settings
- disabled “Connect to Vira Pot” placeholder

### Phase 2
Must later support:
- BLE discovery
- BLE pairing
- schedule sync
- battery monitoring
- reservoir monitoring
- optional hub integration
- smart-home readiness

## Data Model Rules
Every plant must include:
- id
- userId
- name
- nickname
- location
- orientation
- potSize
- photoUrl
- health
- careNotes
- waterFrequencyDays
- fertilizeFrequencyDays
- connectionType
- viraPotId
- createdAt
- updatedAt

Rules:
- `connectionType` is required from day one
- allowed values:
  - `manual`
  - `vira_pot`
- default to `manual`
- a plant can later be upgraded to `vira_pot`
- Phase 1 plant detail must show a disabled “Connect to Vira Pot” UI
- user default location is collected in onboarding
- per-plant location override is allowed
- watering/fertilizing must be stored as care events

Required entities:
- profiles
- plants
- care_events
- reminders
- species_cache

## AI Rules
- Never call Anthropic directly from the mobile app
- Always use a Supabase Edge Function
- Use Claude for:
  - plant identification
  - health checks
  - care recommendation generation
- Parse structured JSON responses
- Add strong error handling
- Use a species cache to reduce repeated Claude calls

## BLE Rules
- BLE is Phase 2, but architecture must be BLE-ready now
- install `react-native-ble-plx` from the start
- use bare React Native, not Expo Go
- create BLE service scaffolding even if stubbed
- do not design screens or data models that only work for manual plants

## Brand Rules
Typography:
- Montserrat for all app UI text
- Hanno is logo/display only, not general UI

Color palette:
- Hemlock: #5B5F45
- Butter Moon: #FCFEE6
- Luxor: #9A9331
- Thistle: #D0CE94
- Lagoon: #181E14
- Vermillion: #E34234

Visual style:
- earthy
- premium
- quiet
- soft
- design-forward

Copy style:
- warm
- calm
- capable
- never robotic
- never harsh or clinical

Prefer:
- “Let’s meet your plant”
- “Getting to know your plant…”
- “Time to water Monty”

Avoid:
- “Analyze & Save”
- “Processing request”

## UX Rules

### Onboarding
Use a 3-screen onboarding flow:
1. Meet Vira
2. explain permissions
3. add first plant

Rules:
- ask for default location once
- explain camera and notification permissions clearly
- first-run should feel polished and warm

### Plant Detail
Must include:
- hero photo
- species and nickname
- care notes
- watering countdown
- fertilizing countdown
- mark as watered
- mark as fertilized
- reminder controls
- disabled “Connect to Vira Pot” placeholder in Phase 1

## Codebase Structure
Use this structure unless there is a strong reason to improve it:

```text
src/
  screens/
  components/
  services/
  store/
  types/
  theme/
  utils/

supabase/
  migrations/
  functions/

Rules:
- keep business logic out of screens where possible
- keep services modular
- use typed interfaces
- prefer reusable components over giant files
- centralize theme values in src/theme/vira.ts

Engineering Guardrails
Always optimize for:
- production-safe foundation
- clean typing
- modularity
- future hardware support
- smooth Supabase integration
- scoped diffs

Do not:
- rewrite unrelated files
- change the stack without being asked
- add unnecessary libraries
- leave secrets in the client
- generate web React instead of React Native
- build fake backend logic that conflicts with real implementation

Build Order
Implement in this order unless told otherwise:
1. app shell and folder structure
2. theme and design system
3. navigation
4. onboarding
5. types and Zustand store
6. Supabase client
7. schema and migrations
8. plant list and gallery
9. plant detail
10. care logging
11. add plant flow
12. image upload + compression
13. Edge Function for AI
14. species cache integration
15. reminders
16. settings
17. shareable plant cards
18. BLE scaffold
19. BLE pairing later

Instructions for Cursor
When given a task:
1. restate the task briefly
2. list the exact files to create or modify
3. keep changes scoped to that task only
4. implement production-safe code
5. explain terminal commands required
6. flag any manual Supabase/Xcode/native setup
7. avoid changing unrelated architecture

Default behavior:
- work incrementally
- do not build the whole app at once
- prefer maintainable code over demo code