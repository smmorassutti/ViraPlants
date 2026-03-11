---
# Vira Plants App — Build Reference

## What Vira Is
Vira is not just a plant tracker. It is a two-stage product.

Stage 1:
A free plant companion app that helps users identify plants, track care, get reminders, and build habits.

Stage 2:
The same app becomes the controller for Vira self-watering pots.

This is a key strategic decision. The app is meant to build an early user base before hardware ships, then become the upgrade path into the hardware ecosystem.

## Why the Architecture Matters
The architecture cannot be optimized only for a pretty prototype.

It must:
- support scale for a free app
- protect API keys and backend logic
- keep AI costs manageable
- preserve a clean path to BLE-based pot control later

That means the app should be built from day one as:
- bare React Native
- Supabase-backed
- Edge Function mediated for AI
- BLE-ready
- data-modeled for both manual and connected plants

## Phase Model

### Phase 1 — Plant Companion
The user can:
- onboard into the app
- set a default location
- add plants
- upload a photo for plant identification
- receive personalized care guidance
- log watering and fertilizing
- receive reminders
- view a beautiful collection of plants
- run health checks from updated photos

Phase 1 is primarily about:
- retention
- habit-building
- beautiful UX
- building distribution and data before pots ship

### Phase 2 — Connected Pot Control
The user can later:
- pair a Vira pot via BLE
- configure watering schedules
- adjust water amounts
- monitor battery level
- monitor reservoir status
- sync settings to the pot
- optionally use a hub later for remote/cloud access

The exact same app should support both journeys.

## Product Experience Principles
The app should feel:
- simple
- reliable
- beautiful
- low-maintenance

It should especially appeal to:
- design-conscious plant owners
- people who struggle with consistency
- future smart-home users

That means the UX must balance:
- emotional warmth
- elegant visual design
- actual useful functionality
- future automation readiness

## Brand and Tone
The current prototype is useful, but production UI should align more closely with the Vira brand.

### Typography
Use:
- Montserrat for all app UI text

Do not use:
- DM Sans in production UI

Hanno should be reserved for logo/display use only, not the main app interface.

### Colors
The exact palette:
- Hemlock #5B5F45
- Butter Moon #FCFEE6
- Luxor #9A9331
- Thistle #D0CE94
- Lagoon #181E14
- Vermillion #E34234

The interface should lean heavily on Hemlock and Butter Moon, with Luxor and Vermillion used sparingly.

### Voice
The brand voice should feel like:
“A calm, capable friend helping you care for your plants.”

User-facing language should be supportive, grounded, and reassuring.

Examples:
- “Let’s meet your plant”
- “Getting to know your plant…”
- “Time to water Monty”
- “Your plant is ready for a drink”

Avoid language that feels technical, robotic, or generic.

## Technical Direction

### Mobile
Use bare React Native with TypeScript.

Reason:
Phase 2 requires native BLE support, so Expo Go is the wrong long-term foundation.

### State
Use Zustand for lightweight, scalable app state.

### Backend
Use Supabase for:
- Postgres
- Auth
- Storage
- Edge Functions

Reason:
This gives a scalable backend foundation without needing a custom server too early.

### AI
Use Claude via a Supabase Edge Function only.

Reason:
- API keys stay off-device
- responses can be normalized
- usage can be controlled
- caching can happen server-side

### Caching
Use a species cache keyed on plant/environment combinations.

Reason:
A free app cannot afford to make a fresh AI vision call for every common plant setup.

### BLE
Install `react-native-ble-plx` from the beginning.

Reason:
The app must be architected around future pot connectivity from day one, even if the BLE manager is initially just a stub.

## Data Modeling Principles
Every plant record must be future-compatible with connected hardware.

The most important rule:
Include `connectionType` from the beginning.

Allowed values:
- `manual`
- `vira_pot`

This allows a plant to begin as manually cared for, then later be upgraded into a connected pot without redesigning the entire system.

The plant detail UI should reinforce this by showing a disabled “Connect to Vira Pot” card in Phase 1.

Supporting entities should include:
- profiles
- plants
- care_events
- reminders
- species_cache

Care logging should be a first-class part of the system, not just a visual toggle.

## UX Architecture

### Onboarding
The onboarding experience should be warm and polished.

Recommended flow:
1. introduction to Vira
2. permissions context
3. add first plant

It should collect:
- default location
- notification expectations
- confidence to add a first plant immediately

### Home
The home experience should support both:
- list view
- gallery/grid view

Reason:
Some users want utility, while others want a beautiful visual collection.

### Plant Detail
This is a key retention surface.

It should include:
- hero photo
- species name
- nickname
- health state
- care notes
- watering countdown
- fertilizing countdown
- mark as watered
- mark as fertilized
- reminder controls
- future pot connection card

### Add Plant
The add-plant flow should feel welcoming, not technical.

Inputs:
- photo
- nickname
- default or custom location
- light/orientation
- pot size

Then:
- image is compressed
- sent to backend edge function
- species + care plan returned
- result stored cleanly

## Repository Structure
Use a clean, modular folder structure.

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