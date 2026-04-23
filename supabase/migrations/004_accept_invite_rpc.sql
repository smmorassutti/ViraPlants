-- =====================================================================
-- Migration 004: accept_garden_invite RPC
-- =====================================================================
-- Transactional handler for caretaker-side invite acceptance.
-- Called from supabase/functions/accept-invite/index.ts with the
-- service-role client.
--
-- Why a SECURITY DEFINER Postgres function instead of two writes from
-- the Edge Function: atomicity. The caretakers INSERT and the invite
-- UPDATE have to happen in the same transaction. A crash between them
-- would leave a pending invite for a caretaker who already has access,
-- which surfaces as confusing "already_caretaker" errors on retry.
--
-- SECURITY DEFINER also gives the function read access to auth.users,
-- which it needs because public.profiles has no email column.
--
-- EXECUTE is granted only to service_role — regular clients must go
-- through the Edge Function.
--
-- NOTE: As with migrations 003 and 003b, this file is a backfill.
-- Apply via the Supabase Dashboard SQL Editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accept_garden_invite(
  p_invite_id uuid,
  p_caretaker_id uuid
)
RETURNS TABLE(
  owner_id uuid,
  owner_display_name text,
  owner_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite         public.garden_invites%ROWTYPE;
  v_owner_email    text;
  v_owner_name     text;
BEGIN
  -- Load invite with row lock to prevent concurrent accept races
  SELECT * INTO v_invite
  FROM public.garden_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_accepted';
  END IF;

  IF v_invite.invite_expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  -- Guard against duplicate caretaker row. If one already exists, we still
  -- resolve the invite (set accepted_at) so it stops appearing as pending,
  -- then raise a distinct error so the caller knows no new access was granted.
  IF EXISTS (
    SELECT 1 FROM public.garden_caretakers
    WHERE owner_id = v_invite.owner_id AND caretaker_id = p_caretaker_id
  ) THEN
    UPDATE public.garden_invites
    SET accepted_at = NOW()
    WHERE id = p_invite_id;
    RAISE EXCEPTION 'already_caretaker';
  END IF;

  -- Atomic: insert caretaker row + mark invite accepted.
  -- garden_caretakers.accepted_at and invited_at have NOT NULL defaults of
  -- now(); we pass invited_at explicitly so it reflects when the invite was
  -- first sent. expires_at copies from the invite's expires_at (nullable
  -- owner-set end date), NOT invite_expires_at (the 7-day link expiry).
  INSERT INTO public.garden_caretakers (
    owner_id, caretaker_id, invited_at, accepted_at, expires_at
  ) VALUES (
    v_invite.owner_id,
    p_caretaker_id,
    v_invite.created_at,
    NOW(),
    v_invite.expires_at
  );

  UPDATE public.garden_invites
  SET accepted_at = NOW()
  WHERE id = p_invite_id;

  -- Look up owner's email from auth.users (profiles has no email column)
  -- and display name from profiles (nullable).
  SELECT au.email, p.display_name
  INTO v_owner_email, v_owner_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = v_invite.owner_id;

  RETURN QUERY SELECT
    v_invite.owner_id,
    COALESCE(v_owner_name, split_part(v_owner_email, '@', 1)),
    v_owner_email;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_garden_invite(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_garden_invite(uuid, uuid) TO service_role;
