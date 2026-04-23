import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {viraTheme} from '../theme/vira';
import type {PendingInvite} from '../services/caretakerService';
import {CaretakerError} from '../services/caretakerService';
import {formatRelative, isInviteExpired} from '../utils/formatDate';

type ErrorCode =
  | 'invite_expired'
  | 'invite_already_accepted'
  | 'invite_not_found'
  | 'already_caretaker'
  | 'email_mismatch'
  | 'unknown';

const mapErrorCodeToMessage = (code: string): string => {
  switch (code as ErrorCode) {
    case 'invite_expired':
      return 'This invitation has expired. Ask the owner to send a new one.';
    case 'invite_already_accepted':
      return 'This invitation has already been accepted.';
    case 'already_caretaker':
      return "You're already caring for this garden.";
    case 'email_mismatch':
      return "This invitation wasn't sent to your email address.";
    case 'invite_not_found':
      return 'This invitation no longer exists.';
    default:
      return "Couldn't accept the invitation. Please try again.";
  }
};

interface Props {
  invite: PendingInvite;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}

export const PendingInviteCard: React.FC<Props> = ({
  invite,
  onAccept,
  onDecline,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const expired = useMemo(() => isInviteExpired(invite), [invite]);
  const ownerName = invite.ownerName ?? 'A Vira gardener';
  const headline = expired
    ? 'This invitation has expired'
    : `${ownerName} wants you to help care for their plants`;
  const busy = isAccepting || isDeclining;

  const clearError = useCallback(() => {
    if (errorMessage) setErrorMessage(null);
  }, [errorMessage]);

  const handleAccept = useCallback(async () => {
    if (busy) return;
    clearError();
    setIsAccepting(true);
    try {
      await onAccept();
    } catch (err) {
      const code = err instanceof CaretakerError ? err.code : 'unknown';
      setErrorMessage(mapErrorCodeToMessage(code));
    } finally {
      setIsAccepting(false);
    }
  }, [busy, clearError, onAccept]);

  const handleDecline = useCallback(async () => {
    if (busy) return;
    clearError();
    setIsDeclining(true);
    try {
      await onDecline();
    } catch (err) {
      const code = err instanceof CaretakerError ? err.code : 'unknown';
      setErrorMessage(mapErrorCodeToMessage(code));
    } finally {
      setIsDeclining(false);
    }
  }, [busy, clearError, onDecline]);

  return (
    <View
      style={[styles.card, expired && styles.cardExpired]}
      accessibilityLabel={
        expired
          ? `Expired invitation from ${ownerName}`
          : `Invitation from ${ownerName}`
      }>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.subtext}>
        Sent {formatRelative(invite.createdAt)}
      </Text>

      {expired ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDecline}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Dismiss expired invitation">
            {isDeclining ? (
              <ActivityIndicator
                color={viraTheme.colors.hemlock}
                size="small"
              />
            ) : (
              <Text style={styles.dismissText}>Dismiss</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.declineButton, busy && styles.buttonDisabled]}
            onPress={handleDecline}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Decline invitation from ${ownerName}`}>
            {isDeclining ? (
              <ActivityIndicator
                color={viraTheme.colors.hemlock}
                size="small"
              />
            ) : (
              <Text style={styles.declineText}>Decline</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, busy && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Accept invitation from ${ownerName}`}>
            {isAccepting ? (
              <ActivityIndicator
                color={viraTheme.colors.butterMoon}
                size="small"
              />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {errorMessage ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.sm,
  },
  cardExpired: {
    opacity: 0.5,
  },
  headline: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    color: viraTheme.colors.lagoon,
    marginBottom: 4,
  },
  subtext: {
    ...viraTheme.typography.caption,
    fontSize: 13,
    color: viraTheme.colors.luxor,
    marginBottom: viraTheme.spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: viraTheme.spacing.sm,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: viraTheme.colors.vermillion,
    borderRadius: viraTheme.radius.md,
    paddingVertical: viraTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.lagoon,
    fontSize: 14,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: viraTheme.colors.hemlock,
    borderRadius: viraTheme.radius.md,
    paddingVertical: viraTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  declineText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
    fontSize: 14,
  },
  dismissButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: viraTheme.colors.hemlock,
    borderRadius: viraTheme.radius.md,
    paddingVertical: viraTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  dismissText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.vermillion,
    marginTop: viraTheme.spacing.sm,
  },
});
