import type { RootStackParamList } from '../types/navigation';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { viraTheme } from '../theme/vira';
import { usePlantStore } from '../store/usePlantStore';
import { useAuthStore } from '../store/useAuthStore';
import { pickImage } from '../utils/pickImage';
import { uploadPlantPhoto } from '../services/photoService';
import { analyzePlant, AnalysisError } from '../services/aiService';

const { colors, spacing, radius, typography } = viraTheme;

type Props = NativeStackScreenProps<RootStackParamList, 'AddPlant'>;

// ─── Light orientation options ───
const LIGHT_OPTIONS = [
  'South, bright direct',
  'South, bright indirect',
  'East, morning light',
  'West, afternoon light',
  'North, low light',
  'Artificial light',
];

// ─── Pot size options ───
const POT_SIZES = ['4"', '6"', '8"', '10"', '12"', '14"+'];

// ─── Progress bar ───
const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <View style={s.progressRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          s.progressSegment,
          { backgroundColor: i < current ? colors.hemlock : colors.border },
        ]}
      />
    ))}
  </View>
);

// ─── Selectable chip ───
const Chip = ({
  label,
  selected,
  onPress,
  flex,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  flex?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[
      s.chip,
      selected && s.chipSelected,
      flex && { flex: 1 },
    ]}
  >
    <Text
      style={[
        s.chipLabel,
        selected && s.chipLabelSelected,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AddPlantScreen: React.FC<Props> = ({ navigation, route }) => {
  const defaultLocation = route.params?.defaultLocation || '';
  const addPlant = usePlantStore(s => s.addPlant);
  const updatePlant = usePlantStore(s => s.updatePlant);
  const profile = usePlantStore(s => s.profile);
  const userId = useAuthStore(s => s.user?.id);

  // ─── State ───
  const [step, setStep] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState(
    defaultLocation || profile?.location || '',
  );
  const [orientation, setOrientation] = useState('');
  const [potSize, setPotSize] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    name: string;
    health: string;
    careNotes: string;
    waterFrequencyDays: number;
    fertilizeFrequencyDays: number;
    warning?: string;
  } | null>(null);

  // ─── Photo selection ───
  const handlePickPhoto = useCallback(async () => {
    const uri = await pickImage('library');
    if (uri) setPhotoUri(uri);
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const uri = await pickImage('camera');
    if (uri) setPhotoUri(uri);
  }, []);

  const handleChoosePhoto = useCallback(() => {
    Alert.alert('Add a photo', 'How would you like to add your plant photo?', [
      {text: 'Take Photo', onPress: handleTakePhoto},
      {text: 'Choose from Library', onPress: handlePickPhoto},
      {text: 'Cancel', style: 'cancel'},
    ]);
  }, [handleTakePhoto, handlePickPhoto]);

  // ─── Analysis ───
  const handleAnalyze = useCallback(async () => {
    if (!photoUri || !userId) return;

    setIsAnalyzing(true);
    try {
      // Upload photo first to get the Storage URL for Vision
      const remoteUrl = await uploadPlantPhoto(userId, 'pending', photoUri);

      const result = await analyzePlant({
        imageUrl: remoteUrl,
        context: {
          light: orientation || undefined,
          location: location || undefined,
        },
      });

      setAnalysisResult(result);
      // Store the remote URL so handleSave doesn't re-upload
      setPhotoUri(remoteUrl);
      setStep(3);

      if (result.warning) {
        Alert.alert('Heads up', result.warning);
      }
    } catch (error) {
      if (error instanceof AnalysisError) {
        switch (error.code) {
          case 'not_a_plant':
            Alert.alert(
              'Not a plant',
              'That doesn\'t look like a plant. Please try again with a clear photo of your plant.',
              [{ text: 'OK' }],
            );
            break;
          case 'rate_limited':
            Alert.alert(
              'Daily limit reached',
              error.message,
              [
                { text: 'Add Manually', onPress: () => setStep(3) },
                { text: 'OK' },
              ],
            );
            break;
          case 'unauthorized':
            Alert.alert('Session expired', 'Please log in again.');
            break;
          default:
            Alert.alert(
              'Couldn\'t identify your plant',
              'You can still add it manually.',
              [
                { text: 'Add Manually', onPress: () => setStep(3) },
                { text: 'Try Again' },
              ],
            );
        }
      } else {
        Alert.alert(
          'Connection error',
          'Please check your internet and try again.',
          [
            { text: 'Add Manually', onPress: () => setStep(3) },
            { text: 'Try Again' },
          ],
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [photoUri, location, orientation, userId]);

  // ─── Save plant ───
  const handleSave = useCallback(async () => {
    if (!analysisResult) return;

    const plant = await addPlant({
      name: analysisResult.name,
      nickname: nickname || 'My Plant',
      location,
      orientation,
      potSize,
      photoUrl: photoUri || undefined,
      health: analysisResult.health,
      careNotes: analysisResult.careNotes,
      waterFrequencyDays: analysisResult.waterFrequencyDays,
      fertilizeFrequencyDays: analysisResult.fertilizeFrequencyDays,
      connectionType: 'manual',
    });

    // Upload photo if it's still a local URI (not yet uploaded by handleAnalyze)
    const isRemoteUrl = photoUri?.startsWith('http');
    if (photoUri && userId && plant.id && !isRemoteUrl) {
      uploadPlantPhoto(userId, plant.id, photoUri)
        .then((remoteUrl) => {
          updatePlant(plant.id, {photoUrl: remoteUrl});
        })
        .catch((err) => {
          console.warn('Photo upload failed, keeping local URI:', err);
        });
    }

    navigation.replace('Home');
  }, [analysisResult, nickname, location, orientation, potSize, photoUri, addPlant, updatePlant, userId, navigation]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1: Photo
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderStep1 = () => (
    <View style={s.stepContainer}>
      <View>
        <Text style={s.stepTitle}>Let's meet your plant</Text>
        <Text style={s.stepBody}>
          Take a photo and Vira will identify the species and build a care plan.
        </Text>

        {!photoUri ? (
          <TouchableOpacity
            style={s.photoUpload}
            onPress={handleChoosePhoto}
            activeOpacity={0.8}
          >
            <View style={s.photoUploadIcon}>
              <Text style={{ fontSize: 28 }}>📷</Text>
            </View>
            <Text style={s.photoUploadLabel}>Tap to add a photo</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.photoPreviewContainer}>
            <Image
              source={{ uri: photoUri }}
              style={s.photoPreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={s.photoRemove}
              onPress={() => setPhotoUri(null)}
              activeOpacity={0.8}
            >
              <Text style={s.photoRemoveLabel}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.primaryButton, !photoUri && s.primaryButtonDisabled]}
        onPress={() => photoUri && setStep(2)}
        activeOpacity={0.85}
        disabled={!photoUri}
      >
        <Text style={s.primaryButtonLabel}>CONTINUE</Text>
      </TouchableOpacity>
    </View>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 2: Details
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderStep2 = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={s.stepTitle}>A bit about the setup</Text>
        <Text style={s.stepBody}>
          Helps Vira tailor care to your environment.
        </Text>

        {/* Nickname */}
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>NICKNAME</Text>
          <TextInput
            style={s.textInput}
            placeholder="e.g., Monty"
            placeholderTextColor={colors.textMuted}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="words"
            returnKeyType="next"
            maxLength={50}
          />
        </View>

        {/* Location */}
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>CITY</Text>
          <TextInput
            style={s.textInput}
            placeholder="e.g., Vancouver, BC"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={100}
          />
          {location === (defaultLocation || profile?.location) && location !== '' && (
            <Text style={s.inputHint}>Pre-filled from your setup</Text>
          )}
        </View>

        {/* Light orientation */}
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>LIGHT</Text>
          <View style={s.chipWrap}>
            {LIGHT_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={orientation === opt}
                onPress={() => setOrientation(opt)}
              />
            ))}
          </View>
        </View>

        {/* Pot size */}
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>POT SIZE</Text>
          <View style={s.chipRow}>
            {POT_SIZES.map((size) => (
              <Chip
                key={size}
                label={size}
                selected={potSize === size}
                onPress={() => setPotSize(size)}
                flex
              />
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[s.primaryButton, { marginTop: spacing.xl }]}
        onPress={handleAnalyze}
        activeOpacity={0.85}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={colors.white} size="small" />
            <Text style={s.primaryButtonLabel}>Identifying your plant...</Text>
          </View>
        ) : (
          <Text style={s.primaryButtonLabel}>✦  LET'S GO</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 3: Results
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderStep3 = () => {
    if (!analysisResult) return null;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Species badge */}
        <View style={s.resultHero}>
          <View style={s.resultIcon}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
          </View>
          <Text style={s.resultName}>{analysisResult.name}</Text>
          <Text style={s.resultSubtitle}>Your care plan is ready</Text>
        </View>

        {/* Care notes */}
        <View style={s.careCard}>
          <Text style={s.careCardLabel}>✦  CARE PLAN</Text>
          <Text style={s.careCardBody}>{analysisResult.careNotes}</Text>
        </View>

        {/* Schedule cards */}
        <View style={s.scheduleRow}>
          <View style={[s.scheduleCard, { backgroundColor: colors.scheduleWater }]}>
            <Text style={s.scheduleLabel}>Water every</Text>
            <Text style={s.scheduleValue}>
              {analysisResult.waterFrequencyDays}d
            </Text>
          </View>
          <View style={[s.scheduleCard, { backgroundColor: colors.scheduleFertilize }]}>
            <Text style={s.scheduleLabel}>Fertilize every</Text>
            <Text style={s.scheduleValue}>
              {analysisResult.fertilizeFrequencyDays}d
            </Text>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={s.primaryButton}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={s.primaryButtonLabel}>✓  DONE</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Main render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <View style={s.screen}>
      {/* Header with back button */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (step > 1 && step < 3) {
              setStep(step - 1);
            } else {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
          style={s.backButton}
        >
          <Text style={s.backLabel}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {step === 3 ? '' : 'ADD PLANT'}
        </Text>
        <View style={s.backButton} />
      </View>

      {/* Progress */}
      <ProgressBar current={step} total={3} />

      {/* Step content */}
      <View style={{ flex: 1 }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>
    </View>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    ...typography.label,
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  // Step container (for steps that don't scroll)
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },

  // Scroll content (for steps that scroll)
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 40,
  },

  // Step text
  stepTitle: {
    ...typography.heading1,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stepBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },

  // Photo upload
  photoUpload: {
    width: '100%',
    height: 220,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.thistle,
    backgroundColor: colors.butterMoon,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  photoUploadIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Photo preview
  photoPreviewContainer: {
    width: '100%',
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Inputs
  inputGroup: {
    marginBottom: spacing.xl,
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
    color: colors.luxor,
    marginTop: spacing.xs,
    fontWeight: '500',
  },

  // Chips (selectable options)
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderColor: colors.hemlock,
    borderWidth: 2,
    backgroundColor: colors.butterMoon,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'center',
  },
  chipLabelSelected: {
    color: colors.hemlock,
    fontWeight: '700',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Results
  resultHero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.butterMoon,
    borderWidth: 2,
    borderColor: `${colors.thistle}44`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  resultName: {
    ...typography.heading2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  resultSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
  },

  // Care card
  careCard: {
    backgroundColor: colors.butterMoon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.thistle}44`,
  },
  careCardLabel: {
    ...typography.label,
    color: colors.luxor,
    marginBottom: spacing.sm,
  },
  careCardBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 14,
  },

  // Schedule cards
  scheduleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  scheduleCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  scheduleLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  scheduleValue: {
    ...typography.heading1,
    fontSize: 26,
    color: colors.textPrimary,
  },

  // Buttons
  primaryButton: {
    paddingVertical: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.vermillion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryButtonLabel: {
    ...typography.button,
    color: colors.white,
  },
});

