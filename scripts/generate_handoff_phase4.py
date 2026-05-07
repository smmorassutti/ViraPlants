#!/usr/bin/env python3
"""Generate Vira_Session_Handoff_2026-05-06.docx for the Phase 4 session."""

from docx import Document
from docx.shared import Pt, RGBColor


def add_heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x5B, 0x5F, 0x45)  # hemlock
    return h


def add_para(doc, text, *, bold=False, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(11)
    run.bold = bold
    run.italic = italic
    return p


def add_code(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Menlo"
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0x18, 0x1E, 0x14)


def bullet(doc, text):
    doc.add_paragraph(text, style="List Bullet")


doc = Document()

# Title
title = doc.add_heading("Vira Plants — Session Handoff", level=0)
for run in title.runs:
    run.font.color.rgb = RGBColor(0x5B, 0x5F, 0x45)

add_para(
    doc,
    "Caretaker mode Phase 4 — garden switching, RLS reads, write-gating",
    bold=True,
)
add_para(doc, "Session: 2026-05-06 · Branch: phase-4-caretaker-mode")

# What shipped
add_heading(doc, "What shipped", 1)
bullet(
    doc,
    "Migration 005 — care_events.user_id → author_id rename. FK redirected to public.profiles(id) so PostgREST can embed author:profiles(display_name). RLS recreated with caretaker SELECT/INSERT branches via has_garden_access(plants.user_id). Indexes on author_id and (author_id, created_at DESC) added.",
)
bullet(
    doc,
    "Migration 006 — public.get_my_gardens() SECURITY INVOKER RPC. Returns own + non-expired caretaking gardens with garden_*-prefixed columns. Expired access filtered IN the function.",
)
bullet(
    doc,
    "Garden state — useGardenStore (persist middleware, partialize activeGardenId only under key vira:activeGardenId; silent fallback to ownGardenId when persisted ID is no longer valid). gardenService.listMyGardens() wraps the RPC. Garden + GardenRole types.",
)
bullet(
    doc,
    "usePlantStore.loadPlants(gardenId: string) — explicit garden parameter (Q3). Full state replacement on switch. fetchPlants now uses a single embedded select with author display_name. CareEvent.userId → authorId rename + new authorDisplayName field.",
)
bullet(
    doc,
    "App.tsx — auth-change handler awaits useGardenStore.persist.onFinishHydration() before loadGardens (the rehydration race fix). Separate effect subscribes to activeGardenId and fires loadPlants on change — single source of truth. Sign-out clears both stores.",
)
bullet(
    doc,
    "UI surfaces — HomeScreen tappable header label set via useLayoutEffect. CaretakerBanner (Hemlock + Butter Moon, hidden in own garden). GardenPickerBottomSheet (RN Modal slide+transparent, no new dep, refresh on open). PlantDetailScreen pop-on-switch via initialActiveGardenId ref. HomeScreen pull-to-refresh.",
)
bullet(
    doc,
    "Care event attribution — getInitials shared util. CareEventAvatar 20×20 Luxor circle with Butter Moon initials, rendered only when authorId !== currentUserId.",
)
bullet(
    doc,
    "Write-gating — isOwnGarden selector. HomeScreen FAB hidden + EmptyState button hidden. PlantDetailScreen Edit/Remove/Notes-Add hidden, Notes TextInput unmounted. AddPlantScreen useLayoutEffect goBack + render-time return null guard. Mark Watered/Fertilized stay enabled.",
)
bullet(
    doc,
    "Generic 42501 toast — showErrorToast util + Toast component (220ms fade, 2s visible, Hemlock/Butter Moon, mounted at App root). Fires only on 42501 from add/update/remove plant.",
)
bullet(
    doc,
    "Notification gate — scheduleWateringNotification(plant, currentUserId). Returns early when plant.userId !== currentUserId. Call sites capture currentUserId BEFORE await.",
)
bullet(
    doc,
    "SettingsScreen.handleAcceptInvite now triggers useGardenStore.loadGardens(currentUserId) — replaces the Phase 3 TODO(phase-4). Home picker is the durable confirmation surface; no toast.",
)
bullet(doc, "questions.md Q3 (src/store/ vs src/stores/) added — went with existing singular convention.")

# What Sam needs to do
add_heading(doc, "What Sam needs to do before merging / shipping", 1)
add_para(doc, "1. Review the PR.", bold=True)
add_para(
    doc,
    "Branch: phase-4-caretaker-mode. Four commits, ordered:",
)
bullet(doc, "feat(caretaker): phase 4.0-4.2 — schema migration 005, get_my_gardens RPC, useGardenStore, loadPlants(gardenId)")
bullet(doc, "feat(caretaker): phase 4.3-4.4 — gardenPicker bottom sheet, header dropdown, banner")
bullet(doc, "feat(caretaker): phase 4.5-4.6 — care event avatars, write-gating, notification gate")
bullet(doc, "docs: phase 4 completion (CLAUDE.md + test-results + handoff + debug button removed)")

add_para(doc, "2. Confirm migrations 005 + 006 are recorded.", bold=True)
add_para(
    doc,
    "Both were applied during pause point 1 via Dashboard SQL Editor and verified via probe queries. Local files are checked in at supabase/migrations/005_care_event_author.sql and 006_get_my_gardens.sql.",
)
add_code(
    doc,
    "SELECT column_name FROM information_schema.columns\n"
    "WHERE table_schema='public' AND table_name='care_events'\n"
    "ORDER BY ordinal_position;\n"
    "-- Expect: id, plant_id, author_id, type, source, notes, created_at\n\n"
    "SELECT proname FROM pg_proc WHERE proname = 'get_my_gardens';\n"
    "-- Expect: 1 row",
)

add_para(doc, "3. Merge to main.", bold=True)
add_para(
    doc,
    "I did NOT merge — that's your call. After merge, no further DB action is needed for Phase 4. Phase 5 (caretaker notes) can pick up immediately; the schema (caretaker_notes table) is already in place from migration 003.",
)

# Architecture decisions
add_heading(doc, "Architecture decisions worth remembering", 1)

add_para(doc, "Single embedded PostgREST query, not two queries.", bold=True)
add_para(
    doc,
    "fetchPlants uses .select('*, care_events(*, author:profiles(display_name))') — one round trip per garden switch. Works because migration 005 explicitly added the FK care_events.author_id → profiles.id. PostgREST does NOT infer the relationship through auth.users.",
)

add_para(doc, "Persist activeGardenId only — recompute the rest.", bold=True)
add_para(
    doc,
    "useGardenStore persists ONLY activeGardenId. gardens[] and ownGardenId are recomputed every session from get_my_gardens() + the auth user. This avoids the staleness pitfalls of caching the gardens list. The fallback-to-own logic runs once per loadGardens, not lazily on every read.",
)

add_para(doc, "Rehydration awaiting is required, not optional.", bold=True)
add_para(
    doc,
    "Zustand persist middleware rehydrates asynchronously. App.tsx awaits useGardenStore.persist.onFinishHydration() before loadGardens. Without it, the cold-launch race overwrites the persisted activeGardenId with ownGardenId on every relaunch — persistence appears to work but doesn't. The pause-2 force-quit-relaunch test catches regressions of this bug; keep it in the regression suite.",
)

add_para(doc, "Single source of truth for 'garden switched → reload plants'.", bold=True)
add_para(
    doc,
    "App.tsx subscribes to useGardenStore with a (state, prevState) diff and fires loadPlants(activeGardenId) when activeId changes. HomeScreen has NO useEffect on activeId. Centralizing the subscription avoids the double-fetch race that would happen if both App.tsx and HomeScreen reacted to the same change.",
)

add_para(doc, "Two-layer write-gating, not just one.", bold=True)
add_para(
    doc,
    "Caretakers can't reach write paths because the UI hides the controls (FAB, Edit, Remove, AddPlant unreachable, notes TextInput unmounted). RLS is the backstop — any write that slips through returns 42501 and fires a generic toast. Per-action error copy was rejected: a 42501 from a caretaker means the UI gate has a hole, not that the user's UX needs softening. The toast is bug-detection signal, not UX feature.",
)

add_para(doc, "Mark Watered + Fertilized stay enabled for caretakers.", bold=True)
add_para(
    doc,
    "These are the WHOLE POINT of caretaker mode. The plan deliberately keeps them un-gated. RLS allows the INSERT (migration 005's care_events_insert policy with author_id = auth.uid() AND has_garden_access(plants.user_id)). The owner sees attributed avatars on these events.",
)

add_para(doc, "Notification gate by plant ownership, not by garden.", bold=True)
add_para(
    doc,
    "scheduleWateringNotification compares plant.userId to currentUserId — caretakers don't get reminders for plants they don't live with, even when they're actively viewing the owner's garden. The signature change adds currentUserId as a required second param so call sites are forced to think about it.",
)

# Caveats
add_heading(doc, "Known caveats", 1)
bullet(
    doc,
    "Account-switch on a shared device loses the persisted activeGardenId. vira:activeGardenId is per-device, not per-account. If user A signs out and user B signs in, B's switching activity overwrites A's preference. Acceptable trade-off; documented in Deployment Learnings.",
)
bullet(
    doc,
    "Optimistic care-event writes don't survive a garden switch mid-write. usePlantStore replaces plants[] on switch, so an in-flight optimistic markWatered against the previous garden's plant is lost. The Supabase write still completes; next loadPlants on that garden picks it up. Treated as cosmetic; if it bites, partition plants by gardenId — that's a Phase 5+ refactor.",
)
bullet(
    doc,
    "Caretaker viewing owner's empty garden sees a different EmptyState (no Add button). This is correct, but the copy 'No plants here yet / This gardener hasn\\'t added any plants yet' wasn't reviewed by a copywriter. Adjust if Sam wants something warmer.",
)
bullet(
    doc,
    "Notes section header is generic 'NOTES' for both audiences. The Notes are owner-authored; caretakers see read-only state. The label was 'YOUR NOTES' pre-Phase-4 — kept generic to avoid implying ownership in either direction. Revisit if user testing confirms confusion.",
)

# Checks that passed
add_heading(doc, "Checks that passed in this session", 1)
bullet(doc, "npx tsc --noEmit: 0 errors at every commit boundary")
bullet(doc, "Hardcoded-hex scan on Phase 4 surface: 0 matches")
bullet(doc, "any / @ts-ignore scan on Phase 4 surface: 0 matches")
bullet(doc, "Unselectored Zustand store destructure scan: 0 matches")
bullet(doc, "Migration 005 + 006 applied to project yxidmviucaaztdnkxxvw via Dashboard SQL Editor")
bullet(doc, "Pause-1 RLS smoke tests passed for owner / caretaker2 / unrelated user — first live exercise of has_garden_access for non-owner reads")
bullet(doc, "Pause-2 simulator tap-through (picker, banner, plant-detail pop, force-quit-relaunch rehydration, revoke-mid-session fallback)")
bullet(doc, "Pause-3 simulator tap-through (write-gating, attribution avatars, generic 42501 toast via __DEV__ button, notification gate)")
bullet(doc, "__DEV__ debug button removed from PlantDetailScreen post-pause-3")

# Files touched
add_heading(doc, "Files touched", 1)
add_para(doc, "Added:")
bullet(doc, "supabase/migrations/005_care_event_author.sql")
bullet(doc, "supabase/migrations/006_get_my_gardens.sql")
bullet(doc, "src/types/garden.ts")
bullet(doc, "src/services/gardenService.ts")
bullet(doc, "src/store/useGardenStore.ts")
bullet(doc, "src/components/CaretakerBanner.tsx")
bullet(doc, "src/components/GardenPickerBottomSheet.tsx")
bullet(doc, "src/components/CareEventAvatar.tsx")
bullet(doc, "src/components/Toast.tsx")
bullet(doc, "src/utils/getInitials.ts")
bullet(doc, "src/utils/showErrorToast.ts")
bullet(doc, "test-results/phase-4-test.md")
bullet(doc, "scripts/generate_handoff_phase4.py")
bullet(doc, "Vira_Session_Handoff_2026-05-06.docx")

add_para(doc, "Modified:")
bullet(doc, "App.tsx — rehydration-aware init, activeGardenId subscription, Toast mounted at root, sign-out clears garden store")
bullet(doc, "src/store/usePlantStore.ts — loadPlants(gardenId), authorId/authorDisplayName, 42501 toast hooks, markWatered captures currentUserId before await")
bullet(doc, "src/services/plantService.ts — embedded PostgREST select, CareEventRow.author_id rename, fetchPlants param renamed gardenId")
bullet(doc, "src/services/notificationService.ts — scheduleWateringNotification(plant, currentUserId) signature + early-return on plant.userId mismatch")
bullet(doc, "src/types/plant.ts — CareEvent.userId → authorId, added authorDisplayName: string | null")
bullet(doc, "src/screens/HomeScreen.tsx — header dropdown, banner, picker, RefreshControl, FAB + EmptyState button gated by isOwnGarden")
bullet(doc, "src/screens/PlantDetailScreen.tsx — banner, picker, pop-on-switch, isOwnGarden write-gating across Edit/Remove/Notes, CareEventAvatar in HistoryItem, currentUserId capture for notification gate")
bullet(doc, "src/screens/AddPlantScreen.tsx — useLayoutEffect goBack + render-time return null guard")
bullet(doc, "src/screens/SettingsScreen.tsx — handleAcceptInvite triggers useGardenStore.loadGardens()")
bullet(doc, "CLAUDE.md — Phase 4 Done entry, Caretaker Mode Integration Pattern updated to 0–4 complete, Implementation Notes + Deployment Learnings additions, Next-up rewritten")
bullet(doc, "questions.md — Q3 (src/store/ vs src/stores/) logged")

doc.save("Vira_Session_Handoff_2026-05-06.docx")
print("Wrote Vira_Session_Handoff_2026-05-06.docx")
