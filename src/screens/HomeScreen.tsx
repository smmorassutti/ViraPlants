import type { RootStackParamList } from '../types/navigation';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { viraTheme } from '../theme/vira';
import { usePlantStore } from '../store/usePlantStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { selectedPlant, plants } = usePlantStore();
  const plantId = selectedPlant?.id ?? plants[0]?.id ?? '';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Home</Text>
      <Text style={styles.body}>Your plant collection will live here.</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('PlantDetail', { plantId })}
        >
          <Text style={styles.actionLabel}>Go to Plant Detail</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('AddPlant')}
        >
          <Text style={styles.actionLabel}>Add Plant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.butterMoon,
    padding: viraTheme.spacing.xxl,
  },
  heading: {
    ...viraTheme.typography.heading1,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.md,
  },
  body: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    marginBottom: viraTheme.spacing.xl,
  },
  actions: {
    gap: viraTheme.spacing.md,
  },
  actionButton: {
    paddingVertical: viraTheme.spacing.sm,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.pill,
    backgroundColor: viraTheme.colors.hemlock,
  },
  actionLabel: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.butterMoon,
  },
});

