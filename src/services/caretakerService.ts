// Caretaker Service — client wrapper around caretaker mode APIs.
//
// Phase 2 exports are implemented:
//   - inviteCaretaker, listMyInvites, listMyCaretakers,
//   - cancelInvite, revokeCaretaker, updateCaretakerExpiry
//
// Later-phase exports exist as typed stubs that throw; they'll be implemented
// in Phase 3+:
//   - listGardensImCaretaking, listPendingInvitesForMe,
//   - acceptInvite, declineInvite

import {supabase} from './supabase';

// ── Types ──

export interface GardenCaretaker {
  id: string;
  ownerId: string;
  caretakerId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GardenInvite {
  id: string;
  ownerId: string;
  inviteeEmail: string;
  inviteExpiresAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface GardenSummary {
  ownerId: string;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  expiresAt: string | null;
}

export interface PendingInvite {
  id: string;
  ownerId: string;
  ownerName: string | null;
  inviteeEmail: string;
  inviteExpiresAt: string | null;
  createdAt: string;
}

export class CaretakerError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CaretakerError';
  }
}

// ── Helpers ──

type InviteRow = {
  id: string;
  owner_id: string;
  invitee_email: string;
  invite_expires_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type CaretakerRow = {
  id: string;
  owner_id: string;
  caretaker_id: string;
  expires_at: string | null;
  invited_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const rowToInvite = (row: InviteRow): GardenInvite => ({
  id: row.id,
  ownerId: row.owner_id,
  inviteeEmail: row.invitee_email,
  inviteExpiresAt: row.invite_expires_at,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at,
});

async function extractFunctionError(
  error: unknown,
): Promise<{code: string; message: string}> {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as {context?: unknown}).context;
    if (ctx instanceof Response) {
      try {
        const body: unknown = await ctx.json();
        if (body && typeof body === 'object') {
          const err = (body as {error?: unknown}).error;
          if (err && typeof err === 'object') {
            const code = (err as {code?: unknown}).code;
            const message = (err as {message?: unknown}).message;
            if (typeof code === 'string') {
              return {
                code,
                message:
                  typeof message === 'string' && message.length > 0
                    ? message
                    : 'Something went wrong. Please try again.',
              };
            }
          }
          if (typeof err === 'string') {
            const message = (body as {message?: unknown}).message;
            return {
              code: err,
              message:
                typeof message === 'string' && message.length > 0
                  ? message
                  : 'Something went wrong. Please try again.',
            };
          }
          // Supabase platform error shape: { code, message } flat at the top
          // level (e.g. UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM when a
          // function is deployed without --no-verify-jwt).
          const topCode = (body as {code?: unknown}).code;
          if (typeof topCode === 'string') {
            const topMessage = (body as {message?: unknown}).message;
            return {
              code: topCode,
              message:
                typeof topMessage === 'string' && topMessage.length > 0
                  ? topMessage
                  : 'Something went wrong. Please try again.',
            };
          }
        }
      } catch {
        // fall through
      }
    }
  }
  const message =
    error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return {code: 'unknown', message};
}

// ── Phase 2: Owner-side APIs ──

/**
 * Invite a caretaker by email. Calls the `invite-caretaker` Edge Function,
 * which sends the invitation email via Resend and inserts into `garden_invites`.
 *
 * On failure, throws a `CaretakerError` whose `code` maps directly to the
 * user-facing strings in `InviteCaretakerScreen`.
 */
export async function inviteCaretaker(
  email: string,
  opts: {expiresAt?: string} = {},
): Promise<{inviteId: string}> {
  const body: {email: string; expiresAt?: string} = {email};
  if (opts.expiresAt) body.expiresAt = opts.expiresAt;

  const {data, error} = await supabase.functions.invoke('invite-caretaker', {body});

  if (error) {
    const {code, message} = await extractFunctionError(error);
    throw new CaretakerError(code, message);
  }

  if (!data || typeof data !== 'object' || typeof (data as {inviteId?: unknown}).inviteId !== 'string') {
    throw new CaretakerError('invalid_response', 'Something went wrong. Please try again.');
  }

  return {inviteId: (data as {inviteId: string}).inviteId};
}

/**
 * List pending (unaccepted) invites owned by the caller.
 */
