import type {RootStackParamList} from '../types/navigation';
import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {inviteCaretaker, CaretakerError} from '../services/caretakerService';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteCaretaker'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_EXPIRY_DAYS = 14;

const toIsoStartOfDay = (date: Date): string => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
};

const formatShortDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

const mapErrorCodeToMessage = (code: string): string => {
  switch (code) {
    case 'invalid_email':
      return "That doesn't look like a valid email address.";
    case 'already_invited':
      return "You've already invited this person. Check your pending invites.";
    case 'already_caretaker':
      return 'This person is already caring for your garden.';
    case 'self_invite':
      return "You can't invite yourself.";
    case 'email_send_failed':
      return "Couldn't send the invitation. Please try again.";
    default:
      return 'Something went wrong. Please try again.';
  }
};

export const InviteCaretakerScreen: React.FC<Props> = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
    return d;
  });
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = useMemo(() => EMAIL_REGEX.test(trimmedEmail), [trimmedEmail]);

  const handleToggleExpiry = useCallback((value: boolean) => {
    setExpiryEnabled(value);
  }, []);

  const adjustExpiry = useCallback(
    (deltaDays: number) => {
      const next = new Date(expiryDate);
      next.setDate(next.getDate() + deltaDays);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (next.getTime() < tomorrow.getTime()) return;
      setExpiryDate(next);
    },
    [expiryDate],
  );

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSend = useCallback(async () => {
    if (!emailValid || submitting) return;
    setInlineError(null);
    setSubmitting(true);
    try {
      const opts = expiryEnabled
        ? {expiresAt: toIsoStartOfDay(expiryDate)}
        : undefined;
      await inviteCaretaker(trimmedEmail, opts);
      Alert.alert('Invitation sent', `We sent an invite to ${trimmedEmail}.`);
      navigation.goBack();
    } catch (err) {
      const code = err instanceof CaretakerError ? err.code : 'unknown';
      setInlineError(mapErrorCodeToMessage(code));
    } finally {
      setSubmitting(false);
    }
  }, [emailValid, submitting, expiryEnabled, expiryDate, trimmedEmail, navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoid}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Invite a caretaker</Text>
          <Text style={styles.subheading}>
            They'll get an email to accept the invite from their Vira app.
          </Text>

          <Text style={styles.label}>Caretaker email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (inlineError) setInlineError(null);
            }}
            placeholder="friend@example.com"
            placeholderTextColor={viraTheme.colors.textMuted}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel="Caretaker email"
          />

          <View style={styles.expiryRow}>
            <View style={styles.expiryLabelContainer}>
              <Text style={styles.expiryLabel}>Set an expiry</Text>
              <Text style={styles.expiryHelp}>
                Good for short-term help like vacation coverage.
              </Text>
            </View>
            <Switch
              value={expiryEnabled}
              onValueChange={handleToggleExpiry}
              trackColor={{
                false: viraTheme.colors.thistle,
                true: viraTheme.colors.luxor,
              }}
              thumbColor={viraTheme.colors.butterMoon}
              accessibilityLabel="Set an expiry date for this caretaker"
            />
          </View>

          {expiryEnabled ? (
            <View style={styles.expiryControls}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustExpiry(-1)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Shorten expiry by one day">
                <Text style={styles.stepperText}>{'−'}</Text>
              </TouchableOpacity>
              <View style={styles.expiryDateContainer}>
                <Text style={styles.expiryDateLabel}>Expires on</Text>
                <Text style={styles.expiryDateValue}>
                  {formatShortDate(expiryDate)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustExpiry(1)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Extend expiry by one day">
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {inlineError ? (
            <View
              style={styles.errorContainer}
              accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{inlineError}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Cancel invite">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!emailValid || submitting) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!emailValid || submitting}
            accessibilityRole="button"
            accessibilityLabel="Send invite">
            {submitting ? (
              <ActivityIndicator color={viraTheme.colors.butterMoon} size="small" />
            ) : (
              <Text style={styles.sendText}>Send invite</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  scroll: {
    padding: viraTheme.spacing.xl,
    paddingBottom: viraTheme.spacing.xxxl,
  },
  heading: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.sm,
  },
  subheading: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.xl,
  },
  label: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.sm,
  },
  input: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    backgroundColor: viraTheme.colors.white,
    borderWidth: 1,
    borderColor: viraTheme.colors.border,
    borderRadius: viraTheme.radius.md,
    paddingHorizontal: viraTheme.spacing.lg,
    paddingVertical: viraTheme.spacing.md,
    minHeight: 48,
    marginBottom: viraTheme.spacing.xl,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: viraTheme.spacing.md,
    paddingVertical: viraTheme.spacing.sm,
  },
  expiryLabelContainer: {
    flex: 1,
    paddingRight: viraTheme.spacing.md,
  },
  expiryLabel: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-SemiBold',
    color: viraTheme.colors.hemlock,
    marginBottom: 2,
  },
  expiryHelp: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
  },
  expiryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: viraTheme.colors.background,
    borderRadius: viraTheme.radius.md,
    padding: viraTheme.spacing.md,
    marginTop: viraTheme.spacing.md,
    marginBottom: viraTheme.spacing.xl,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: viraTheme.colors.butterMoon,
    borderWidth: 1,
    borderColor: viraTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.hemlock,
  },
  expiryDateContainer: {
    flex: 1,
    alignItems: 'center',
  },
  expiryDateLabel: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    marginBottom: 2,
  },
  expiryDateValue: {
    ...viraTheme.typography.heading2,
    fontSize: 18,
    color: viraTheme.colors.hemlock,
  },
  errorContainer: {
    backgroundColor: viraTheme.colors.overdueBackground,
    borderRadius: viraTheme.radius.md,
    padding: viraTheme.spacing.md,
    marginTop: viraTheme.spacing.md,
  },
  errorText: {
    ...viraTheme.typography.body,
    fontSize: 14,
    color: viraTheme.colors.error,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: viraTheme.spacing.md,
    padding: viraTheme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: viraTheme.colors.borderLight,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: viraTheme.radius.lg,
    borderWidth: 1,
    borderColor: viraTheme.colors.hemlock,
  },
  cancelText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
  },
  sendButton: {
    flex: 2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.vermillion,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
  },
});
