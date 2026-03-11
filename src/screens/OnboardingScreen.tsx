import type { RootStackParamList } from '../types/navigation';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { viraTheme } from '../theme/vira';
import { usePlantStore } from '../store/usePlantStore';

const { colors, spacing, radius, typography } = viraTheme;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// ─── Dot indicator ───
const Dots = ({ current, total }: { current: number; total: number }) => (
  <View style={s.dotsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          s.dot,
          {
            width: i === current ? 24 : 8,
            backgroundColor: i === current ? colors.hemlock : colors.thistle,
          },
        ]}
      />
    ))}
  </View>
);

// ─── Toggle ───
const Toggle = ({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    activeOpacity={0.8}
    style={[s.toggle, { backgroundColor: value ? colors.hemlock : colors.border }]}
  >
    <Animated.View
      style={[s.toggleKnob, { left: value ? 22 : 3 }]}
    />
  </TouchableOpacity>
);

// ─── Feature row ───
const FeatureRow = ({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) => (
  <View style={s.featureRow}>
    <View style={s.featureIcon}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.featureDesc}>{desc}</Text>
    </View>
  </View>
);

// ─── Permission row ───
const PermissionRow = ({
  emoji,
  title,
  desc,
  value,
  onToggle,
}: {
  emoji: string;
  title: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
}) => (
  <View style={s.permRow}>
    <View style={s.permLeft}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View>
        <Text style={s.permTitle}>{title}</Text>
        <Text style={s.permDesc}>{desc}</Text>
      </View>
    </View>
    <Toggle value={value} onToggle={onToggle} />
  </View>
);

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState(0);
  const [city, setCity] = useState('');
  const [notifs, setNotifs] = useState(true);
  const [camera, setCamera] = useState(true);

  const { setProfile, setHasOnboarded } = usePlantStore();

  const completeOnboarding = (goToAddPlant: boolean) => {
    // Save profile with default location
    setProfile({
      defaultLocation: city || undefined,
    });
    setHasOnboarded(true);

    if (goToAddPlant) {
      navigation.replace('AddPlant', { defaultLocation: city || undefined });
    } else {
      navigation.replace('Home');
    }
  };

  const next = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // "ADD MY FIRST PLANT" tapped on screen 3
      completeOnboarding(true);
    }
  };

  const skip = () => completeOnboarding(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Screen 0: Welcome
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === 0) {
    return (
      <View style={[s.screen, { backgroundColor: colors.hemlock }]}>
        <View style={s.spacer} />
        <View style={s.centerContent}>
          {/* Vira leaf emblem — replace with your actual logo SVG/PNG asset */}
          <View style={s.welcomeEmblem}>
            {/* TODO: Replace with <Image source={require('../assets/vira-icon-light.png')} /> */}
            <Text style={{ fontSize: 48, color: colors.butterMoon }}>🌿</Text>
          </View>
          <Text style={s.welcomeTitle}>Meet Vira</Text>
          <Text style={s.welcomeBody}>
            Your quiet companion for plant care.{'\n'}
            We'll help you keep every plant thriving — no guesswork, no stress.
          </Text>
        </View>
        <View style={s.bottomActions}>
          <TouchableOpacity
            style={s.outlineButtonLight}
            onPress={next}
            activeOpacity={0.85}
          >
            <Text style={s.outlineButtonLightLabel}>GET STARTED →</Text>
          </TouchableOpacity>
          <Dots current={0} total={4} />
        </View>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Screen 1: How It Works
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === 1) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={s.topContent}>
          <Text style={s.eyebrow}>HOW IT WORKS</Text>
          <Text style={s.sectionTitle}>
            Plant care,{'\n'}simplified.
          </Text>
          <View style={s.featureList}>
            <FeatureRow
              emoji="📸"
              title="Snap a photo"
              desc="Vira identifies your plant and learns its needs"
            />
            <FeatureRow
              emoji="💧"
              title="Smart reminders"
              desc="Personalized watering and care schedules"
            />
            <FeatureRow
              emoji="✨"
              title="Health checks"
              desc="Upload a photo to check how your plant is doing"
            />
            <FeatureRow
              emoji="🪴"
              title="Vira Pot ready"
              desc="Connect a Vira pot for automatic watering"
            />
          </View>
        </View>
        <View style={s.bottomActions}>
          <TouchableOpacity
            style={s.primaryButton}
            onPress={next}
            activeOpacity={0.85}
          >
            <Text style={s.primaryButtonLabel}>CONTINUE</Text>
          </TouchableOpacity>
          <Dots current={1} total={4} />
        </View>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Screen 2: Quick Setup
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === 2) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={s.topContent}>
          <Text style={s.eyebrow}>QUICK SETUP</Text>
          <Text style={s.sectionTitle}>A little about you</Text>
          <Text style={s.sectionBody}>
            This helps Vira tailor care advice to your local climate and seasons.
          </Text>

          {/* City input */}
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>YOUR CITY</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g., Vancouver, BC"
              placeholderTextColor={colors.textMuted}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={s.inputHint}>
              Used once for all your plants. You can change it later.
            </Text>
          </View>

          {/* Permissions */}
          <View style={s.permList}>
            <PermissionRow
              emoji="🔔"
              title="Notifications"
              desc="Watering & care reminders"
              value={notifs}
              onToggle={() => setNotifs(!notifs)}
            />
            <PermissionRow
              emoji="📷"
              title="Camera"
              desc="Identify plants & check health"
              value={camera}
              onToggle={() => setCamera(!camera)}
            />
          </View>
        </View>
        <View style={s.bottomActions}>
          <TouchableOpacity
            style={s.primaryButton}
            onPress={next}
            activeOpacity={0.85}
          >
            <Text style={s.primaryButtonLabel}>CONTINUE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={skip} activeOpacity={0.7}>
            <Text style={s.skipLabel}>Skip for now</Text>
          </TouchableOpacity>
          <Dots current={2} total={4} />
        </View>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Screen 3: Add First Plant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === 3) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={s.centerContent}>
          <View style={s.firstPlantIcon}>
            <Text style={{ fontSize: 52 }}>🌱</Text>
          </View>
          <Text style={s.sectionTitle}>Add your first plant</Text>
          <Text style={[s.sectionBody, { textAlign: 'center', maxWidth: 260 }]}>
            Take a photo and Vira will identify it, learn its needs, and build a care plan just for your setup.
          </Text>
        </View>
        <View style={s.bottomActions}>
          <TouchableOpacity
            style={s.primaryButton}
            onPress={next}
            activeOpacity={0.85}
          >
            <Text style={s.primaryButtonLabel}>📷  ADD MY FIRST PLANT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={skip} activeOpacity={0.7}>
            <Text style={s.skipLabel}>I'll do this later</Text>
          </TouchableOpacity>
          <Dots current={3} total={4} />
        </View>
      </View>
    );
  }

  return null;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const s = StyleSheet.create({
  // Layout
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  spacer: {
    height: spacing.xxxl,
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  topContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  bottomActions: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 40,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Welcome screen (dark bg)
  welcomeEmblem: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: `${colors.butterMoon}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  welcomeTitle: {
    ...typography.heading1,
    fontSize: 34,
    color: colors.butterMoon,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  welcomeBody: {
    ...typography.body,
    color: colors.thistle,
    textAlign: 'center',
    lineHeight: 24,
  },
  outlineButtonLight: {
    paddingVertical: 18,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.butterMoon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonLightLabel: {
    ...typography.button,
    color: colors.butterMoon,
  },

  // Section headers
  eyebrow: {
    ...typography.label,
    color: colors.luxor,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading1,
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  // Features
  featureList: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.butterMoon,
    borderWidth: 1,
    borderColor: `${colors.thistle}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    ...typography.body,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  featureDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },

  // Inputs
  inputGroup: {
    marginBottom: spacing.xxl,
  },
  inputLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  textInput: {
    ...typography.body,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.textPrimary,
  },
  inputHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Permissions
  permList: {
    gap: spacing.md,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  permTitle: {
    ...typography.body,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 14,
  },
  permDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Toggle
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },

  // First plant screen
  firstPlantIcon: {
    width: 120,
    height: 120,
    borderRadius: 34,
    backgroundColor: colors.butterMoon,
    borderWidth: 2,
    borderColor: `${colors.thistle}44`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },

  // Buttons
  primaryButton: {
    paddingVertical: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.vermillion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    ...typography.button,
    color: '#FFFFFF',
  },
  skipLabel: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
    fontSize: 13,
  },
});