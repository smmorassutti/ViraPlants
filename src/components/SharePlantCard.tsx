import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { viraTheme } from '../theme/vira';

export const SharePlantCard: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SharePlantCard</Text>
      <Text style={styles.subtitle}>Shareable plant card placeholder</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  title: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.hemlock,
  },
  subtitle: {
    marginTop: viraTheme.spacing.xs,
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
  },
});

