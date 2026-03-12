import type {RootStackParamList} from '../types/navigation';
import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {viraTheme} from '../theme/vira';
import {usePlantStore} from '../store/usePlantStore';
import {PlantCard} from '../components/PlantCard';
import {PlantGridItem} from '../components/PlantGridItem';
import {CareCountdown, getDaysUntilCare} from '../components/CareCountdown';
import type {Plant} from '../types/plant';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type ViewMode = 'list' | 'grid';

type CareTask = {
  plant: Plant;
  type: 'water' | 'fertilize';
  daysLeft: number;
};

const getUpcomingTasks = (plants: Plant[]): CareTask[] => {
  const tasks: CareTask[] = [];
  for (const plant of plants) {
    const waterDays = getDaysUntilCare(plant, 'water');
    if (waterDays <= 3) {
      tasks.push({plant, type: 'water', daysLeft: waterDays});
    }
    const fertilizeDays = getDaysUntilCare(plant, 'fertilize');
    if (fertilizeDays <= 3) {
      tasks.push({plant, type: 'fertilize', daysLeft: fertilizeDays});
    }
  }
  return tasks.sort((a, b) => a.daysLeft - b.daysLeft);
};

// ── Empty State ──

const EmptyState: React.FC<{onAddPlant: () => void}> = ({onAddPlant}) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyEmoji}>{'\u{1FAB4}'}</Text>
    <Text style={styles.emptyTitle}>Your garden awaits</Text>
    <Text style={styles.emptyBody}>
      Add your first plant and we'll help you keep it happy and thriving.
    </Text>
    <TouchableOpacity
      style={styles.emptyButton}
      onPress={onAddPlant}
      activeOpacity={0.8}>
      <Text style={styles.emptyButtonText}>Add your first plant</Text>
    </TouchableOpacity>
  </View>
);

// ── Care Tasks Section ──

