// Shared date/invite helpers. Extracted from ManageCaretakersScreen so the
// Phase 3 PendingInviteCard can reuse the exact same formatting.

import type {GardenInvite, PendingInvite} from '../services/caretakerService';

export const formatFullDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));

export const formatRelative = (iso: string): string => {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
  return formatFullDate(iso);
};

export const isInviteExpired = (
  invite: Pick<GardenInvite, 'inviteExpiresAt'> | Pick<PendingInvite, 'inviteExpiresAt'>,
): boolean => {
  if (!invite.inviteExpiresAt) return false;
  return new Date(invite.inviteExpiresAt).getTime() < Date.now();
};
