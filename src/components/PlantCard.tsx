import React from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity} from 'react-native';
import {viraTheme} from '../theme/vira';
import {CareCountdown} from './CareCountdown';
import type {Plant} from '../types/plant';

type PlantCardProps = {
  plant: Plant;
  onPress: () => void;
};

export const PlantCard: React.FC<PlantCardProps> = ({plant, onPress}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.photoContainer}>
        {plant.photoUrl && plant.photoUrl.length > 0 ? (
          <Image source={{uri: plant.photoUrl}} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderInitial}>
              {(plant.nickname || plant.name || 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.nickname} numberOfLines={1}>
          {plant.nickname || 'Unnamed plant'}
        </Text>
        <Text style={styles.species} numberOfLines={1}>
          {plant.name || 'Unknown species'}
        </Text>

        <View style={styles.countdowns}>
          <CareCountdown plant={plant} type="water" compact />
          <CareCountdown plant={plant} type="fertilize" compact />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: viraTheme.colors.card,
    borderRadius: viraTheme.radius.lg,
    padding: viraTheme.spacing.md,
    marginHorizontal: viraTheme.spacing.lg,
    marginBottom: viraTheme.spacing.md,
    borderWidth: 1,
    borderColor: viraTheme.colors.borderLight,
  },
  photoContainer: {
    width: 72,
    height: 72,
    borderRadius: viraTheme.radius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: viraTheme.colors.hemlock,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: viraTheme.radius.md,
  },
  photoPlaceholderInitial: {
    ...viraTheme.typography.heading1,
    fontSize: 28,
    color: viraTheme.colors.butterMoon,
  },
  info: {
    flex: 1,
    marginLeft: viraTheme.spacing.md,
    justifyContent: 'center',
  },
  nickname: {
    ...viraTheme.typography.heading2,
    fontSize: 17,
    color: viraTheme.colors.lagoon,
  },
  species: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    marginTop: 2,
  },
  countdowns: {
    flexDirection: 'row',
    gap: viraTheme.spacing.sm,
    marginTop: viraTheme.spacing.sm,
  },
});
