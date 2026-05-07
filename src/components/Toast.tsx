import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {viraTheme} from '../theme/vira';
import {useToastStore} from '../utils/showErrorToast';

const VISIBLE_MS = 2000;
const FADE_MS = 220;

export const Toast: React.FC = () => {
  const message = useToastStore(s => s.message);
  const shownAt = useToastStore(s => s.shownAt);
  const clear = useToastStore(s => s.clear);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => clear());
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
    // shownAt re-runs the effect when the same message is re-shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, shownAt]);

  if (!message) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, {opacity}]}>
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: viraTheme.spacing.xxxl,
    left: viraTheme.spacing.lg,
    right: viraTheme.spacing.lg,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: viraTheme.colors.hemlock,
    paddingVertical: viraTheme.spacing.sm,
    paddingHorizontal: viraTheme.spacing.lg,
    borderRadius: viraTheme.radius.lg,
    maxWidth: 360,
  },
  text: {
    ...viraTheme.typography.body,
    color: viraTheme.colors.butterMoon,
    textAlign: 'center',
    fontSize: 14,
  },
});
