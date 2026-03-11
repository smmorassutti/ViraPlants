import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { viraTheme } from '../theme/vira';

type PlantCardProps = {
  title?: string;
  subtitle?: string;
};

export const PlantCard: React.FC<PlantCardProps> = ({ title = 'PlantCard', subtitle }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.lg,
    backgroundColor: viraTheme.colors.butterMoon,
    borderWidth: 1,
    borderColor: viraTheme.colors.hemlock,
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