export async function listMyInvites(): Promise<GardenInvite[]> {
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new CaretakerError('unauthorized', 'You need to be signed in.');

  const {data, error} = await supabase
    .from('garden_invites')
    .select('id, owner_id, invitee_email, invite_expires_at, expires_at, accepted_at, created_at')
    .eq('owner_id', user.id)
    .is('accepted_at', null)
    .order('created_at', {ascending: false});

  if (error) throw new CaretakerError('query_failed', error.message);
  return (data as InviteRow[] | null ?? []).map(rowToInvite);
}

/**
 * List the caretakers who have access to the caller's garden.
 */
export async function listMyCaretakers(): Promise<GardenCaretaker[]> {
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new CaretakerError('unauthorized', 'You need to be signed in.');

  const {data: caretakerRows, error} = await supabase
    .from('garden_caretakers')
    .select('id, owner_id, caretaker_id, expires_at, invited_at')
    .eq('owner_id', user.id)
    .order('invited_at', {ascending: false});

  if (error) throw new CaretakerError('query_failed', error.message);
  const rows = (caretakerRows as CaretakerRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const caretakerIds = rows.map(r => r.caretaker_id);
  const {data: profileRows, error: profileErr} = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', caretakerIds);

  if (profileErr) throw new CaretakerError('query_failed', profileErr.message);

  const profileById = new Map<string, ProfileRow>();
  for (const row of (profileRows as ProfileRow[] | null) ?? []) {
    profileById.set(row.id, row);
  }

  return rows.map(row => {
    const profile = profileById.get(row.caretaker_id);
    return {
      id: row.id,
      ownerId: row.owner_id,
      caretakerId: row.caretaker_id,
      displayName: profile?.display_name ?? null,
      email: null, // auth.users email is not exposed via PostgREST to regular users
      avatarUrl: profile?.avatar_url ?? null,
      expiresAt: row.expires_at,
      createdAt: row.invited_at,
    };
  });
}

/**
 * Cancel a pending invite. Relies on RLS policy `owner_or_invitee_can_delete`.
 */
export async function cancelInvite(inviteId: string): Promise<void> {
  const {error} = await supabase.from('garden_invites').delete().eq('id', inviteId);
  if (error) throw new CaretakerError('delete_failed', error.message);
}

/**
 * Revoke a caretaker. Deletes the `garden_caretakers` row. RLS requires the
 * caller to be the owner.
 */
export async function revokeCaretaker(caretakerId: string): Promise<void> {
  const {error} = await supabase
    .from('garden_caretakers')
    .delete()
    .eq('id', caretakerId);
  if (error) throw new CaretakerError('delete_failed', error.message);
}

/**
 * Set or clear a caretaker's access expiry.
 */
export async function updateCaretakerExpiry(
  caretakerId: string,
  expiresAt: string | null,
): Promise<void> {
  const {error} = await supabase
    .from('garden_caretakers')
    .update({expires_at: expiresAt})
    .eq('id', caretakerId);
  if (error) throw new CaretakerError('update_failed', error.message);
}

// ── Phase 3/4 stubs (declared so imports typecheck, not yet implemented) ──

/**
 * Phase 4 — list gardens the current user is caretaking.
 */
export async function listGardensImCaretaking(): Promise<GardenSummary[]> {
  throw new CaretakerError(
    'not_implemented',
    'listGardensImCaretaking is implemented in Phase 4.',
  );
}

/**
 * Phase 3 — list pending invites addressed to the current user.
 */
export async function listPendingInvitesForMe(): Promise<PendingInvite[]> {
  throw new CaretakerError(
    'not_implemented',
    'listPendingInvitesForMe is implemented in Phase 3.',
  );
}

/**
 * Phase 3 — accept an invite. Calls the `accept-invite` Edge Function.
 */
export async function acceptInvite(
  _inviteId: string,
): Promise<{ownerId: string; ownerName: string}> {
  throw new CaretakerError(
    'not_implemented',
    'acceptInvite is implemented in Phase 3.',
  );
}

/**
 * Phase 3 — decline an invite (DELETE via RLS policy).
 */
export async function declineInvite(_inviteId: string): Promise<void> {
  throw new CaretakerError(
    'not_implemented',
    'declineInvite is implemented in Phase 3.',
  );
}
