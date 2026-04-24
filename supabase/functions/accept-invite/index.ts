// accept-invite Edge Function
// Accepts: { inviteId: string }
// Returns: { success: true, ownerId: string, ownerName: string } | { error: { code, message } }
//
// Auth: decodes the JWT payload from the Authorization header. Deploy with
// --no-verify-jwt (the Supabase Edge Runtime platform's default verifier does
// not currently accept ES256 user JWTs — see questions.md Q2). Signature
// trust comes from the API gateway that sits in front of the function runtime.
//
// Flow:
//   1. Decode JWT -> caretaker_id (sub) + caretaker_email (email)
//   2. Validate inviteId (UUID-shape)
//   3. Load invite via service role; 404 if missing
//   4. Verify invitee_email matches caretaker_email (case-insensitive) — guards
//      against a caretaker guessing someone else's invite id
//   5. Call RPC accept_garden_invite(p_invite_id, p_caretaker_id) — a
//      SECURITY DEFINER Postgres function that atomically inserts into
//      garden_caretakers and flips garden_invites.accepted_at
//   6. Map RPC exception messages to HTTP error codes
//   7. Return only { success, ownerId, ownerName } — owner_email never
//      leaves the database

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AcceptErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'invite_not_found'
  | 'invite_already_accepted'
  | 'invite_expired'
  | 'email_mismatch'
  | 'already_caretaker'
  | 'internal';

interface AcceptRequest {
  inviteId?: unknown;
}

interface JwtPayload {
  sub: string;
  email?: string;
}

interface AcceptInviteRpcRow {
  garden_owner_id: string;
  garden_owner_display_name: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: AcceptErrorCode, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length < 2) return null;
  const padded = segments[1] + '='.repeat((4 - (segments[1].length % 4)) % 4);
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const json = atob(normalized);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const sub = parsed.sub;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    const email = typeof parsed.email === 'string' ? parsed.email : undefined;
    return { sub, email };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('bad_request', 'Only POST requests are accepted.', 405);
  }

  try {
    // ── Auth: decode the JWT (gateway already validated the signature) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('unauthorized', 'Missing or invalid Authorization header.', 401);
    }
    const payload = decodeJwtPayload(authHeader.replace('Bearer ', '').trim());
    if (!payload) {
      return errorResponse('unauthorized', 'Could not decode token.', 401);
    }
    const caretakerId = payload.sub;
    // JWT email is not guaranteed lowercase; the DB-side invitee_email is.
    const caretakerEmail = (payload.email ?? '').toLowerCase();
    if (!caretakerEmail) {
      return errorResponse('unauthorized', 'Token is missing an email claim.', 401);
    }

    // ── Parse body ──
    let body: AcceptRequest;
    try {
      body = (await req.json()) as AcceptRequest;
    } catch {
      return errorResponse('bad_request', 'Request body must be valid JSON.', 400);
    }

    const inviteId = typeof body.inviteId === 'string' ? body.inviteId.trim() : '';
    if (!inviteId || !UUID_RE.test(inviteId)) {
      return errorResponse('bad_request', 'inviteId must be a UUID string.', 400);
    }

    // ── Service-role client ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
      return errorResponse('internal', 'Service is misconfigured.', 500);
    }
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Load invite for existence + email-match check ──
    // The RPC would also catch invite_not_found, but doing it here lets us
    // return email_mismatch without revealing whether the invite exists.
    const { data: inviteRow, error: lookupErr } = await serviceSupabase
      .from('garden_invites')
      .select('id, invitee_email')
      .eq('id', inviteId)
      .maybeSingle();

    if (lookupErr) {
      console.error('garden_invites lookup failed:', lookupErr);
      return errorResponse('internal', 'Could not look up the invitation.', 500);
    }

    if (!inviteRow) {
      return errorResponse('invite_not_found', 'That invitation no longer exists.', 404);
    }

    const inviteEmail =
      typeof inviteRow.invitee_email === 'string'
        ? inviteRow.invitee_email.toLowerCase()
        : '';

    if (inviteEmail !== caretakerEmail) {
      return errorResponse(
        'email_mismatch',
        "This invitation wasn't sent to your email address.",
        403,
      );
    }

    // ── Call the atomic RPC ──
    const { data: rpcData, error: rpcError } = await serviceSupabase.rpc(
      'accept_garden_invite',
      {
        p_invite_id: inviteId,
        p_caretaker_id: caretakerId,
      },
    );

    if (rpcError) {
      const message = (rpcError.message ?? '').toLowerCase();
      if (message.includes('invite_not_found')) {
        return errorResponse('invite_not_found', 'That invitation no longer exists.', 404);
      }
      if (message.includes('invite_already_accepted')) {
        return errorResponse(
          'invite_already_accepted',
          'This invitation has already been accepted.',
          409,
        );
      }
      if (message.includes('invite_expired')) {
        return errorResponse(
          'invite_expired',
          'This invitation has expired. Ask the owner to send a new one.',
          410,
        );
      }
      if (message.includes('already_caretaker')) {
        return errorResponse(
          'already_caretaker',
          "You're already caring for this garden.",
          409,
        );
      }
      console.error('accept_garden_invite RPC failed:', rpcError);
      return errorResponse('internal', 'Could not accept the invitation.', 500);
    }

    // supabase-js returns RPC RETURNS TABLE(...) as an array of rows.
    const rows = (rpcData as AcceptInviteRpcRow[] | null) ?? [];
    const row = rows[0];
    if (!row || typeof row.garden_owner_id !== 'string') {
      console.error('accept_garden_invite returned unexpected payload:', rpcData);
      return errorResponse('internal', 'Could not accept the invitation.', 500);
    }

    // The RPC returns the owner_id and an already-coalesced display name
    // (falls back to email prefix inside the RPC when the owner has no
    // profile name). Owner email never leaves the database.
    const ownerName =
      typeof row.garden_owner_display_name === 'string' && row.garden_owner_display_name.length > 0
        ? row.garden_owner_display_name
        : 'Your plant friend';

    return jsonResponse(
      { success: true, ownerId: row.garden_owner_id, ownerName },
      200,
    );
  } catch (err) {
    console.error('Unexpected error in accept-invite:', err);
    return errorResponse('internal', 'An unexpected error occurred.', 500);
  }
});
