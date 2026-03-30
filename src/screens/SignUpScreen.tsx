import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {viraTheme} from '../theme/vira';
import {ViraLeafMark} from '../components/ViraLeafMark';
import {signUp} from '../services/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignUpScreen: React.FC<Props> = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = useCallback(async () => {
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(trimmedEmail, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, confirmPassword]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <ViraLeafMark size={40} color={viraTheme.colors.hemlock} />
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Start tracking your plants with Vira
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={viraTheme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor={viraTheme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={128}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              placeholderTextColor={viraTheme.colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              maxLength={128}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignUp}
            activeOpacity={0.85}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={viraTheme.colors.butterMoon} size="small" />
            ) : (
              <Text style={styles.primaryButtonLabel}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: viraTheme.spacing.xxl,
    paddingBottom: viraTheme.spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: viraTheme.spacing.xxxl,
  },
  logoMark: {
    marginBottom: viraTheme.spacing.lg,
  },
  title: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.xs,
  },
  subtitle: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: viraTheme.spacing.lg,
  },
  inputGroup: {
    gap: viraTheme.spacing.xs,
  },
  inputLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
  },
  input: {
    ...viraTheme.typography.body,
    paddingVertical: 14,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.md,
    borderWidth: 1.5,
    borderColor: viraTheme.colors.border,
    backgroundColor: viraTheme.colors.card,
    color: viraTheme.colors.textPrimary,
  },
  error: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.error,
    textAlign: 'center',
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.hemlock,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: viraTheme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: viraTheme.spacing.xxl,
  },
  footerText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
  },
  footerLink: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.luxor,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
  },
});
