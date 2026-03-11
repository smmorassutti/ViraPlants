import type { RootStackParamList } from '../types/navigation';
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { viraTheme } from '../theme/vira';
import { CareCountdown } from '../components/CareCountdown';
import { MarkDoneButton } from '../components/MarkDoneButton';
import { ViraPotPlaceholder } from '../components/ViraPotPlaceholder';

type Props = NativeStackScreenProps<RootStackParamList, 'PlantDetail'>;

export const PlantDetailScreen: React.FC<Props> = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Plant Detail</Text>
      <Text style={styles.body}>Hero photo, care notes, and logs will appear here.</Text>

      <View style={styles.section}>
        <CareCountdown label="Watering countdown" />
      </View>

      <View style={styles.section}>
        <CareCountdown label="Fertilizing countdown" />
      </View>

      <View style={styles.row}>
        <MarkDoneButton label="Mark as watered" />
        <MarkDoneButton label="Mark as fertilized" />
      </View>

      <View style={styles.section}>
        <ViraPotPlaceholder />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  content: {
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
    marginBottom: viraTheme.spacing.lg,
  },
  section: {
    marginTop: viraTheme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: viraTheme.spacing.lg,
    gap: viraTheme.spacing.md,
  },
});

