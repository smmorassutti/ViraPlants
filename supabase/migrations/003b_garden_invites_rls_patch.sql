-- =====================================================================
-- Migration 003b: garden_invites RLS patch
-- =====================================================================
-- Fixes: the original SELECT and DELETE policies on garden_invites
-- subqueried auth.users, which anon/authenticated roles cannot read.
-- Every client read/delete against garden_invites failed with:
--   42501 "permission denied for table users"
--
-- Fix: use auth.jwt() ->> 'email' instead — the JWT claims are already
-- in scope, no table read required.
--
-- NOTE: This file is a backfill. The SQL below was applied directly
-- via the Supabase SQL Editor on Apr 22, 2026, after migration 003
-- surfaced the 42501 bug during Phase 2 testing.
-- =====================================================================

BEGIN;

-- SELECT policy: invitee can view their own unaccepted invites
DROP POLICY "invitee_can_view_own_invites" ON garden_invites;

CREATE POLICY "invitee_can_view_own_invites"
  ON garden_invites FOR SELECT
  USING (
    accepted_at IS NULL
    AND invitee_email = lower(auth.jwt() ->> 'email')
  );

-- DELETE policy: owner can always delete; invitee can decline unaccepted invites
DROP POLICY "owner_or_invitee_can_delete" ON garden_invites;

CREATE POLICY "owner_or_invitee_can_delete"
  ON garden_invites FOR DELETE
  USING (
    auth.uid() = owner_id
    OR (accepted_at IS NULL AND invitee_email = lower(auth.jwt() ->> 'email'))
  );

COMMIT;
