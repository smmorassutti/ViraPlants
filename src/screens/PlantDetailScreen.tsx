import type {RootStackParamList} from '../types/navigation';
import React, {useState, useCallback, useLayoutEffect, useMemo} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {usePlantStore} from '../store/usePlantStore';
import {CareCountdown} from '../components/CareCountdown';
import {MarkDoneButton} from '../components/MarkDoneButton';
import {ViraPotPlaceholder} from '../components/ViraPotPlaceholder';
import {pickImage} from '../utils/pickImage';
import {getLastCareDateOrUndefined} from '../utils/careUtils';
import {useAuthStore} from '../store/useAuthStore';
import {uploadPlantPhoto, deletePlantPhoto} from '../services/photoService';
import {analyzePlant, AnalysisError} from '../services/aiService';
import {
  scheduleWateringNotification,
  cancelWateringNotification,
} from '../services/notificationService';
import type {CareEvent, Plant} from '../types/plant';

type Props = NativeStackScreenProps<RootStackParamList, 'PlantDetail'>;

const HERO_HEIGHT = 300;

const POT_SIZES = ['4"', '6"', '8"', '10"', '12"', '14"+'];

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatEventDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const careEventEmoji = (type?: string): string => {
  switch (type) {
    case 'water':
      return '\u{1F4A7}';
    case 'fertilize':
      return '\u{1F331}';
    default:
      return '\u{2728}';
  }
};

const careEventLabel = (type?: string): string => {
  switch (type) {
    case 'water':
      return 'Watered';
    case 'fertilize':
      return 'Fertilized';
    default:
      return 'Care event';
  }
};

// ── Quick Stat Pill ──

