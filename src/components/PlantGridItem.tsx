import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { viraTheme } from '../theme/vira';

type PlantGridItemProps = {
  label?: string;
};

export const PlantGridItem: React.FC<PlantGridItemProps> = ({ label = 'PlantGridItem' }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    borderRadius: viraTheme.radius.md,
    backgroundColor: viraTheme.colors.butterMoon,
    alignItems: 'center',
    justifyContent: 'center',
    padding: viraTheme.spacing.md,
  },
  label: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.hemlock,
    textAlign: 'center',
  },
});

