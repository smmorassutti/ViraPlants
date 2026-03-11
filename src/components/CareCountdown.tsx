import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { viraTheme } from '../theme/vira';

type CareCountdownProps = {
  label?: string;
};

export const CareCountdown: React.FC<CareCountdownProps> = ({ label = 'CareCountdown' }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.placeholder}>Countdown placeholder</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.md,
    borderRadius: viraTheme.radius.md,
    backgroundColor: viraTheme.colors.butterMoon,
  },
  label: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.hemlock,
  },
  placeholder: {
    marginTop: viraTheme.spacing.xs,
    ...viraTheme.typography.caption,
    color: viraTheme.colors.lagoon,
  },
});

