// caretaker-invites Edge Function
//
// Why this exists: the RLS SELECT policy on `public.garden_invites` references
// `auth.users` in its USING clause, which `anon`/`authenticated` roles cannot
// read. This makes direct PostgREST SELECT/DELETE from the mobile app fail
// with 42501 "permission denied for table users". Rather than modify the RLS
// (out of scope for this bugfix round — see questions.md Q1), we route list
// and cancel operations through this function, which uses the service-role
// client and bypasses RLS.
//
// Accepts: { action: 'list' }
//       or: { action: 'cancel', inviteId: string }
// Returns (list):   { invites: InviteRow[] }
//        (cancel):  { success: true }
// On error, nested shape: { error: { code, message } }.
//
// Auth: decodes the JWT payload from the Authorization header. Deploy with
// --no-verify-jwt (the Supabase Edge Runtime platform's default verifier does
// not currently accept ES256 user JWTs — see questions.md Q2). Signature
// trust comes from the API gateway that sits in front of the function runtime.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'invite_not_found'
  | 'forbidden'
  | 'internal';

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: ErrorCode, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

interface JwtPayload {
  sub: string;
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
    return { sub };
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
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('unauthorized', 'Missing or invalid Authorization header.', 401);
    }
    const payload = decodeJwtPayload(authHeader.replace('Bearer ', '').trim());
    if (!payload) {
      return errorResponse('unauthorized', 'Could not decode token.', 401);
    }
    const ownerId = payload.sub;

    // ── Body ──
    let body: { action?: string; inviteId?: string };
    try {
      body = (await req.json()) as { action?: string; inviteId?: string };
    } catch {
      return errorResponse('bad_request', 'Request body must be valid JSON.', 400);
    }

    const action = body?.action;
    if (action !== 'list' && action !== 'cancel') {
      return errorResponse('bad_request', "Unknown action; expected 'list' or 'cancel'.", 400);
    }

    // ── Service-role client ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
      return errorResponse('internal', 'Service is misconfigured.', 500);
    }
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'list') {
      const { data, error } = await serviceSupabase
        .from('garden_invites')
        .select('id, owner_id, invitee_email, invite_expires_at, expires_at, accepted_at, created_at')
        .eq('owner_id', ownerId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('garden_invites list failed:', error);
        return errorResponse('internal', 'Could not load your invites.', 500);
      }

      return jsonResponse({ invites: data ?? [] }, 200);
    }

    // action === 'cancel'
    const inviteId = body.inviteId;
    if (typeof inviteId !== 'string' || inviteId.length === 0) {
      return errorResponse('bad_request', 'inviteId is required.', 400);
    }

    // Verify ownership before deleting — service role bypasses RLS, so we
    // must enforce authorization ourselves.
    const { data: inviteRow, error: lookupErr } = await serviceSupabase
      .from('garden_invites')
      .select('id, owner_id')
      .eq('id', inviteId)
      .maybeSingle();

    if (lookupErr) {
      console.error('garden_invites lookup failed:', lookupErr);
      return errorResponse('internal', 'Could not look up the invite.', 500);
    }

    if (!inviteRow) {
      return errorResponse('invite_not_found', 'That invite no longer exists.', 404);
    }

    if (inviteRow.owner_id !== ownerId) {
      return errorResponse('forbidden', 'You cannot cancel this invite.', 403);
    }

    const { error: deleteErr } = await serviceSupabase
      .from('garden_invites')
      .delete()
      .eq('id', inviteId);

    if (deleteErr) {
      console.error('garden_invites delete failed:', deleteErr);
      return errorResponse('internal', 'Could not cancel the invite.', 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('Unexpected error in caretaker-invites:', err);
    return errorResponse('internal', 'An unexpected error occurred.', 500);
  }
});
