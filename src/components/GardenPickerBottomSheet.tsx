import React, {useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {viraTheme} from '../theme/vira';
import {useGardenStore} from '../store/useGardenStore';
import {useAuthStore} from '../store/useAuthStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const GardenPickerBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
}) => {
  const gardens = useGardenStore(s => s.gardens);
  const activeId = useGardenStore(s => s.activeGardenId);
  const ownId = useGardenStore(s => s.ownGardenId);
  const setActiveGarden = useGardenStore(s => s.setActiveGarden);
  const loadGardens = useGardenStore(s => s.loadGardens);
  const userId = useAuthStore(s => s.user?.id);

  // Refresh garden list when the sheet opens (Q4 trigger).
  useEffect(() => {
    if (visible && userId) {
      loadGardens(userId).catch(() => {});
    }
  }, [visible, userId, loadGardens]);

  const handleSelect = (gardenId: string) => {
    if (gardenId !== activeId) {
      setActiveGarden(gardenId);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} accessible={false}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose a garden</Text>
          {gardens.length === 0 ? (
            <Text style={styles.empty}>
              No gardens yet. Pull to refresh in a moment.
            </Text>
          ) : (
            gardens.map(g => {
              const isActive = g.gardenId === activeId;
              const isOwn = g.gardenId === ownId;
              const label = isOwn
                ? 'My plants'
                : `${
                    g.gardenOwnerDisplayName?.trim() || 'A Vira gardener'
                  }'s garden`;
              return (
                <TouchableOpacity
                  key={g.gardenId}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => handleSelect(g.gardenId)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{selected: isActive}}
                  accessibilityLabel={label}>
                  <Text
                    style={[
                      styles.rowLabel,
                      isActive && styles.rowLabelActive,
                    ]}>
                    {label}
                  </Text>
                  {isActive && <Text style={styles.check}>{'✓'}</Text>}
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close garden picker">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: viraTheme.colors.overlayDark,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: viraTheme.colors.butterMoon,
    paddingHorizontal: viraTheme.spacing.lg,
    paddingTop: viraTheme.spacing.sm,
    paddingBottom: viraTheme.spacing.xxl,
    borderTopLeftRadius: viraTheme.radius.xl,
    borderTopRightRadius: viraTheme.radius.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: viraTheme.colors.thistle,
    marginBottom: viraTheme.spacing.md,
  },
  title: {
    ...viraTheme.typography.heading2,
    color: viraTheme.colors.hemlock,
    marginBottom: viraTheme.spacing.md,
  },
  empty: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.textMuted,
    paddingVertical: viraTheme.spacing.lg,
    textAlign: 'center',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: viraTheme.spacing.md,
    paddingVertical: viraTheme.spacing.sm,
    borderRadius: viraTheme.radius.md,
    marginBottom: viraTheme.spacing.xs,
  },
  rowActive: {
    backgroundColor: viraTheme.colors.scheduleFertilize,
  },
  rowLabel: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.lagoon,
    flex: 1,
  },
  rowLabelActive: {
    fontFamily: 'Montserrat-SemiBold',
    fontWeight: '600',
    color: viraTheme.colors.hemlock,
  },
  check: {
    fontSize: 18,
    color: viraTheme.colors.luxor,
    fontWeight: '700',
    marginLeft: viraTheme.spacing.sm,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: viraTheme.spacing.md,
  },
  cancelText: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.luxor,
  },
});
