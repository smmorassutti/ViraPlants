import React from 'react';
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { viraTheme } from '../theme/vira';

type MarkDoneButtonProps = {
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
};

export const MarkDoneButton: React.FC<MarkDoneButtonProps> = ({
  label = 'MarkDoneButton',
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: viraTheme.spacing.sm,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.pill,
    backgroundColor: viraTheme.colors.hemlock,
  },
  label: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.butterMoon,
    textAlign: 'center',
  },
});

