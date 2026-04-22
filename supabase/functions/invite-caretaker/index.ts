// invite-caretaker Edge Function
// Accepts: { email: string, expiresAt?: string }
// Returns: { success: true, inviteId: string } | { error: { code, message } }
// Auth: JWT from Authorization header (signature validated by gateway; we decode sub + email)
//
// Flow:
//   1. Decode JWT -> owner_id + owner_email
//   2. Validate body (email format, lowercase, optional expiresAt in future)
//   3. Reject self-invite
//   4. Reject existing active invite for (owner_id, invitee_email)
//   5. Reject if invitee is already a caretaker of this owner's garden
//   6. Generate invite token (base64url)
//   7. Insert into garden_invites with service role (expires_at = caretaker-access expiry)
//   8. Send email via Resend (shared helper)
//   9. Return { success: true, inviteId }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, SendEmailError } from '../_shared/sendEmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INVITE_EXPIRY_DAYS = 7;

interface InviteRequest {
  email: string;
  expiresAt?: string;
}

interface ErrorBody {
  error: {
    code: InviteErrorCode;
    message: string;
  };
}

type InviteErrorCode =
  | 'unauthorized'
  | 'invalid_email'
  | 'invalid_expiry'
  | 'self_invite'
  | 'already_invited'
  | 'already_caretaker'
  | 'email_send_failed'
  | 'bad_request'
  | 'internal';

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: InviteErrorCode, message: string, status: number): Response {
  const body: ErrorBody = { error: { code, message } };
  return jsonResponse(body as unknown as Record<string, unknown>, status);
}

// Basic RFC-5322-ish sanity check. DB CHECK constraint enforces canonical form.
function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// base64url-encode a UUID, trimmed to 32 chars. Collisions functionally impossible.
function generateInviteToken(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  const bytes = new Uint8Array(uuid.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(uuid.slice(i * 2, i * 2 + 2), 16);
  }
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 32);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildInviteEmailHtml(ownerName: string, inviteeEmail: string): string {
  const safeOwner = escapeHtml(ownerName);
  const safeEmail = escapeHtml(inviteeEmail);
  return `<div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1C2B1E;">
  <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 16px;">
    ${safeOwner} wants you to help care for their plants
  </h1>
  <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px;">
    You've been invited to be a caretaker for ${safeOwner}'s garden on Vira.
    As a caretaker, you'll be able to view their plants, mark them as watered
    or fertilized, and leave notes.
  </p>
  <div style="background: #FCFEE6; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
    <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #5B5F45;">
      <strong>Next step:</strong> Open the Vira app on your phone, go to
      <strong>Settings → Pending invitations</strong>, and accept this invite.
      You'll need to sign in with the email address this was sent to:
      <strong>${safeEmail}</strong>
    </p>
  </div>
  <p style="font-size: 13px; color: #5B5F45; margin: 0;">
    This invitation expires in 7 days.
  </p>
</div>`;
}

