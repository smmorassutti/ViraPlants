import type {RootStackParamList} from '../types/navigation';
import React, {useState, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {useAuthStore} from '../store/useAuthStore';
import {signOut} from '../services/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const user = useAuthStore(s => s.user);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      {user?.email ? (
        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>SIGNED IN AS</Text>
          <Text style={styles.accountEmail}>{user.email}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
        disabled={isSigningOut}>
        <Text style={styles.signOutText}>
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.background,
    padding: viraTheme.spacing.xxl,
  },
  heading: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.xl,
  },
  accountCard: {
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
    marginBottom: viraTheme.spacing.xxl,
  },
  accountLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.xs,
  },
  accountEmail: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.xxl,
    borderRadius: viraTheme.radius.pill,
    borderWidth: 1,
    borderColor: viraTheme.colors.error,
    alignSelf: 'center',
  },
  signOutText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.error,
    fontSize: 14,
  },
});