const CareTaskCard: React.FC<{
  task: CareTask;
  onPress: () => void;
}> = ({task, onPress}) => {
  const emoji = task.type === 'water' ? '\u{1F4A7}' : '\u{1F331}';
  const action = task.type === 'water' ? 'Water' : 'Fertilize';
  const isOverdue = task.daysLeft <= 0;

  const statusText = isOverdue
    ? 'Overdue'
    : task.daysLeft === 1
      ? 'Tomorrow'
      : `In ${task.daysLeft} days`;

  return (
    <TouchableOpacity
      style={[styles.taskCard, isOverdue && styles.taskCardOverdue]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={styles.taskEmoji}>{emoji}</Text>
      <View style={styles.taskInfo}>
        <Text style={styles.taskPlantName} numberOfLines={1}>
          {action} {task.plant.nickname || task.plant.name}
        </Text>
        <Text
          style={[
            styles.taskStatus,
            isOverdue && styles.taskStatusOverdue,
          ]}>
          {statusText}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ── View Toggle ──

const ViewToggle: React.FC<{
  mode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}> = ({mode, onToggle}) => (
  <View style={styles.toggleContainer}>
    <TouchableOpacity
      style={[styles.toggleButton, mode === 'list' && styles.toggleActive]}
      onPress={() => onToggle('list')}>
      <Text
        style={[
          styles.toggleText,
          mode === 'list' && styles.toggleTextActive,
        ]}>
        {'\u{2630}'}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.toggleButton, mode === 'grid' && styles.toggleActive]}
      onPress={() => onToggle('grid')}>
      <Text
        style={[
          styles.toggleText,
          mode === 'grid' && styles.toggleTextActive,
        ]}>
        {'\u{2637}'}
      </Text>
    </TouchableOpacity>
  </View>
);

// ── Home Screen ──

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const plants = usePlantStore(state => state.plants);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const upcomingTasks = useMemo(() => getUpcomingTasks(plants), [plants]);

  const navigateToPlant = useCallback(
    (plantId: string) => {
      navigation.navigate('PlantDetail', {plantId});
    },
    [navigation],
  );

  const navigateToAddPlant = useCallback(() => {
    navigation.navigate('AddPlant');
  }, [navigation]);

  // ── List Header (care tasks + toggle) ──

  const ListHeader = useCallback(() => {
    if (plants.length === 0) {
      return null;
    }

    return (
      <View style={styles.headerSection}>
        {upcomingTasks.length > 0 && (
          <View style={styles.tasksSection}>
            <Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>
            <FlatList
              data={upcomingTasks}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) =>
                `${item.plant.id}-${item.type}-${index}`
              }
              contentContainerStyle={styles.tasksScroll}
              renderItem={({item}) => (
                <CareTaskCard
                  task={item}
                  onPress={() => navigateToPlant(item.plant.id!)}
                />
              )}
            />
          </View>
        )}

        <View style={styles.collectionHeader}>
          <Text style={styles.sectionLabel}>
            YOUR PLANTS ({plants.length})
          </Text>
          <ViewToggle mode={viewMode} onToggle={setViewMode} />
        </View>
      </View>
    );
  }, [plants.length, upcomingTasks, viewMode, navigateToPlant]);

  // ── Render ──

  return (
    <View style={styles.container}>
      <FlatList
        data={plants}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={item => item.id!}
        extraData={viewMode}
        contentContainerStyle={[
          styles.listContent,
          plants.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<EmptyState onAddPlant={navigateToAddPlant} />}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        renderItem={({item}) =>
          viewMode === 'list' ? (
            <PlantCard
              plant={item}
              onPress={() => navigateToPlant(item.id!)}
            />
          ) : (
            <PlantGridItem
              plant={item}
              onPress={() => navigateToPlant(item.id!)}
            />
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={navigateToAddPlant}
        activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  // ── Header / Tasks ──
  headerSection: {
    paddingTop: viraTheme.spacing.lg,
  },
  tasksSection: {
    marginBottom: viraTheme.spacing.xl,
  },
  sectionLabel: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
    paddingHorizontal: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.sm,
  },
  tasksScroll: {
    paddingHorizontal: viraTheme.spacing.lg,
    gap: viraTheme.spacing.md,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.md,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
    minWidth: 180,
  },
  taskCardOverdue: {
    borderColor: viraTheme.colors.error,
    backgroundColor: '#FFF5F4',
  },
  taskEmoji: {
    fontSize: 24,
    marginRight: viraTheme.spacing.sm,
  },
  taskInfo: {
    flex: 1,
  },
  taskPlantName: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: viraTheme.colors.lagoon,
    fontSize: 14,
  },
  taskStatus: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    marginTop: 2,
  },
  taskStatusOverdue: {
    color: viraTheme.colors.error,
  },

  // ── Collection Header ──
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.md,
  },

  // ── View Toggle ──
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: viraTheme.colors.butterMoon,
    borderRadius: viraTheme.radius.sm,
    borderWidth: 1,
    borderColor: viraTheme.colors.border,
  },
  toggleButton: {
    paddingHorizontal: viraTheme.spacing.md,
    paddingVertical: viraTheme.spacing.xs,
  },
  toggleActive: {
    backgroundColor: viraTheme.colors.hemlock,
    borderRadius: viraTheme.radius.sm,
  },
  toggleText: {
    fontSize: 16,
    color: viraTheme.colors.textMuted,
  },
  toggleTextActive: {
    color: viraTheme.colors.butterMoon,
  },

  // ── Grid ──
  gridRow: {
    paddingHorizontal: viraTheme.spacing.sm,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: viraTheme.spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: viraTheme.spacing.xl,
  },
  emptyTitle: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.hemlock,
    textAlign: 'center',
    marginBottom: viraTheme.spacing.sm,
  },
  emptyBody: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: viraTheme.spacing.xxl,
  },
  emptyButton: {
    backgroundColor: viraTheme.colors.vermillion,
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.xxl,
    borderRadius: viraTheme.radius.pill,
  },
  emptyButtonText: {
    ...viraTheme.typography.button,
    color: '#FFFFFF',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: viraTheme.spacing.xxl,
    right: viraTheme.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: viraTheme.colors.vermillion,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 30,
    fontWeight: '300',
  },
});
