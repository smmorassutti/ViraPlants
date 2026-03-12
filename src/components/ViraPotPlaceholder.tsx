import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {viraTheme} from '../theme/vira';

export const ViraPotPlaceholder: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.potIcon}>{'\u{1FAB4}'}</Text>
      <Text style={styles.title}>Vira Pot</Text>
      <Text style={styles.subtitle}>
        Connect your smart pot to automate watering and track reservoir levels.
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>COMING SOON</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: viraTheme.spacing.xl,
    borderRadius: viraTheme.radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: viraTheme.colors.thistle,
    backgroundColor: viraTheme.colors.butterMoon,
    alignItems: 'center',
  },
  potIcon: {
    fontSize: 40,
    marginBottom: viraTheme.spacing.md,
  },
  title: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.sm,
  },
  subtitle: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: viraTheme.spacing.lg,
  },
  badge: {
    backgroundColor: viraTheme.colors.thistle,
    paddingVertical: viraTheme.spacing.xs,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.pill,
  },
  badgeText: {
    ...viraTheme.typography.label,
    color: viraTheme.colors.hemlock,
  },
});
