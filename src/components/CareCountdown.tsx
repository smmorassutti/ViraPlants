import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {viraTheme} from '../theme/vira';
import type {Plant, CareEvent} from '../types/plant';

type CareCountdownProps = {
  plant: Plant;
  type: 'water' | 'fertilize';
  compact?: boolean;
};

const getLastCareDate = (
  plant: Plant,
  type: 'water' | 'fertilize',
): Date => {
  const events = (plant.careEvents || []).filter(e => e.type === type);
  if (events.length > 0) {
    const sorted = events.sort(
      (a, b) =>
        new Date(b.occurredAt || b.createdAt || 0).getTime() -
        new Date(a.occurredAt || a.createdAt || 0).getTime(),
    );
    return new Date(sorted[0].occurredAt || sorted[0].createdAt || 0);
  }
  return new Date(plant.createdAt || Date.now());
};

export const getDaysUntilCare = (
  plant: Plant,
  type: 'water' | 'fertilize',
): number => {
  const frequency =
    type === 'water'
      ? plant.waterFrequencyDays || 7
      : plant.fertilizeFrequencyDays || 30;
  const lastCare = getLastCareDate(plant, type);
  const nextDue = new Date(lastCare);
  nextDue.setDate(nextDue.getDate() + frequency);
  const now = new Date();
  const diffMs = nextDue.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const CareCountdown: React.FC<CareCountdownProps> = ({
  plant,
  type,
  compact = false,
}) => {
  const daysLeft = getDaysUntilCare(plant, type);
  const label = type === 'water' ? 'Water' : 'Fertilize';
  const emoji = type === 'water' ? '\u{1F4A7}' : '\u{1F331}';
  const isOverdue = daysLeft <= 0;
  const isUrgent = daysLeft <= 1;

  const statusText = isOverdue
    ? 'Overdue'
    : daysLeft === 1
      ? 'Tomorrow'
      : `${daysLeft} days`;

  if (compact) {
    return (
      <View
        style={[
          styles.compactContainer,
          isOverdue && styles.overdueBackground,
          isUrgent && !isOverdue && styles.urgentBackground,
        ]}>
        <Text style={styles.compactEmoji}>{emoji}</Text>
        <Text
          style={[
            styles.compactText,
            isOverdue && styles.overdueText,
            isUrgent && !isOverdue && styles.urgentText,
          ]}>
          {statusText}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isOverdue && styles.overdueBackground,
        isUrgent && !isOverdue && styles.urgentBackground,
      ]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.textGroup}>
          <Text style={styles.label}>{label}</Text>
          <Text
            style={[
              styles.countdown,
              isOverdue && styles.overdueText,
              isUrgent && !isOverdue && styles.urgentText,
            ]}>
            {statusText}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.md,
    borderRadius: viraTheme.radius.md,
    backgroundColor: viraTheme.colors.card,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: viraTheme.spacing.sm,
  },
  emoji: {
    fontSize: 20,
  },
  textGroup: {
    flex: 1,
  },
  label: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.textMuted,
  },
  countdown: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.hemlock,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    marginTop: 2,
  },
  overdueBackground: {
    backgroundColor: '#FFF5F4',
    borderColor: viraTheme.colors.error,
  },
  urgentBackground: {
    backgroundColor: '#FFFBF0',
    borderColor: viraTheme.colors.warning,
  },
  overdueText: {
    color: viraTheme.colors.error,
  },
  urgentText: {
    color: viraTheme.colors.warning,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: viraTheme.spacing.sm,
    paddingVertical: viraTheme.spacing.xs,
    borderRadius: viraTheme.radius.sm,
    backgroundColor: viraTheme.colors.borderLight,
  },
  compactEmoji: {
    fontSize: 12,
  },
  compactText: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.hemlock,
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
  },
});
