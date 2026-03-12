import React from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity} from 'react-native';
import {viraTheme} from '../theme/vira';
import {getDaysUntilCare} from '../utils/careUtils';
import type {Plant} from '../types/plant';

type PlantGridItemProps = {
  plant: Plant;
  onPress: () => void;
};

export const PlantGridItem: React.FC<PlantGridItemProps> = ({
  plant,
  onPress,
}) => {
  const waterDays = getDaysUntilCare(plant, 'water');
  const isOverdue = waterDays <= 0;
  const isUrgent = waterDays <= 1;

  const waterLabel = isOverdue
    ? 'Overdue'
    : waterDays === 1
      ? 'Tomorrow'
      : `${waterDays}d`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.photoContainer}>
        {plant.photoUrl ? (
          <Image source={{uri: plant.photoUrl}} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderEmoji}>{'\u{1FAB4}'}</Text>
          </View>
        )}
        <View
          style={[
            styles.waterBadge,
            isOverdue && styles.overdueBadge,
            isUrgent && !isOverdue && styles.urgentBadge,
          ]}>
          <Text style={styles.waterBadgeText}>
            {'\u{1F4A7}'} {waterLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.nickname} numberOfLines={1}>
        {plant.nickname || 'Unnamed'}
      </Text>
      <Text style={styles.species} numberOfLines={1}>
        {plant.name || 'Unknown species'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: viraTheme.spacing.sm,
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  photoContainer: {
    aspectRatio: 1,
    width: '100%',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: viraTheme.colors.butterMoon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderEmoji: {
    fontSize: 36,
  },
  waterBadge: {
    position: 'absolute',
    bottom: viraTheme.spacing.sm,
    right: viraTheme.spacing.sm,
    backgroundColor: viraTheme.colors.overlayBadge,
    paddingHorizontal: viraTheme.spacing.sm,
    paddingVertical: viraTheme.spacing.xs,
    borderRadius: viraTheme.radius.pill,
  },
  overdueBadge: {
    backgroundColor: viraTheme.colors.overdueBadge,
  },
  urgentBadge: {
    backgroundColor: viraTheme.colors.urgentBadge,
  },
  waterBadgeText: {
    ...viraTheme.typography.caption,
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
    color: viraTheme.colors.hemlock,
    fontSize: 11,
  },
  nickname: {
    ...viraTheme.typography.body,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: viraTheme.colors.lagoon,
    fontSize: 14,
    paddingHorizontal: viraTheme.spacing.md,
    paddingTop: viraTheme.spacing.sm,
  },
  species: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    paddingHorizontal: viraTheme.spacing.md,
    paddingBottom: viraTheme.spacing.md,
    marginTop: 2,
  },
});
