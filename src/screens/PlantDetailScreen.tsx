import type {RootStackParamList} from '../types/navigation';
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {usePlantStore} from '../store/usePlantStore';
import {CareCountdown} from '../components/CareCountdown';
import {MarkDoneButton} from '../components/MarkDoneButton';
import {ViraPotPlaceholder} from '../components/ViraPotPlaceholder';
import type {CareEvent} from '../types/plant';

type Props = NativeStackScreenProps<RootStackParamList, 'PlantDetail'>;

const HERO_HEIGHT = 300;
const {width: SCREEN_WIDTH} = Dimensions.get('window');

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

// ── Main Screen ──

export const PlantDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const plant = usePlantStore(state =>
    state.plants.find(p => p.id === route.params.plantId),
  );
  const {updatePlant, removePlant, markWatered, markFertilized} =
    usePlantStore();

  const [notesText, setNotesText] = useState(plant?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

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
            removePlant(plant.id!);
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

  if (!plant) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundEmoji}>{'\u{1FAB4}'}</Text>
        <Text style={styles.notFoundText}>
          We couldn't find this plant. It may have been removed.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recentEvents = [...(plant.careEvents || [])]
    .sort(
      (a, b) =>
        new Date(b.occurredAt || b.createdAt || 0).getTime() -
        new Date(a.occurredAt || a.createdAt || 0).getTime(),
    )
    .slice(0, 10);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bounces={false}>
      {/* ── Hero Photo ── */}
      <View style={styles.heroContainer}>
        {plant.photoUrl ? (
          <Image source={{uri: plant.photoUrl}} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderEmoji}>{'\u{1FAB4}'}</Text>
            <Text style={styles.heroPlaceholderText}>No photo yet</Text>
          </View>
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroNickname}>
            {plant.nickname || 'Unnamed plant'}
          </Text>
          <Text style={styles.heroSpecies}>{plant.name || 'Unknown species'}</Text>
        </View>
      </View>

      {/* ── Quick Stats ── */}
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

      {/* ── Care Countdowns + Mark Done ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CARE SCHEDULE</Text>
        <View style={styles.careRow}>
          <View style={styles.careCard}>
            <CareCountdown plant={plant} type="water" />
            <View style={styles.markDoneWrapper}>
              <MarkDoneButton label="Done" onPress={handleMarkWatered} />
            </View>
          </View>
          <View style={styles.careCard}>
            <CareCountdown plant={plant} type="fertilize" />
            <View style={styles.markDoneWrapper}>
              <MarkDoneButton label="Done" onPress={handleMarkFertilized} />
            </View>
          </View>
        </View>
      </View>

      {/* ── AI Care Notes ── */}
      {plant.careNotes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CARE TIPS</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{plant.careNotes}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Editable Notes ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>YOUR NOTES</Text>
          {!isEditingNotes && (
            <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
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
            />
            <View style={styles.notesActions}>
              <TouchableOpacity
                onPress={() => {
                  setNotesText(plant.notes || '');
                  setIsEditingNotes(false);
                }}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveNotes}>
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

      {/* ── Care History ── */}
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

      {/* ── Vira Pot ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>VIRA POT</Text>
        <ViraPotPlaceholder />
      </View>

      {/* ── Remove Plant ── */}
      <View style={styles.dangerSection}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemovePlant}
          activeOpacity={0.7}>
          <Text style={styles.removeButtonText}>Remove plant</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    width: SCREEN_WIDTH,
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
    backgroundColor: 'rgba(24,30,20,0.35)',
  },
  heroTextContainer: {
    position: 'absolute',
    bottom: viraTheme.spacing.xl,
    left: viraTheme.spacing.lg,
    right: viraTheme.spacing.lg,
  },
  heroNickname: {
    ...viraTheme.typography.heading1,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  heroSpecies: {
    ...viraTheme.typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: viraTheme.spacing.xs,
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
  },
  removeButtonText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.error,
    fontSize: 14,
  },
});
