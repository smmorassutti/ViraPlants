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
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {useAuthStore} from '../store/useAuthStore';
import {signOut, getProfile, updateProfile} from '../services/auth';
import {ViraLeafMark} from '../components/ViraLeafMark';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const user = useAuthStore(s => s.user);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  // Edit state for display name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

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
      <View style={styles.header}>
        <ViraLeafMark size={32} variant="butterMoon" />
        <Text style={styles.heading}>Settings</Text>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.hemlock,
    padding: viraTheme.spacing.xxl,
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
