---
title: Animated success state for action buttons
tags: [react-native, animation, MarkDoneButton, UX]
date: 2026-03-12
screens: [PlantDetailScreen]
---

# Animated success state for action buttons

## Problem

When a user taps "Water Now" or "Fertilize Now", there's no visual confirmation that the action registered. The care event is logged to the store instantly, but the UI feels unresponsive without feedback.

## Solution

MarkDoneButton uses React Native's `Animated` API for a 1-second success state with a scale pulse. No third-party animation library needed.

```typescript
const [isDone, setIsDone] = useState(false);
const scaleAnim = useRef(new Animated.Value(1)).current;

const handlePress = useCallback(() => {
  if (isDone) return;  // Prevent double-taps during animation
  onPress();
  setIsDone(true);

  Animated.sequence([
    Animated.timing(scaleAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
    Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
  ]).start();

  setTimeout(() => setIsDone(false), 1000);
}, [isDone, onPress, scaleAnim]);
```

### Success state changes

| Property | Default | Success |
|----------|---------|---------|
| Background | Water-blue (#4A90D9) or green (success) | success green |
| Icon | Water drop or seedling emoji | Checkmark emoji |
| Label | "Water Now" / "Fertilize Now" | "Done!" |
| Disabled | false | true (prevents re-tap) |

## Key decisions

- **`useNativeDriver: true`** — scale transforms run on the native thread, no JS bridge lag
- **`setTimeout` for reset** — simpler than an animation callback; 1 second is enough for the user to see confirmation without blocking the UI
- **`isDone` guard** — the button is both visually disabled (opacity) and logically disabled (early return) to prevent double care event logging
- **No external deps** — `Animated` is built into React Native. Reanimated would be overkill for a simple pulse.

## Gotcha

The `isDone` state is local — if the component re-renders from a store update (which happens because `markWatered` modifies the plant), the success state persists because `isDone` is component-local state, not derived from the store.
