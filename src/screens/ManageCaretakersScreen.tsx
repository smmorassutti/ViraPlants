import type {RootStackParamList} from '../types/navigation';
import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {
  listMyCaretakers,
  listMyInvites,
  cancelInvite,
  revokeCaretaker,
  inviteCaretaker,
  CaretakerError,
} from '../services/caretakerService';
import type {GardenCaretaker, GardenInvite} from '../services/caretakerService';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageCaretakers'>;

// ── Date helpers ──

const formatFullDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));

const formatRelative = (iso: string): string => {
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

const isInviteExpired = (invite: GardenInvite): boolean => {
  if (!invite.inviteExpiresAt) return false;
  return new Date(invite.inviteExpiresAt).getTime() < Date.now();
};

const getInitials = (name: string | null, fallback: string): string => {
  const source = (name ?? fallback).trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ── Caretaker card ──

const CaretakerCard: React.FC<{
  caretaker: GardenCaretaker;
  onRemove: () => void;
}> = ({caretaker, onRemove}) => {
  const label = caretaker.displayName || caretaker.email || 'Caretaker';
  const initials = getInitials(caretaker.displayName, label);

  return (
    <View style={styles.caretakerCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>
      <View style={styles.caretakerInfo}>
        <Text style={styles.caretakerName} numberOfLines={1}>
          {label}
        </Text>
        {caretaker.expiresAt ? (
          <Text style={styles.caretakerMeta}>
            Until {formatFullDate(caretaker.expiresAt)}
          </Text>
        ) : (
          <Text style={styles.caretakerMeta}>No expiry set</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onRemove}
        hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} as caretaker`}>
        <Text style={styles.iconButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Pending invite card ──

const PendingInviteCard: React.FC<{
  invite: GardenInvite;
  onCancel: () => void;
  onResend: () => void;
  resending: boolean;
}> = ({invite, onCancel, onResend, resending}) => {
  const expired = isInviteExpired(invite);

  return (
    <View style={[styles.inviteCard, expired && styles.inviteCardExpired]}>
      <Text style={styles.inviteEmail} numberOfLines={1}>
        {invite.inviteeEmail}
      </Text>
      <Text style={styles.inviteMeta}>
        {expired ? 'Expired' : `Sent ${formatRelative(invite.createdAt)}`}
      </Text>
      <View style={styles.inviteActions}>
        {expired ? (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={onResend}
            disabled={resending}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel={`Resend invite to ${invite.inviteeEmail}`}>
            {resending ? (
              <ActivityIndicator color={viraTheme.colors.hemlock} size="small" />
            ) : (
              <Text style={styles.resendButtonText}>Resend</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityRole="button"
          accessibilityLabel={`Cancel invite to ${invite.inviteeEmail}`}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Screen ──

export const ManageCaretakersScreen: React.FC<Props> = ({navigation}) => {
  const [caretakers, setCaretakers] = useState<GardenCaretaker[]>([]);
  const [invites, setInvites] = useState<GardenInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [caretakerList, inviteList] = await Promise.all([
        listMyCaretakers(),
        listMyInvites(),
      ]);
      setCaretakers(caretakerList);
      setInvites(inviteList);
    } catch (err) {
      const message =
        err instanceof CaretakerError
          ? err.message
          : 'Could not load your caretakers. Please try again.';
      Alert.alert("Couldn't load caretakers", message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Refresh when the screen comes back into focus (e.g. after InviteCaretaker)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleRemoveCaretaker = useCallback(
    (caretaker: GardenCaretaker) => {
      const label = caretaker.displayName || caretaker.email || 'this caretaker';
      Alert.alert(
        'Remove caretaker',
        `Remove ${label} from your garden? They'll lose access right away.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await revokeCaretaker(caretaker.id);
                setCaretakers(prev => prev.filter(c => c.id !== caretaker.id));
              } catch (err) {
                const message =
                  err instanceof CaretakerError
                    ? err.message
                    : 'Could not remove caretaker. Please try again.';
                Alert.alert("Couldn't remove", message);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const handleCancelInvite = useCallback(async (invite: GardenInvite) => {
    try {
      await cancelInvite(invite.id);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err) {
      const message =
        err instanceof CaretakerError
          ? err.message
          : 'Could not cancel invite. Please try again.';
      Alert.alert("Couldn't cancel invite", message);
    }
  }, []);

  const handleResendInvite = useCallback(async (invite: GardenInvite) => {
    setResendingId(invite.id);
    try {
      await cancelInvite(invite.id);
      await inviteCaretaker(invite.inviteeEmail);
      await load();
    } catch (err) {
      const message =
        err instanceof CaretakerError
          ? err.message
          : 'Could not resend the invite. Please try again.';
      Alert.alert("Couldn't resend", message);
    } finally {
      setResendingId(null);
    }
  }, [load]);

  const handleInvitePress = useCallback(() => {
    navigation.navigate('InviteCaretaker');
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={viraTheme.colors.butterMoon} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={viraTheme.colors.butterMoon}
          />
        }>
        <Text style={styles.intro}>
          Invite someone you trust to check in on your plants while you're away
          — or for the long haul.
        </Text>

        <Text style={styles.sectionHeader}>People caring for your garden</Text>
        {caretakers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No caretakers yet. Invite someone to help care for your plants.
            </Text>
          </View>
        ) : (
          caretakers.map(caretaker => (
            <CaretakerCard
              key={caretaker.id}
              caretaker={caretaker}
              onRemove={() => handleRemoveCaretaker(caretaker)}
            />
          ))
        )}

        <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          Pending invites
        </Text>
        {invites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No invites waiting. Send one below.
            </Text>
          </View>
        ) : (
          invites.map(invite => (
            <PendingInviteCard
              key={invite.id}
              invite={invite}
              onCancel={() => handleCancelInvite(invite)}
              onResend={() => handleResendInvite(invite)}
              resending={resendingId === invite.id}
            />
          ))
        )}

        <View style={styles.ctaSpacer} />
      </ScrollView>

      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={handleInvitePress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Invite a caretaker">
          <Text style={styles.ctaText}>Invite a caretaker</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.hemlock,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: viraTheme.colors.hemlock,
  },
  scroll: {
    paddingHorizontal: viraTheme.spacing.xl,
    paddingTop: viraTheme.spacing.lg,
    paddingBottom: viraTheme.spacing.xxl,
  },
  intro: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.butterMoon,
    opacity: 0.85,
    marginBottom: viraTheme.spacing.xl,
  },
  sectionHeader: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.thistle,
    marginBottom: viraTheme.spacing.md,
  },
  sectionHeaderSpaced: {
    marginTop: viraTheme.spacing.xl,
  },
  emptyCard: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.md,
  },
  emptyText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
  },
  caretakerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.sm,
    gap: viraTheme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: viraTheme.colors.hemlock,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
    fontSize: 14,
    letterSpacing: 0,
  },
  caretakerInfo: {
    flex: 1,
  },
  caretakerName: {
    ...viraTheme.typography.heading2,
    fontSize: 17,
    color: viraTheme.colors.lagoon,
    marginBottom: 2,
  },
  caretakerMeta: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
  },
  iconButton: {
    paddingHorizontal: viraTheme.spacing.md,
    paddingVertical: viraTheme.spacing.sm,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-Bold',
    color: viraTheme.colors.vermillion,
  },
  inviteCard: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.sm,
    opacity: 1,
  },
  inviteCardExpired: {
    opacity: 0.7,
  },
  inviteEmail: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 2,
  },
  inviteMeta: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.sm,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: viraTheme.spacing.lg,
  },
  resendButton: {
    paddingHorizontal: viraTheme.spacing.md,
    paddingVertical: viraTheme.spacing.sm,
    borderRadius: viraTheme.radius.sm,
    borderWidth: 1,
    borderColor: viraTheme.colors.hemlock,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButtonText: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-Bold',
    color: viraTheme.colors.hemlock,
  },
  cancelLink: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-Bold',
    color: viraTheme.colors.vermillion,
  },
  ctaSpacer: {
    height: viraTheme.spacing.xxxl,
  },
  ctaContainer: {
    padding: viraTheme.spacing.xl,
    paddingBottom: viraTheme.spacing.xxl,
    backgroundColor: viraTheme.colors.hemlock,
  },
  cta: {
    backgroundColor: viraTheme.colors.vermillion,
    borderRadius: viraTheme.radius.lg,
    paddingVertical: viraTheme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  ctaText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
  },
});