interface JwtPayload {
  sub: string;
  email?: string;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length < 2) return null;
  const payloadSegment = segments[1];
  // Restore base64 padding if missing
  const padded = payloadSegment + '='.repeat((4 - (payloadSegment.length % 4)) % 4);
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
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return errorResponse('unauthorized', 'Could not decode token.', 401);
    }
    const ownerId = payload.sub;
    const ownerEmailFromJwt = (payload.email ?? '').toLowerCase();

    // ── Parse body ──
    let body: InviteRequest;
    try {
      body = (await req.json()) as InviteRequest;
    } catch {
      return errorResponse('bad_request', 'Request body must be valid JSON.', 400);
    }

    if (!body || typeof body.email !== 'string') {
      return errorResponse('invalid_email', "That doesn't look like a valid email address.", 400);
    }

    const invitee = body.email.trim().toLowerCase();
    if (!isValidEmail(invitee)) {
      return errorResponse('invalid_email', "That doesn't look like a valid email address.", 400);
    }

    // ── Optional expires_at for caretaker access (NOT the invite's own 7-day TTL) ──
    let caretakerExpiresAt: string | null = null;
    if (body.expiresAt !== undefined && body.expiresAt !== null) {
      if (typeof body.expiresAt !== 'string') {
        return errorResponse('invalid_expiry', 'expiresAt must be an ISO string.', 400);
      }
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return errorResponse('invalid_expiry', 'expiresAt must be a valid date.', 400);
      }
      if (parsed.getTime() <= Date.now()) {
        return errorResponse('invalid_expiry', 'expiresAt must be in the future.', 400);
      }
      caretakerExpiresAt = parsed.toISOString();
    }

    // ── Supabase clients ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
      return errorResponse('internal', 'Service is misconfigured.', 500);
    }
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Resolve the owner's email (prefer DB source of truth, fall back to JWT) ──
    let ownerEmail = ownerEmailFromJwt;
    const { data: authUser, error: authUserError } = await serviceSupabase.auth.admin.getUserById(ownerId);
    if (authUserError) {
      console.warn('Could not fetch auth user for owner:', authUserError);
    } else if (authUser?.user?.email) {
      ownerEmail = authUser.user.email.toLowerCase();
    }

    // ── Self-invite guard ──
    if (ownerEmail && invitee === ownerEmail) {
      return errorResponse('self_invite', "You can't invite yourself.", 400);
    }

    // ── Already a caretaker? ──
    const { data: existingCaretakerRows, error: caretakerLookupError } = await serviceSupabase
      .from('garden_caretakers')
      .select('id, caretaker_id')
      .eq('owner_id', ownerId);

    if (caretakerLookupError) {
      console.error('garden_caretakers lookup failed:', caretakerLookupError);
      return errorResponse('internal', 'Could not verify caretaker status.', 500);
    }

    if (existingCaretakerRows && existingCaretakerRows.length > 0) {
      const caretakerIds = existingCaretakerRows
        .map(row => row.caretaker_id)
        .filter((id): id is string => typeof id === 'string');
      if (caretakerIds.length > 0) {
        const { data: matchingUsers } = await serviceSupabase
          .from('profiles')
          .select('id')
          .in('id', caretakerIds);
        if (matchingUsers && matchingUsers.length > 0) {
          for (const row of matchingUsers) {
            const { data: u } = await serviceSupabase.auth.admin.getUserById(row.id);
            if (u?.user?.email && u.user.email.toLowerCase() === invitee) {
              return errorResponse(
                'already_caretaker',
                'This person is already caring for your garden.',
                409,
              );
            }
          }
        }
      }
    }

    // ── Already an active (unaccepted) invite? ──
    const { data: existingInvite, error: inviteLookupError } = await serviceSupabase
      .from('garden_invites')
      .select('id, accepted_at, invite_expires_at')
      .eq('owner_id', ownerId)
      .eq('invitee_email', invitee)
      .is('accepted_at', null)
      .maybeSingle();

    if (inviteLookupError) {
      console.error('garden_invites lookup failed:', inviteLookupError);
      return errorResponse('internal', 'Could not verify existing invites.', 500);
    }

    if (existingInvite) {
      const inviteExpiresAt = existingInvite.invite_expires_at
        ? new Date(existingInvite.invite_expires_at as string)
        : null;
      if (!inviteExpiresAt || inviteExpiresAt.getTime() > Date.now()) {
        return errorResponse(
          'already_invited',
          "You've already invited this person. Check your pending invites.",
          409,
        );
      }
      // The existing invite is expired — remove it so we can create a fresh one.
      await serviceSupabase
        .from('garden_invites')
        .delete()
        .eq('id', existingInvite.id);
    }

    // ── Generate token + compute 7-day TTL ──
    const inviteToken = generateInviteToken();
    const inviteExpiresAtIso = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const insertPayload: Record<string, unknown> = {
      owner_id: ownerId,
      invitee_email: invitee,
      token: inviteToken,
      invite_expires_at: inviteExpiresAtIso,
    };
    if (caretakerExpiresAt) {
      insertPayload.expires_at = caretakerExpiresAt;
    }

    const { data: inserted, error: insertError } = await serviceSupabase
      .from('garden_invites')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('garden_invites insert failed:', insertError);
      return errorResponse('internal', 'Could not create the invitation.', 500);
    }

    const inviteId = inserted.id as string;

    // ── Resolve owner display name (fallback: email prefix) ──
    let ownerName: string | null = null;
    const { data: ownerProfile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('display_name')
      .eq('id', ownerId)
      .maybeSingle();
    if (profileError) {
      console.warn('profiles lookup failed:', profileError);
    } else if (ownerProfile?.display_name && typeof ownerProfile.display_name === 'string') {
      ownerName = ownerProfile.display_name.trim() || null;
    }
    if (!ownerName) {
      ownerName = ownerEmail ? ownerEmail.split('@')[0] : 'A Vira gardener';
    }

    // ── Send email ──
    try {
      await sendEmail({
        to: invitee,
        subject: `${ownerName} wants you to help care for their plants`,
        html: buildInviteEmailHtml(ownerName, invitee),
      });
    } catch (emailErr) {
      console.error('sendEmail failed:', emailErr);
      // Roll back the invite so the user can retry cleanly.
      await serviceSupabase.from('garden_invites').delete().eq('id', inviteId);
      if (emailErr instanceof SendEmailError) {
        return errorResponse(
          'email_send_failed',
          'Could not send the invitation. Please try again.',
          502,
        );
      }
      return errorResponse(
        'email_send_failed',
        'Could not send the invitation. Please try again.',
        502,
      );
    }

    return jsonResponse({ success: true, inviteId }, 200);
  } catch (err) {
    console.error('Unexpected error in invite-caretaker:', err);
    return errorResponse('internal', 'An unexpected error occurred.', 500);
  }
});