const StatPill: React.FC<{label: string; value: string}> = ({
  label,
  value,
}) => (
  <View style={styles.statPill}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ── Care History Item ──

const HistoryItem: React.FC<{event: CareEvent}> = ({event}) => (
  <View style={styles.historyItem}>
    <Text style={styles.historyEmoji}>{careEventEmoji(event.type)}</Text>
    <View style={styles.historyInfo}>
      <Text style={styles.historyLabel}>{careEventLabel(event.type)}</Text>
      <Text style={styles.historyDate}>
        {formatEventDate(event.occurredAt || event.createdAt)}
      </Text>
    </View>
    {event.source === 'vira_pot' && (
      <View style={styles.autoBadge}>
        <Text style={styles.autoBadgeText}>AUTO</Text>
      </View>
    )}
  </View>
);

// ── Pot Size Chip ──

const PotSizeChip: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({label, selected, onPress}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[styles.potChip, selected && styles.potChipSelected]}
    accessibilityRole="button"
    accessibilityLabel={`Pot size ${label}`}
    accessibilityState={{selected}}>
    <Text
      style={[
        styles.potChipLabel,
        selected && styles.potChipLabelSelected,
      ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ── AI overrides shape for Re-identify ──
type AiOverrides = {
  name?: string;
  health?: string;
  careNotes?: string;
  waterFrequencyDays?: number;
  fertilizeFrequencyDays?: number;
};

// ── Main Screen ──

export const PlantDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const plant = usePlantStore(state =>
    state.plants.find(p => p.id === route.params.plantId),
  );
  const updatePlant = usePlantStore(s => s.updatePlant);
  const removePlant = usePlantStore(s => s.removePlant);
  const markWatered = usePlantStore(s => s.markWatered);
  const markFertilized = usePlantStore(s => s.markFertilized);
  const userId = useAuthStore(s => s.user?.id);

  // ── Notes state (existing) ──
  const [notesText, setNotesText] = useState(plant?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // ── Edit mode state ──
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPotSize, setEditPotSize] = useState('');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingUploadedUrl, setPendingUploadedUrl] = useState<string | null>(
    null,
  );
  const [aiOverrides, setAiOverrides] = useState<AiOverrides | null>(null);
  const [isReidentifying, setIsReidentifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const enterEditMode = useCallback(() => {
    if (!plant) return;
    setEditNickname(plant.nickname || '');
    setEditLocation(plant.location || '');
    setEditPotSize(plant.potSize || '');
    setPendingPhotoUri(null);
    setPendingUploadedUrl(null);
    setAiOverrides(null);
    setIsEditing(true);
  }, [plant]);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setPendingPhotoUri(null);
    setPendingUploadedUrl(null);
    setAiOverrides(null);
  }, []);

  // Header-right Edit button (hidden while editing — Save/Cancel are at bottom)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isEditing ? null : (
          <TouchableOpacity
            onPress={enterEditMode}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            accessibilityRole="button"
            accessibilityLabel="Edit plant">
            <Text style={styles.headerEditLabel}>Edit</Text>
          </TouchableOpacity>
        ),
    });
  }, [navigation, isEditing, enterEditMode]);

  const handleSaveNotes = useCallback(() => {
    if (plant?.id) {
      updatePlant(plant.id, {notes: notesText});
    }
    setIsEditingNotes(false);
  }, [plant?.id, notesText, updatePlant]);

  const handleRemovePlant = useCallback(() => {
    if (!plant?.id) return;
    Alert.alert(
      `Remove ${plant.nickname || plant.name || 'this plant'}?`,
      'This will permanently remove this plant and all its care history.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removePlant(plant.id);
            navigation.goBack();
          },
        },
      ],
    );
  }, [plant, removePlant, navigation]);

  const handleMarkWatered = useCallback(() => {
    if (plant?.id) markWatered(plant.id);
  }, [plant?.id, markWatered]);

  const handleMarkFertilized = useCallback(() => {
    if (plant?.id) markFertilized(plant.id);
  }, [plant?.id, markFertilized]);

  const uploadAndSetPhoto = useCallback(
    async (localUri: string) => {
      if (!plant?.id) return;
      // Show local URI immediately
      updatePlant(plant.id, {photoUrl: localUri});

      if (userId) {
        try {
          // Delete old remote photo if it exists
          if (plant.photoUrl?.includes('supabase')) {
            deletePlantPhoto(plant.photoUrl).catch(() => {});
          }
          const remoteUrl = await uploadPlantPhoto(userId, plant.id, localUri);
          updatePlant(plant.id, {photoUrl: remoteUrl});
        } catch (err) {
          console.warn('Photo upload failed, keeping local URI:', err);
        }
      }
    },
    [plant?.id, plant?.photoUrl, userId, updatePlant],
  );

  // Read-only hero tap: original behavior (immediate upload)
  const handleUpdatePhotoReadOnly = useCallback(() => {
    if (!plant?.id) return;
    Alert.alert('Update photo', 'How would you like to update your plant photo?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const uri = await pickImage('camera');
          if (uri) uploadAndSetPhoto(uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const uri = await pickImage('library');
          if (uri) uploadAndSetPhoto(uri);
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  }, [plant?.id, uploadAndSetPhoto]);

  // Edit-mode hero tap: stage the new URI locally, don't upload yet
  const handlePickPhotoInEdit = useCallback(() => {
    Alert.alert(
      'Update photo',
      'How would you like to update your plant photo?',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await pickImage('camera');
            if (uri) {
              setPendingPhotoUri(uri);
              setPendingUploadedUrl(null);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const uri = await pickImage('library');
            if (uri) {
              setPendingPhotoUri(uri);
              setPendingUploadedUrl(null);
            }
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  }, []);

  const handleReidentify = useCallback(async () => {
    if (!plant?.id || !userId) return;
    setIsReidentifying(true);
    try {
      // Need a Storage URL for the Edge Function.
      let imageUrl: string | null = null;

      if (pendingPhotoUri) {
        // New photo — upload if not already uploaded.
        if (pendingUploadedUrl) {
          imageUrl = pendingUploadedUrl;
        } else {
          const remoteUrl = await uploadPlantPhoto(
            userId,
            plant.id,
            pendingPhotoUri,
          );
          setPendingUploadedUrl(remoteUrl);
          imageUrl = remoteUrl;
        }
      } else if (plant.photoUrl?.startsWith('http')) {
        imageUrl = plant.photoUrl;
      }

      if (!imageUrl) {
        Alert.alert(
          'Need a photo',
          'Add a photo first so Vira can get to know your plant.',
        );
        return;
      }

      const result = await analyzePlant({
        imageUrl,
        context: {
          light: plant.orientation || undefined,
          location: editLocation || plant.location || undefined,
        },
      });

      setAiOverrides({
        name: result.name,
        health: result.health,
        careNotes: result.careNotes,
        waterFrequencyDays: result.waterFrequencyDays,
        fertilizeFrequencyDays: result.fertilizeFrequencyDays,
      });

      if (result.warning) {
        Alert.alert('Heads up', result.warning);
      }
    } catch (error) {
      if (error instanceof AnalysisError) {
        switch (error.code) {
          case 'not_a_plant':
            Alert.alert(
              'Not a plant',
              "That doesn't look like a plant. Try a clearer photo of your plant.",
            );
            break;
          case 'rate_limited':
            Alert.alert('Daily limit reached', error.message);
            break;
          case 'unauthorized':
            Alert.alert('Session expired', 'Please sign in again.');
            break;
          default:
            Alert.alert(
              "Couldn't identify your plant",
              'Please try again in a moment.',
            );
        }
      } else {
        Alert.alert(
          'Connection error',
          "Couldn't reach Vira. Please check your internet and try again.",
        );
      }
    } finally {
      setIsReidentifying(false);
    }
  }, [
    plant?.id,
    plant?.photoUrl,
    plant?.orientation,
    plant?.location,
    userId,
    pendingPhotoUri,
    pendingUploadedUrl,
    editLocation,
  ]);

  const handleSaveEdits = useCallback(async () => {
    if (!plant?.id) return;
    setIsSaving(true);
    try {
      const updates: Partial<Plant> = {};

      if (editNickname !== (plant.nickname || '')) {
        updates.nickname = editNickname;
      }
      if (editLocation !== (plant.location || '')) {
        updates.location = editLocation;
      }
      if (editPotSize !== (plant.potSize || '')) {
        updates.potSize = editPotSize;
      }

      // Photo
      let newPhotoUrl: string | undefined;
      if (pendingPhotoUri) {
        if (pendingUploadedUrl) {
          // Already uploaded (during re-identify)
          newPhotoUrl = pendingUploadedUrl;
        } else if (userId) {
          try {
            newPhotoUrl = await uploadPlantPhoto(
              userId,
              plant.id,
              pendingPhotoUri,
            );
          } catch (err) {
            console.warn('Photo upload failed:', err);
            Alert.alert(
              "Couldn't save your changes",
              "We couldn't upload the new photo. Please try again.",
            );
            return;
          }
        }

        if (newPhotoUrl && newPhotoUrl !== plant.photoUrl) {
          updates.photoUrl = newPhotoUrl;
          // Delete old remote photo
          if (plant.photoUrl?.includes('supabase')) {
            deletePlantPhoto(plant.photoUrl).catch(() => {});
          }
        }
      }

      // Merge AI overrides (only if re-identified)
      if (aiOverrides) {
        if (aiOverrides.name !== undefined) updates.name = aiOverrides.name;
        if (aiOverrides.health !== undefined)
          updates.health = aiOverrides.health;
        if (aiOverrides.careNotes !== undefined)
          updates.careNotes = aiOverrides.careNotes;
        if (aiOverrides.waterFrequencyDays !== undefined)
          updates.waterFrequencyDays = aiOverrides.waterFrequencyDays;
        if (aiOverrides.fertilizeFrequencyDays !== undefined)
          updates.fertilizeFrequencyDays = aiOverrides.fertilizeFrequencyDays;
      }

      if (Object.keys(updates).length === 0) {
        exitEditMode();
        return;
      }

      updatePlant(plant.id, updates);

      // Reschedule watering notification if cadence changed
      if (updates.waterFrequencyDays !== undefined) {
        const updatedPlant: Plant = {
          ...plant,
          ...updates,
        };
        cancelWateringNotification(plant.id)
          .then(() => scheduleWateringNotification(updatedPlant))
          .catch(() => {});
      }

      exitEditMode();
    } catch (err) {
      console.warn('Save edits failed:', err);
      Alert.alert(
        "Couldn't save your changes",
        'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    plant,
    editNickname,
    editLocation,
    editPotSize,
    pendingPhotoUri,
    pendingUploadedUrl,
    aiOverrides,
    userId,
    updatePlant,
    exitEditMode,
  ]);

  const handleCancelEdits = useCallback(() => {
    // If we uploaded a photo to Storage for re-identify but user cancels,
    // clean it up.
    if (pendingUploadedUrl) {
      deletePlantPhoto(pendingUploadedUrl).catch(() => {});
    }
    exitEditMode();
  }, [pendingUploadedUrl, exitEditMode]);

  // Computed display values (show pending edits while in edit mode)
  const displayNickname = isEditing
    ? editNickname
    : plant?.nickname || 'Unnamed plant';
  const displaySpecies =
    (isEditing && aiOverrides?.name) ||
    plant?.name ||
    'Unknown species';
  const displayPhotoUri = useMemo(() => {
    if (isEditing && pendingPhotoUri) return pendingPhotoUri;
    return plant?.photoUrl;
  }, [isEditing, pendingPhotoUri, plant?.photoUrl]);

  if (!plant) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundEmoji}>{'\u{1FAB4}'}</Text>
        <Text style={styles.notFoundText}>
          We couldn't find this plant. It may have been removed.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recentEvents = [...plant.careEvents]
    .sort(
      (a, b) =>
        new Date(b.occurredAt || b.createdAt || 0).getTime() -
        new Date(a.occurredAt || a.createdAt || 0).getTime(),
    )
    .slice(0, 10);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        {/* ── Hero Photo ── */}
        <TouchableOpacity
          style={styles.heroContainer}
          onPress={isEditing ? handlePickPhotoInEdit : handleUpdatePhotoReadOnly}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            isEditing ? 'Change plant photo' : 'Update plant photo'
          }>
          {displayPhotoUri ? (
            <Image
              source={{uri: displayPhotoUri}}
              style={styles.heroImage}
              accessibilityLabel={`Photo of ${plant.nickname || 'plant'}`}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderEmoji}>{'\u{1FAB4}'}</Text>
              <Text style={styles.heroPlaceholderText}>Tap to add a photo</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.heroTextContainer}>
            {isEditing ? (
              <TextInput
                style={styles.heroNicknameInput}
                value={editNickname}
                onChangeText={setEditNickname}
                placeholder="Plant nickname"
                placeholderTextColor={viraTheme.colors.whiteTranslucent}
                maxLength={50}
                autoCapitalize="words"
                accessibilityLabel="Plant nickname"
              />
            ) : (
              <Text style={styles.heroNickname}>{displayNickname}</Text>
            )}
            <Text style={styles.heroSpecies}>{displaySpecies}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Re-identify (edit mode only) ── */}
        {isEditing && (
          <View style={styles.reidentifySection}>
            <TouchableOpacity
              style={styles.reidentifyButton}
              onPress={handleReidentify}
              disabled={isReidentifying}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Re-identify plant with AI">
              {isReidentifying ? (
                <View style={styles.reidentifyRow}>
                  <ActivityIndicator
                    color={viraTheme.colors.hemlock}
                    size="small"
                  />
                  <Text style={styles.reidentifyLabel}>
                    Getting to know your plant...
                  </Text>
                </View>
              ) : (
                <Text style={styles.reidentifyLabel}>
                  ✦  Re-identify plant
                </Text>
              )}
            </TouchableOpacity>
            {aiOverrides?.name && (
              <Text style={styles.reidentifySuccess}>
                Updated species: {aiOverrides.name}
              </Text>
            )}
          </View>
        )}

        {/* ── Quick Stats (read-only) or Edit Fields ── */}
        {isEditing ? (
          <View style={styles.editFieldsContainer}>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>LOCATION</Text>
              <TextInput
                style={styles.editTextInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="e.g., Living room window"
                placeholderTextColor={viraTheme.colors.textMuted}
                maxLength={100}
                autoCapitalize="words"
                accessibilityLabel="Plant location"
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>POT SIZE</Text>
              <View style={styles.potChipRow}>
                {POT_SIZES.map(size => (
                  <PotSizeChip
                    key={size}
                    label={size}
                    selected={editPotSize === size}
                    onPress={() => setEditPotSize(size)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <StatPill
              label="Water"
              value={`Every ${plant.waterFrequencyDays || 7}d`}
            />
            <StatPill
              label="Fertilize"
              value={`Every ${plant.fertilizeFrequencyDays || 30}d`}
            />
            <StatPill label="Added" value={formatDate(plant.createdAt)} />
          </View>
        )}

        {/* ── Care Countdowns + Mark Done (read-only mode only) ── */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CARE SCHEDULE</Text>
            <View style={styles.careRow}>
              <View style={styles.careCard}>
                <CareCountdown plant={plant} type="water" />
                <View style={styles.markDoneWrapper}>
                  <MarkDoneButton
                    type="water"
                    onPress={handleMarkWatered}
                    lastDone={getLastCareDateOrUndefined(plant, 'water')}
                  />
                </View>
              </View>
              <View style={styles.careCard}>
                <CareCountdown plant={plant} type="fertilize" />
                <View style={styles.markDoneWrapper}>
                  <MarkDoneButton
                    type="fertilize"
                    onPress={handleMarkFertilized}
                    lastDone={getLastCareDateOrUndefined(plant, 'fertilize')}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── AI Care Notes (read-only mode only) ── */}
        {!isEditing && plant.careNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CARE TIPS</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{plant.careNotes}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Editable Notes (read-only mode only) ── */}
        {!isEditing && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>YOUR NOTES</Text>
              {!isEditingNotes && (
                <TouchableOpacity
                  onPress={() => setIsEditingNotes(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    notesText ? 'Edit notes' : 'Add notes'
                  }>
                  <Text style={styles.editLink}>
                    {notesText ? 'Edit' : 'Add'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {isEditingNotes ? (
              <View style={styles.notesCard}>
                <TextInput
                  style={styles.notesInput}
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder="Add personal notes about this plant..."
                  placeholderTextColor={viraTheme.colors.textMuted}
                  multiline
                  autoFocus
                  maxLength={500}
                  accessibilityLabel="Personal notes"
                />
                <View style={styles.notesActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setNotesText(plant.notes || '');
                      setIsEditingNotes(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel notes edit">
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveNotes}
                    accessibilityRole="button"
                    accessibilityLabel="Save notes">
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.notesCard}>
                <Text
                  style={[
                    styles.notesText,
                    !notesText && styles.notesPlaceholder,
                  ]}>
                  {notesText || 'No notes yet. Tap "Add" to jot something down.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Care History (read-only mode only) ── */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CARE HISTORY</Text>
            {recentEvents.length > 0 ? (
              <View style={styles.historyCard}>
                {recentEvents.map((event, index) => (
                  <React.Fragment key={event.id || index}>
                    <HistoryItem event={event} />
                    {index < recentEvents.length - 1 && (
                      <View style={styles.historyDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.historyEmptyCard}>
                <Text style={styles.historyEmptyEmoji}>{'\u{1F4DD}'}</Text>
                <Text style={styles.historyEmptyText}>
                  No care events recorded yet. Mark a task as done to start
                  tracking.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Vira Pot (read-only mode only) ── */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VIRA POT</Text>
            <ViraPotPlaceholder />
          </View>
        )}

        {/* ── Edit Save/Cancel ── */}
        {isEditing && (
          <View style={styles.editActionsSection}>
            <TouchableOpacity
              style={[
                styles.editSaveButton,
                isSaving && styles.editButtonDisabled,
              ]}
              onPress={handleSaveEdits}
              disabled={isSaving || isReidentifying}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save plant changes">
              {isSaving ? (
                <ActivityIndicator color={viraTheme.colors.white} />
              ) : (
                <Text style={styles.editSaveButtonText}>SAVE CHANGES</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={handleCancelEdits}
              disabled={isSaving || isReidentifying}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Cancel plant edits">
              <Text style={styles.editCancelButtonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Remove Plant (read-only mode only) ── */}
        {!isEditing && (
          <View style={styles.dangerSection}>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemovePlant}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Remove plant">
              <Text style={styles.removeButtonText}>Remove plant</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.background,
  },
  content: {
    paddingBottom: viraTheme.spacing.xxxl,
  },

  // ── Header Edit button ──
  headerEditLabel: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.luxor,
    fontSize: 15,
    paddingHorizontal: viraTheme.spacing.sm,
    paddingVertical: viraTheme.spacing.xs,
  },

  // ── Not Found ──
  notFoundContainer: {
    flex: 1,
    backgroundColor: viraTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: viraTheme.spacing.xxxl,
  },
  notFoundEmoji: {
    fontSize: 48,
    marginBottom: viraTheme.spacing.lg,
  },
  notFoundText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
    marginBottom: viraTheme.spacing.xl,
  },
  backButton: {
    backgroundColor: viraTheme.colors.hemlock,
    paddingVertical: viraTheme.spacing.sm,
    paddingHorizontal: viraTheme.spacing.xl,
    borderRadius: viraTheme.radius.pill,
  },
  backButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
  },

  // ── Hero ──
  heroContainer: {
    width: '100%',
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: viraTheme.colors.butterMoon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderEmoji: {
    fontSize: 56,
    marginBottom: viraTheme.spacing.sm,
  },
  heroPlaceholderText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: viraTheme.colors.overlayDark,
  },
  heroTextContainer: {
    position: 'absolute',
    bottom: viraTheme.spacing.xl,
    left: viraTheme.spacing.lg,
    right: viraTheme.spacing.lg,
  },
  heroNickname: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.white,
    textTransform: 'uppercase',
  },
  heroNicknameInput: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.white,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: viraTheme.colors.butterMoon,
    paddingVertical: 2,
    minHeight: 44,
  },
  heroSpecies: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.whiteTranslucent,
    marginTop: viraTheme.spacing.xs,
  },

  // ── Re-identify ──
  reidentifySection: {
    paddingHorizontal: viraTheme.spacing.lg,
    paddingTop: viraTheme.spacing.lg,
  },
  reidentifyButton: {
    backgroundColor: viraTheme.colors.butterMoon,
    borderWidth: 1,
    borderColor: viraTheme.colors.thistle,
    borderRadius: viraTheme.radius.lg,
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  reidentifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: viraTheme.spacing.sm,
  },
  reidentifyLabel: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
    fontSize: 14,
  },
  reidentifySuccess: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.luxor,
    textAlign: 'center',
    marginTop: viraTheme.spacing.sm,
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
  },

  // ── Edit fields ──
  editFieldsContainer: {
    paddingHorizontal: viraTheme.spacing.lg,
    paddingTop: viraTheme.spacing.xl,
  },
  editField: {
    marginBottom: viraTheme.spacing.xl,
  },
  editFieldLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.sm,
  },
  editTextInput: {
    ...viraTheme.typography.body,
    paddingVertical: 14,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.md,
    borderWidth: 1.5,
    borderColor: viraTheme.colors.border,
    backgroundColor: viraTheme.colors.card,
    color: viraTheme.colors.textPrimary,
    minHeight: 48,
  },
  potChipRow: {
    flexDirection: 'row',
    gap: viraTheme.spacing.sm,
  },
  potChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: viraTheme.colors.border,
    backgroundColor: viraTheme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  potChipSelected: {
    borderColor: viraTheme.colors.hemlock,
    borderWidth: 2,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  potChipLabel: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    fontWeight: '500',
    fontSize: 13,
  },
  potChipLabelSelected: {
    color: viraTheme.colors.hemlock,
    fontWeight: '700',
  },

  // ── Edit actions ──
  editActionsSection: {
    paddingHorizontal: viraTheme.spacing.lg,
    marginTop: viraTheme.spacing.xl,
    gap: viraTheme.spacing.md,
  },
  editSaveButton: {
    paddingVertical: 16,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.vermillion,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  editSaveButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.white,
  },
  editCancelButton: {
    paddingVertical: 16,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.butterMoon,
    borderWidth: 1,
    borderColor: viraTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  editCancelButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.hemlock,
  },
  editButtonDisabled: {
    opacity: 0.6,
  },

  // ── Quick Stats ──
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: viraTheme.spacing.lg,
    paddingVertical: viraTheme.spacing.lg,
    gap: viraTheme.spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  statValue: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: viraTheme.colors.hemlock,
    fontSize: 13,
    textAlign: 'center',
  },
  statLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
    marginTop: 2,
    fontSize: 9,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: viraTheme.spacing.lg,
    marginTop: viraTheme.spacing.xl,
  },
  sectionLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
    marginBottom: viraTheme.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: viraTheme.spacing.sm,
  },

  // ── Care Row ──
  careRow: {
    flexDirection: 'row',
    gap: viraTheme.spacing.md,
  },
  careCard: {
    flex: 1,
  },
  markDoneWrapper: {
    marginTop: viraTheme.spacing.sm,
  },

  // ── Notes ──
  notesCard: {
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  notesText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
  },
  notesPlaceholder: {
    color: viraTheme.colors.textMuted,
    fontStyle: 'italic',
  },
  notesInput: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: viraTheme.spacing.lg,
    marginTop: viraTheme.spacing.md,
    paddingTop: viraTheme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: viraTheme.colors.borderLight,
  },
  editLink: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
    color: viraTheme.colors.luxor,
  },
  cancelLink: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
  },
  saveButton: {
    backgroundColor: viraTheme.colors.hemlock,
    paddingVertical: viraTheme.spacing.xs,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.pill,
  },
  saveButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.butterMoon,
    fontSize: 13,
  },

  // ── History ──
  historyCard: {
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.lg,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: viraTheme.spacing.sm,
  },
  historyEmoji: {
    fontSize: 18,
    marginRight: viraTheme.spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyLabel: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    fontSize: 14,
  },
  historyDate: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    marginTop: 1,
  },
  historyDivider: {
    height: 1,
    backgroundColor: viraTheme.colors.borderLight,
  },
  autoBadge: {
    backgroundColor: viraTheme.colors.luxor,
    paddingHorizontal: viraTheme.spacing.sm,
    paddingVertical: 2,
    borderRadius: viraTheme.radius.xs,
  },
  autoBadgeText: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.butterMoon,
    fontSize: 9,
  },
  historyEmptyCard: {
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.xl,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
    alignItems: 'center',
  },
  historyEmptyEmoji: {
    fontSize: 28,
    marginBottom: viraTheme.spacing.sm,
  },
  historyEmptyText: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },

  // ── Danger Zone ──
  dangerSection: {
    paddingHorizontal: viraTheme.spacing.lg,
    marginTop: viraTheme.spacing.xxxl,
    alignItems: 'center',
  },
  removeButton: {
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.xxl,
    borderRadius: viraTheme.radius.pill,
    borderWidth: 1,
    borderColor: viraTheme.colors.error,
    minHeight: 44,
    justifyContent: 'center',
  },
  removeButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.error,
    fontSize: 14,
  },
});
