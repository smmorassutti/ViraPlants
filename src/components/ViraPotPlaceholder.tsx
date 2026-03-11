import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { viraTheme } from '../theme/vira';

export const ViraPotPlaceholder: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to Vira Pot</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: viraTheme.colors.hemlock,
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

