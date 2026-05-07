import React from 'react';
import {Text, StyleSheet, TouchableOpacity} from 'react-native';
import {viraTheme} from '../theme/vira';
import {useGardenStore} from '../store/useGardenStore';

type Props = {
  onPress: () => void;
};

export const CaretakerBanner: React.FC<Props> = ({onPress}) => {
  const ownId = useGardenStore(s => s.ownGardenId);
  const activeId = useGardenStore(s => s.activeGardenId);
  const activeGarden = useGardenStore(s =>
    s.gardens.find(g => g.gardenId === s.activeGardenId) ?? null,
  );

  if (!activeGarden || !activeId || activeId === ownId) return null;

  const ownerName =
    activeGarden.gardenOwnerDisplayName?.trim() || 'A Vira gardener';

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Caring for ${ownerName}'s garden. Tap to switch gardens.`}>
      <Text style={styles.text} numberOfLines={1}>
        Caring for {ownerName}'s garden
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    minHeight: 44,
    backgroundColor: viraTheme.colors.hemlock,
    paddingHorizontal: viraTheme.spacing.lg,
    paddingVertical: viraTheme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: viraTheme.colors.butterMoon,
    letterSpacing: 0.2,
  },
});
