import type {RootStackParamList} from '../types/navigation';
import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {useAuthStore} from '../store/useAuthStore';
import {signOut, getProfile, updateProfile} from '../services/auth';
import {ViraLeafMark} from '../components/ViraLeafMark';
import {PendingInviteCard} from '../components/PendingInviteCard';
import {
  listPendingInvitesForMe,
  acceptInvite,
  declineInvite,
} from '../services/caretakerService';
import type {PendingInvite} from '../services/caretakerService';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({navigation}) => {
  const user = useAuthStore(s => s.user);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  // Edit state for display name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Pending invitations (Phase 3)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPendingInvites = useCallback(async () => {
    try {
      const invites = await listPendingInvitesForMe();
      setPendingInvites(invites);
    } catch {
      // Failing silently here is intentional — the section only renders if
      // we get invites, so an error just leaves the user in the same state
      // as having none. Retry happens on pull-to-refresh or next mount.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then(profile => {
        const name =
          profile.displayName ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          null;
        setDisplayName(name);
        if (profile.createdAt) {
          setMemberSince(
            new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
            }).format(new Date(profile.createdAt)),
          );
        }
      })
      .catch(() => {
        // Fall back to auth metadata
        const name =
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          null;
        setDisplayName(name);
      })
      .finally(() => setProfileLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadPendingInvites();
  }, [user, loadPendingInvites]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPendingInvites();
    } finally {
      setRefreshing(false);
    }
  }, [loadPendingInvites]);

  const handleAcceptInvite = useCallback(
    async (inviteId: string) => {
      await acceptInvite(inviteId);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      // TODO(phase-4): trigger useGardenStore.loadGardens() refresh; in phase 4
      // the accepted garden becomes visible in the home header garden list,
      // which is the durable confirmation surface.
    },
    [],
  );

  const handleDeclineInvite = useCallback(
    async (inviteId: string) => {
      await declineInvite(inviteId);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    },
    [],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  }, []);

  const handleStartEditName = useCallback(() => {
    setEditName(displayName || '');
    setIsEditingName(true);
  }, [displayName]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
    setEditName('');
  }, []);

  const handleSaveName = useCallback(async () => {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }
    setIsSavingName(true);
    try {
      await updateProfile(user.id, {displayName: trimmed});
      setDisplayName(trimmed);
      setIsEditingName(false);
    } catch {
      Alert.alert(
        "Couldn't save your name",
        'Please try again.',
      );
    } finally {
      setIsSavingName(false);
    }
  }, [user, editName]);

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
        <View style={styles.header}>
          <ViraLeafMark size={32} variant="butterMoon" />
          <Text style={styles.heading}>Settings</Text>
        </View>

        {pendingInvites.length > 0 ? (
          <View style={styles.pendingSection}>
            <Text style={styles.sectionHeader}>Pending invitations</Text>
            {pendingInvites.map(invite => (
              <PendingInviteCard
                key={invite.id}
                invite={invite}
                onAccept={() => handleAcceptInvite(invite.id)}
                onDecline={() => handleDeclineInvite(invite.id)}
              />
            ))}
          </View>
        ) : null}

        {profileLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={viraTheme.colors.hemlock} size="small" />
          </View>
        ) : (
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <ViraLeafMark size={40} variant="hemlock" />
            </View>

            {isEditingName ? (
              <View style={styles.nameEditContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor={viraTheme.colors.textMuted}
                  maxLength={50}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  accessibilityLabel="Display name"
                />
                <View style={styles.nameEditActions}>
                  <TouchableOpacity
                    onPress={handleCancelEditName}
                    disabled={isSavingName}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing name">
                    <Text style={styles.nameCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveName}
                    disabled={isSavingName}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    accessibilityRole="button"
                    accessibilityLabel="Save display name">
                    {isSavingName ? (
                      <ActivityIndicator
                        color={viraTheme.colors.vermillion}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.nameSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.nameRow}>
                {displayName ? (
                  <Text style={styles.displayName}>{displayName}</Text>
                ) : (
                  <Text style={[styles.displayName, styles.displayNameEmpty]}>
                    Add your name
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleStartEditName}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel="Edit display name">
                  <Text style={styles.editNameLabel}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}

            {user?.email ? (
              <Text style={styles.email}>{user.email}</Text>
            ) : null}

            {memberSince ? (
              <Text style={styles.memberSince}>
                Member since {memberSince}
              </Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={styles.navRow}
          onPress={() => navigation.navigate('ManageCaretakers')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Manage caretakers">
          <View style={styles.navRowLabelContainer}>
            <Text style={styles.navRowLabel}>Caretakers</Text>
            <Text style={styles.navRowHelp}>
              Invite someone to help care for your plants
            </Text>
          </View>
          <Text style={styles.navRowChevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.buttonDisabled]}
          onPress={handleSignOut}
          activeOpacity={0.7}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out">
          <Text style={styles.signOutText}>
            {isSigningOut ? 'Signing out...' : 'SIGN OUT'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.hemlock,
  },
  scroll: {
    padding: viraTheme.spacing.xxl,
    paddingBottom: viraTheme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: viraTheme.spacing.md,
    marginBottom: viraTheme.spacing.xxl,
  },
  heading: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.butterMoon,
  },
  pendingSection: {
    marginBottom: viraTheme.spacing.xxl,
  },
  sectionHeader: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.thistle,
    marginBottom: viraTheme.spacing.md,
  },
  loadingCard: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.xxxl,
    alignItems: 'center',
    marginBottom: viraTheme.spacing.xxl,
  },
  profileCard: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.xl,
    alignItems: 'center',
    marginBottom: viraTheme.spacing.xxl,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: viraTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: viraTheme.spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: viraTheme.spacing.sm,
    marginBottom: viraTheme.spacing.xs,
  },
  displayName: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.lagoon,
    textAlign: 'center',
  },
  displayNameEmpty: {
    color: viraTheme.colors.textMuted,
    fontStyle: 'italic',
  },
  editNameLabel: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: viraTheme.colors.luxor,
  },
  nameEditContainer: {
    width: '100%',
    marginBottom: viraTheme.spacing.sm,
  },
  nameInput: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.lagoon,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: viraTheme.colors.thistle,
    paddingVertical: viraTheme.spacing.xs,
    minHeight: 44,
  },
  nameEditActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: viraTheme.spacing.xl,
    marginTop: viraTheme.spacing.sm,
  },
  nameCancelText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
    fontSize: 13,
  },
  nameSaveText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.vermillion,
    fontSize: 13,
  },
  email: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.sm,
    textAlign: 'center',
  },
  memberSince: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.lg,
    paddingVertical: viraTheme.spacing.lg,
    paddingHorizontal: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.lg,
    minHeight: 48,
  },
  navRowLabelContainer: {
    flex: 1,
    paddingRight: viraTheme.spacing.md,
  },
  navRowLabel: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-SemiBold',
    color: viraTheme.colors.lagoon,
    marginBottom: 2,
  },
  navRowHelp: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
  },
  navRowChevron: {
    fontSize: 28,
    color: viraTheme.colors.hemlock,
  },
  signOutButton: {
    paddingVertical: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.vermillion,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: viraTheme.spacing.xxxl,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
  },
});
