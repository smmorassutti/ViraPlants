-- Migration 006 — get_my_gardens() RPC
--
-- Returns the union of (a) the caller's own garden, (b) gardens they are
-- caretaker of with non-expired access. Used by useGardenStore.loadGardens()
-- as the single source of truth for "what gardens can I look at right now."
--
-- Design notes:
--   - Output columns are prefixed garden_* per the Phase 3 42702 lesson
--     (output names cannot collide with any column in any table the body
--     touches).
--   - SECURITY INVOKER, not DEFINER: relies on existing RLS to scope the
--     reads from garden_caretakers and profiles. DEFINER would require
--     defensive auth.uid() checks inside the function.
--   - Expired caretaking access is filtered IN the function — the client
--     never receives an expired garden in gardens[].
--   - Uses LEFT JOIN to profiles so a caretaking row still surfaces if the
--     owner profile is somehow missing; client falls back to the literal
--     "A Vira gardener" copy in that case.
--   - For change iteration during development, DROP FUNCTION first then
--     CREATE — CREATE OR REPLACE cannot change return signature
--     (Phase 3 42P13 lesson).
--
-- Applied via Supabase Dashboard SQL Editor.

CREATE OR REPLACE FUNCTION public.get_my_gardens()
RETURNS TABLE (
  garden_id uuid,
  garden_owner_id uuid,
  garden_owner_display_name text,
  garden_role text,
  garden_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- own garden
  SELECT
    auth.uid() AS garden_id,
    auth.uid() AS garden_owner_id,
    COALESCE(p.display_name, '') AS garden_owner_display_name,
    'owner'::text AS garden_role,
    NULL::timestamptz AS garden_expires_at
  FROM public.profiles p
  WHERE p.id = auth.uid()
  UNION ALL
  -- caretaking gardens (non-expired only)
  SELECT
    gc.owner_id AS garden_id,
    gc.owner_id AS garden_owner_id,
    COALESCE(p.display_name, '') AS garden_owner_display_name,
    'caretaker'::text AS garden_role,
    gc.expires_at AS garden_expires_at
  FROM public.garden_caretakers gc
  LEFT JOIN public.profiles p ON p.id = gc.owner_id
  WHERE gc.caretaker_id = auth.uid()
    AND gc.accepted_at IS NOT NULL
    AND (gc.expires_at IS NULL OR gc.expires_at > now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_gardens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_gardens() TO authenticated;
