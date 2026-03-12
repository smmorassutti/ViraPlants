import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import {viraTheme} from '../theme/vira';

type MarkDoneButtonProps = {
  type: 'water' | 'fertilize';
  onPress: () => void;
  lastDone?: Date;
};

const getDaysAgo = (date: Date): number => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const MarkDoneButton: React.FC<MarkDoneButtonProps> = ({
  type,
  onPress,
  lastDone,
}) => {
  const [isDone, setIsDone] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isWater = type === 'water';
  const bgColor = isWater ? viraTheme.colors.waterBlue : viraTheme.colors.success;
  const icon = isWater ? '\u{1F4A7}' : '\u{1F331}';
  const label = isWater ? 'Water Now' : 'Fertilize Now';

  const handlePress = useCallback(() => {
    if (isDone) return;
    onPress();
    setIsDone(true);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => setIsDone(false), 1000);
  }, [isDone, onPress, scaleAnim]);

  const daysAgo =
    lastDone !== undefined ? getDaysAgo(lastDone) : undefined;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={{transform: [{scale: scaleAnim}]}}>
        <TouchableOpacity
          style={[
            styles.button,
            {backgroundColor: isDone ? viraTheme.colors.success : bgColor},
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={isDone}>
          <Text style={styles.icon}>{isDone ? '\u{2705}' : icon}</Text>
          <Text style={styles.label}>{isDone ? 'Done!' : label}</Text>
        </TouchableOpacity>
      </Animated.View>
      {daysAgo !== undefined && (
        <Text style={styles.lastDone}>
          Last: {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: viraTheme.spacing.md,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.pill,
    gap: viraTheme.spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    ...viraTheme.typography.button,
    color: viraTheme.colors.white,
  },
  lastDone: {
    ...viraTheme.typography.caption,
    color: viraTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: viraTheme.spacing.xs,
  },
});
