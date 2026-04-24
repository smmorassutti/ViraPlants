// Caretaker Service — client wrapper around caretaker mode APIs.
//
// Phase 2 (owner-side) exports:
//   - inviteCaretaker, listMyInvites, listMyCaretakers,
//   - cancelInvite, revokeCaretaker, updateCaretakerExpiry
//
// Phase 3 (caretaker-side) exports:
//   - listPendingInvitesForMe, acceptInvite, declineInvite
//
// Phase 4 stub remains:
//   - listGardensImCaretaking
//
// Owner/caretaker asymmetry (intentional, temporary): owner-side list + cancel
// go through the caretaker-invites Edge Function because they predate the
// auth.jwt() ->> 'email' RLS fix. Caretaker-side list + decline hit PostgREST
// directly. Unifying both sides onto direct PostgREST is deferred to
// post-Phase-6 cleanup.

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

export interface AcceptedInvite {
  ownerId: string;
  ownerName: string;
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
 *
 * Implementation note: the SELECT policy on `garden_invites` references
 * `auth.users`, which neither the anon nor authenticated role can read — see
 * `questions.md` Q1. Until that RLS policy is fixed, we route through the
 * `caretaker-invites` Edge Function, which uses the service-role client and
 * bypasses RLS.
 */
export async function listMyInvites(): Promise<GardenInvite[]> {
  const {data, error} = await supabase.functions.invoke('caretaker-invites', {
    body: {action: 'list'},
  });

  if (error) {
    const {code, message} = await extractFunctionError(error);
    throw new CaretakerError(code, message);
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as {invites?: unknown}).invites)
  ) {
    throw new CaretakerError('invalid_response', 'Could not load your invites.');
  }

  return ((data as {invites: InviteRow[]}).invites).map(rowToInvite);
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
 * Cancel a pending invite.
 *
 * Implementation note: same RLS caveat as `listMyInvites` — the policy on
 * `garden_invites` blocks authenticated-role DELETE with a "permission denied
 * for table users" error. Routes through the `caretaker-invites` Edge Function
 * (service role), which re-checks ownership from the JWT `sub` claim.
 */
export async function cancelInvite(inviteId: string): Promise<void> {
  const {error} = await supabase.functions.invoke('caretaker-invites', {
    body: {action: 'cancel', inviteId},
  });

  if (error) {
    const {code, message} = await extractFunctionError(error);
    throw new CaretakerError(code, message);
  }
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

// ── Phase 3: Caretaker-side APIs ──

type PendingInviteRow = {
  id: string;
  owner_id: string;
  invitee_email: string;
  invite_expires_at: string | null;
  expires_at: string | null;
  created_at: string;
};

/**
 * List pending invites addressed to the current user's email.
 *
 * Relies on the `invitee_can_view_own_invites` RLS policy on `garden_invites`,
 * which scopes rows by `auth.jwt() ->> 'email'` (see migration 003b). No
 * Edge Function needed.
 *
 * Owner names come from a second lookup against `public.profiles` (RLS on
 * profiles allows any authenticated user to read display_name + avatar_url).
 * Owners without a display_name fall back to "Your plant friend" because
 * caretakers cannot read owner emails via PostgREST.
 */
export async function listPendingInvitesForMe(): Promise<PendingInvite[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new CaretakerError('query_failed', userErr.message);
  const myEmail = (userData?.user?.email ?? '').toLowerCase();
  if (!myEmail) return [];

  const {data: inviteData, error: inviteErr} = await supabase
    .from('garden_invites')
    .select('id, owner_id, invitee_email, invite_expires_at, expires_at, created_at')
    .eq('invitee_email', myEmail)
    .is('accepted_at', null)
    .order('created_at', {ascending: false});

  if (inviteErr) throw new CaretakerError('query_failed', inviteErr.message);

  const rows = (inviteData as PendingInviteRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const ownerIds = Array.from(new Set(rows.map(r => r.owner_id)));
  const {data: profileData, error: profileErr} = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ownerIds);

  if (profileErr) throw new CaretakerError('query_failed', profileErr.message);

  const nameByOwnerId = new Map<string, string>();
  for (const row of (profileData as ProfileRow[] | null) ?? []) {
    if (row.display_name && row.display_name.trim().length > 0) {
      nameByOwnerId.set(row.id, row.display_name.trim());
    }
  }

  return rows.map(row => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: nameByOwnerId.get(row.owner_id) ?? null,
    inviteeEmail: row.invitee_email,
    inviteExpiresAt: row.invite_expires_at,
    createdAt: row.created_at,
  }));
}

/**
 * Accept an invite. Routes through the `accept-invite` Edge Function, which
 * calls the SECURITY DEFINER RPC `accept_garden_invite` to atomically insert
 * into `garden_caretakers` and flip `garden_invites.accepted_at`.
 */
export async function acceptInvite(inviteId: string): Promise<AcceptedInvite> {
  const {data, error} = await supabase.functions.invoke('accept-invite', {
    body: {inviteId},
  });

  if (error) {
    const {code, message} = await extractFunctionError(error);
    throw new CaretakerError(code, message);
  }

  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as {ownerId?: unknown}).ownerId !== 'string' ||
    typeof (data as {ownerName?: unknown}).ownerName !== 'string'
  ) {
    throw new CaretakerError(
      'invalid_response',
      'Something went wrong. Please try again.',
    );
  }

  return {
    ownerId: (data as {ownerId: string}).ownerId,
    ownerName: (data as {ownerName: string}).ownerName,
  };
}

/**
 * Decline an invite. Direct PostgREST DELETE; relies on the RLS policy
 * `owner_or_invitee_can_delete` which lets either the owner or the invitee
 * (matched by `auth.jwt() ->> 'email'`) delete an unaccepted invite.
 */
export async function declineInvite(inviteId: string): Promise<void> {
  const {error} = await supabase
    .from('garden_invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw new CaretakerError('delete_failed', error.message);
}

// ── Phase 4 stub ──

/**
 * Phase 4 — list gardens the current user is caretaking.
 */
export async function listGardensImCaretaking(): Promise<GardenSummary[]> {
  throw new CaretakerError(
    'not_implemented',
    'listGardensImCaretaking is implemented in Phase 4.',
  );
}
