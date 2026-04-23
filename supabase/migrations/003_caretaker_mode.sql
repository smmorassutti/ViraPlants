-- =====================================================================
-- Migration 003: Caretaker Mode
-- =====================================================================
-- Adds garden sharing: owners can invite caretakers who gain scoped
-- access to view plants, mark care events, and leave notes.
--
-- NOTE: This file is a backfill. The SQL below was applied directly
-- via the Supabase SQL Editor on Apr 22, 2026, and committed to the
-- repo retroactively. See also 003b_garden_invites_rls_patch.sql
-- for the RLS fix applied later the same day.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------

-- Junction: who has access to whose garden
CREATE TABLE garden_caretakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caretaker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, caretaker_id),
  -- Prevent self-caretaking
  CONSTRAINT no_self_caretaker CHECK (owner_id <> caretaker_id)
);

CREATE INDEX idx_garden_caretakers_caretaker ON garden_caretakers(caretaker_id);
CREATE INDEX idx_garden_caretakers_owner ON garden_caretakers(owner_id);

-- Pending invites (before acceptance)
CREATE TABLE garden_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL CHECK (invitee_email = lower(invitee_email)),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,  -- access expiry, carried to garden_caretakers on accept
  invite_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_garden_invites_email ON garden_invites(invitee_email)
  WHERE accepted_at IS NULL;
CREATE INDEX idx_garden_invites_token ON garden_invites(token)
  WHERE accepted_at IS NULL;

-- Caretaker notes (separate from plants.notes which is owner-only)
CREATE TABLE caretaker_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caretaker_notes_plant ON caretaker_notes(plant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 2. Helper function: has_garden_access
-- ---------------------------------------------------------------------
-- Returns true if the calling user is the garden owner OR an active
-- (non-expired) caretaker of that garden.
--
-- SECURITY DEFINER: runs with function owner's privileges, bypassing
-- RLS on garden_caretakers when called from other RLS policies.
-- Without this, we'd get infinite recursion.
--
-- STABLE: Postgres can cache results within a single query.

CREATE OR REPLACE FUNCTION has_garden_access(garden_owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN garden_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM garden_caretakers
      WHERE owner_id = garden_owner_id
        AND caretaker_id = auth.uid()
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 3. RLS on new tables
-- ---------------------------------------------------------------------

-- garden_caretakers
ALTER TABLE garden_caretakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_or_caretaker_can_view"
  ON garden_caretakers FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = caretaker_id);

CREATE POLICY "owner_can_insert"
  ON garden_caretakers FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_can_update"
  ON garden_caretakers FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "owner_or_caretaker_can_delete"
  ON garden_caretakers FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = caretaker_id);

-- garden_invites
ALTER TABLE garden_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_can_view_own_invites"
  ON garden_invites FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "invitee_can_view_own_invites"
  ON garden_invites FOR SELECT
  USING (
    accepted_at IS NULL
    AND invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "owner_can_create_invites"
  ON garden_invites FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_or_invitee_can_delete"
  ON garden_invites FOR DELETE
  USING (
    auth.uid() = owner_id
    OR (accepted_at IS NULL
        AND invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Note: invite acceptance happens in an Edge Function using service role,
-- so no INSERT/UPDATE policy for invitees is needed.

-- caretaker_notes
ALTER TABLE caretaker_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "garden_members_can_view_notes"
  ON caretaker_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = caretaker_notes.plant_id
        AND has_garden_access(plants.user_id)
    )
  );

CREATE POLICY "garden_members_can_create_notes"
  ON caretaker_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = caretaker_notes.plant_id
        AND has_garden_access(plants.user_id)
    )
  );

CREATE POLICY "author_can_delete_own_notes"
  ON caretaker_notes FOR DELETE
  USING (auth.uid() = author_id);

-- ---------------------------------------------------------------------
-- 4. Update RLS on existing tables to allow caretaker access
-- ---------------------------------------------------------------------

-- plants: caretakers can SELECT, but only owners can INSERT/UPDATE/DELETE

DROP POLICY "Users can read own plants" ON plants;

CREATE POLICY "garden_members_can_view_plants"
  ON plants FOR SELECT
  USING (has_garden_access(user_id));

-- INSERT/UPDATE/DELETE policies on plants are unchanged — owner only.
-- (auth.uid() = user_id already covers this case.)

-- care_events: caretakers can INSERT their own events for plants in
-- gardens they have access to, and can SELECT all events on those plants.

DROP POLICY "Users can read own care events" ON care_events;

CREATE POLICY "garden_members_can_view_care_events"
  ON care_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = care_events.plant_id
        AND has_garden_access(plants.user_id)
    )
  );

DROP POLICY "Users can insert own care events" ON care_events;

-- CRITICAL: both conditions required.
-- 1. user_id = auth.uid() — can't forge attribution
-- 2. plant in accessible garden — can't insert for plants you don't have access to
CREATE POLICY "garden_members_can_create_care_events"
  ON care_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = care_events.plant_id
        AND has_garden_access(plants.user_id)
    )
  );

-- UPDATE and DELETE policies on care_events unchanged — stay owner-of-event-only.
-- (A caretaker can create watering events but cannot edit/delete events they
-- didn't create. Owner can edit/delete their own events, not caretakers' events.)

-- profiles: merge "own profile" with "garden-member profile" into one SELECT policy

DROP POLICY "Users can read own profile" ON profiles;

CREATE POLICY "own_or_garden_member_profile_readable"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM garden_caretakers
      WHERE (owner_id = profiles.id AND caretaker_id = auth.uid())
         OR (caretaker_id = profiles.id AND owner_id = auth.uid())
    )
  );

-- UPDATE policy on profiles unchanged — still own-profile-only.

COMMIT;
