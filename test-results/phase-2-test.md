# Phase 2 — Caretaker Mode — Test Results

**Date:** 2026-04-21
**Branch:** `feature/caretaker-mode-phase-2`
**Scope:** Owner-side invite flow (Edge Function + client service + two screens + settings entry)

---

## 1. `npx tsc --noEmit`

**Command:** `npx tsc --noEmit`
**Result:** ✅ EXIT 0, zero output.

No TypeScript errors across the project, including the new files:

- `supabase/functions/invite-caretaker/index.ts`
- `src/services/caretakerService.ts`
- `src/screens/ManageCaretakersScreen.tsx`
- `src/screens/InviteCaretakerScreen.tsx`
- `src/types/navigation.ts` (updated)
- `src/screens/SettingsScreen.tsx` (updated)
- `App.tsx` (updated)

---

## 2. Hardcoded hex color scan

**Command:** `grep -rn "'#" src/ | grep -v "// " | grep -v theme`
**Result:** ✅ One pre-existing hit in `OnboardingScreen.tsx:561` (`shadowColor: '#000'`), which pre-dates this branch and is outside the Phase 2 scope.

Re-scanning only the new/changed Phase 2 files returns **zero** hex literals:

```bash
grep -n "'#" src/services/caretakerService.ts \
  src/screens/ManageCaretakersScreen.tsx \
  src/screens/InviteCaretakerScreen.tsx
# (no output)
```

All colors in the new code use `viraTheme.colors.*` tokens.

---

## 3. Unselectored Zustand store usage

**Command:** `grep -rn "usePlantStore()" src/`
**Result:** ✅ Zero hits. All store reads continue to use targeted selectors.

(The new Phase 2 screens do not touch `usePlantStore`; they read from `caretakerService` and component-local state.)

---

## 4. No `any` types in new code

**Command:**
```bash
grep -nE "\bany\b" \
  src/services/caretakerService.ts \
  src/screens/ManageCaretakersScreen.tsx \
  src/screens/InviteCaretakerScreen.tsx \
  supabase/functions/invite-caretaker/index.ts
```
**Result:** ✅ Zero matches. Also scanned for `@ts-ignore` / `@ts-expect-error`: zero matches.

The Edge Function defensively parses `unknown` then narrows via `typeof` / shape checks. The service uses explicit row interfaces (`InviteRow`, `CaretakerRow`, `ProfileRow`) and a `CaretakerError` class with a typed `code` field.

---

## 5. iPhone 17 Pro simulator build

**Command:** `npx react-native run-ios --simulator="iPhone 17 Pro"`
**Result:** ✅ `success Successfully built the app` → `info Launching "com.viraplants.app"` → `success Successfully launched the app`.

Screenshot on launch shows the Onboarding screen ("Meet Vira"). The app did not crash on start; bundle `com.viraplants.app` installed to the booted CF73A276-3C3A-4475-9A12-EA8DE08BAC07 simulator.

---

## 6. Edge Function deployment

Deployed `invite-caretaker` via:

```bash
supabase functions deploy invite-caretaker
```

Supabase CLI reported `Deployed Functions on project yxidmviucaaztdnkxxvw: invite-caretaker`. Both the function and the `_shared/sendEmail.ts` helper were uploaded.

Dashboard: https://supabase.com/dashboard/project/yxidmviucaaztdnkxxvw/functions

> Reminder: "Verify JWT with legacy secret" must remain OFF on this function so user JWTs are accepted. `SERVICE_ROLE_KEY` and `RESEND_API_KEY` secrets must remain set.

---

## 7. Manual simulator flow — human-driven verification

The automated agent cannot reliably drive touch interactions through `xcrun simctl`. The interactive flow below is the remaining work for the human reviewer before merge. Build + launch are green, so this list is "exercise, confirm, and record outcomes."

### A. Navigation path
- [ ] Home → tap the ⚙︎ (Settings) icon → Settings screen renders.
- [ ] Settings → tap the new **Caretakers** row ("Invite someone to help care for your plants") → navigates to `ManageCaretakersScreen` (Hemlock background, "People caring for your garden" section, "Pending invites" section).

### B. Empty states
- [ ] With no caretakers and no invites, both sections show the Butter Moon empty-state card with calm brand-voice copy ("No caretakers yet…", "No invites waiting…").

### C. Invite flow — happy path
- [ ] Tap **Invite a caretaker** (Vermillion CTA) → `InviteCaretakerScreen` opens modally.
- [ ] Autofocused email input accepts input; "Send invite" is disabled until a valid email is entered.
- [ ] Enter `sam.morassutti+caretaker@gmail.com` → Send.
- [ ] Alert: "Invitation sent – We sent an invite to sam.morassutti+caretaker@gmail.com." Modal dismisses.
- [ ] Email arrives at the alias inbox within 30 seconds. Subject: "{ownerName} wants you to help care for their plants." Body renders correctly (hero, Butter Moon CTA box with inviteeEmail, 7-day expiry note).
- [ ] Back on `ManageCaretakersScreen`, the pending invite now appears with the invitee's email, "Sent just now", and a **Cancel** link.

### D. Cancel a pending invite
- [ ] Tap **Cancel** on the invite → it disappears from the list. Re-enter the screen to confirm it's gone (RLS DELETE via `owner_or_invitee_can_delete`).

### E. Inline error — self-invite
- [ ] Invite → enter your own signed-in email → Send.
- [ ] Inline red error: "You can't invite yourself." (Maps from Edge Function `self_invite` → local `mapErrorCodeToMessage`.)

### F. Inline error — already invited
- [ ] Send an invite to `foo@example.com`, leave it pending, then try to send again to `foo@example.com`.
- [ ] Inline red error: "You've already invited this person. Check your pending invites." (Maps from `already_invited`.)

### G. Optional expiry
- [ ] Toggle **Set an expiry** on → stepper appears, defaults to 14 days from today.
- [ ] Adjust with +/− buttons; can't go below tomorrow.
- [ ] Send → Edge Function receives `expiresAt` ISO and stores it on `garden_invites.expires_at` (surfaces on caretaker row after Phase 3 acceptance).

### H. Accessibility
- [ ] Enable VoiceOver → all interactive elements (inputs, Send invite, Cancel invite, Remove caretaker, Resend, Caretakers nav row, stepper buttons, expiry switch) announce their `accessibilityLabel`.

### I. Touch targets
- [ ] Visual spot-check: all pressable rows / buttons are ≥ 44×44pt (defined by minHeight + hitSlop or explicit sizing).

---

## Summary

| Check | Result |
|---|---|
| TypeScript | ✅ zero errors |
| Hardcoded hex in new code | ✅ zero |
| `usePlantStore()` unselectored | ✅ zero |
| `any` in new code | ✅ zero |
| `@ts-ignore` in new code | ✅ zero |
| iPhone 17 Pro build + launch | ✅ succeeded |
| Edge Function deploy | ✅ succeeded |
| Interactive flow (A–I) | ⏳ awaiting human reviewer |

Code-level verification is green. Ship-readiness gates on the interactive flow A–I (human reviewer).
