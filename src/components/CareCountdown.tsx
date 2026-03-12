import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {viraTheme} from '../theme/vira';
import {getDaysUntilCare} from '../utils/careUtils';
import type {Plant} from '../types/plant';

// Re-export for existing consumers
export {getDaysUntilCare} from '../utils/careUtils';

type CareCountdownProps = {
  plant: Plant;
  type: 'water' | 'fertilize';
  compact?: boolean;
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
    backgroundColor: viraTheme.colors.overdueBackground,
    borderColor: viraTheme.colors.error,
  },
  urgentBackground: {
    backgroundColor: viraTheme.colors.urgentBackground,
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
