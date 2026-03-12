---
title: Alert.alert as a lightweight action sheet
tags: [react-native, UX, patterns, image-picker]
date: 2026-03-12
screens: [AddPlantScreen, PlantDetailScreen]
---

# Alert.alert as a lightweight action sheet

## Problem

Both AddPlantScreen and PlantDetailScreen need to let users choose between "Take Photo" and "Choose from Library". A full bottom sheet or action sheet component would be overengineered for two options.

## Solution

Use React Native's built-in `Alert.alert` with three buttons. On iOS, this automatically renders as a native action sheet when there are 3+ buttons with a cancel option.

```typescript
const handleChoosePhoto = useCallback(() => {
  Alert.alert('Add a photo', 'How would you like to add your plant photo?', [
    {text: 'Take Photo', onPress: handleTakePhoto},
    {text: 'Choose from Library', onPress: handlePickPhoto},
    {text: 'Cancel', style: 'cancel'},
  ]);
}, [handleTakePhoto, handlePickPhoto]);
```

Same pattern used in PlantDetailScreen for photo update and plant removal confirmation.

## Why this over alternatives

| Option | Pros | Cons |
|--------|------|------|
| **Alert.alert** | Zero deps, native look, 3 lines | Limited styling, no icons |
| @gorhom/bottom-sheet | Custom UI, swipe to dismiss | Heavy dep for 2 options |
| ActionSheetIOS | True iOS action sheet | iOS-only, need Android fallback |
| Custom modal | Full control | Lots of code for simple choice |

## When to graduate

Switch to a proper bottom sheet when:
- You need more than 3 options
- You need icons, images, or custom layouts in the chooser
- You need the chooser to show preview thumbnails
- Brand requirements demand custom styling over native chrome

For now, Alert.alert is the right tool — it's native, accessible, and zero lines of UI code.

## Pattern reuse

This same Alert pattern is used for destructive confirmations:

```typescript
Alert.alert(
  `Remove ${plant.nickname}?`,
  'This will permanently remove this plant and all its care history.',
  [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Remove', style: 'destructive', onPress: () => { ... }},
  ],
);
```

The `style: 'destructive'` flag renders the button in red on iOS automatically.
