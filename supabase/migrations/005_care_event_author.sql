-- Migration 005 — rename care_events.user_id → author_id
-- Rationale: care_events.user_id has always been the actor (the person who
-- logged the care). Before Phase 4, that actor was always the plant's owner,
-- so the column was redundant with plants.user_id via plant_id. Phase 4 lets
-- caretakers log care, so the column now genuinely needs to mean "actor" —
-- which is what author_id means everywhere else in the schema (compare
-- caretaker_notes.author_id). This is a pure rename: no data movement,
-- no backfill — every existing row's user_id IS the correct author.
--
-- Pre-flight findings (Apr 24 confirmed against project yxidmviucaaztdnkxxvw):
--   policies on care_events:
--     "Users can delete own care events" (DELETE) — auth.uid() = user_id
--     "Users can update own care events" (UPDATE) — auth.uid() = user_id
--     "garden_members_can_create_care_events" (INSERT) — already gated by has_garden_access
--     "garden_members_can_view_care_events" (SELECT) — already gated by has_garden_access
--   FK on user_id: care_events_user_id_fkey → public.profiles(id) ON DELETE CASCADE
--   Indexes on care_events: only care_events_pkey (no user_id indexes to drop)
--
-- This migration is applied via Supabase Dashboard SQL Editor, same pattern
-- as 003 / 003b / 004. Each statement is independent; if a statement fails
-- partway through, the DB is left partially-migrated. Pre-flight steps above
-- are designed to prevent that.

-- Step 1: drop existing RLS policies that reference user_id
DROP POLICY IF EXISTS "Users can delete own care events" ON public.care_events;
DROP POLICY IF EXISTS "Users can update own care events" ON public.care_events;
DROP POLICY IF EXISTS garden_members_can_create_care_events ON public.care_events;
DROP POLICY IF EXISTS garden_members_can_view_care_events ON public.care_events;

-- Step 2: drop existing FK on user_id (recreate post-rename with new name)
ALTER TABLE public.care_events
  DROP CONSTRAINT IF EXISTS care_events_user_id_fkey;

-- Step 3: rename the column
ALTER TABLE public.care_events RENAME COLUMN user_id TO author_id;

-- Step 4: add FK on the renamed column → profiles.id
-- profiles.id is itself FK'd to auth.users(id) with ON DELETE CASCADE,
-- so deleting an auth user still cascades correctly.
-- Naming the FK explicitly makes PostgREST embed disambiguation cleaner.
ALTER TABLE public.care_events
  ADD CONSTRAINT care_events_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Step 5: add helpful indexes on the renamed column
-- (None existed pre-migration; adding now since RLS predicates and the home
-- screen care-history query both filter / sort by author_id.)
CREATE INDEX care_events_author_id_idx
  ON public.care_events(author_id);
CREATE INDEX care_events_author_id_created_at_idx
  ON public.care_events(author_id, created_at DESC);

-- Step 6: recreate RLS policies using author_id, with caretaker access added.

-- SELECT: own events OR events on plants in gardens you have access to.
-- The "own events" branch means a former caretaker still sees their own
-- historical care contributions even after access is revoked. Intentional.
CREATE POLICY care_events_select ON public.care_events
  FOR SELECT
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_events.plant_id
        AND public.has_garden_access(p.user_id)
    )
  );

-- INSERT: only into plants in gardens you have access to, and only with
-- author_id = your own UID. The author_id check prevents impersonation.
CREATE POLICY care_events_insert ON public.care_events
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_events.plant_id
        AND public.has_garden_access(p.user_id)
    )
  );

-- UPDATE: only your own care events.
CREATE POLICY care_events_update_own ON public.care_events
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- DELETE: only your own care events.
CREATE POLICY care_events_delete_own ON public.care_events
  FOR DELETE
  USING (author_id = auth.uid());
