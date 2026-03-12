---
title: Hero photo with gradient overlay and tap-to-update
tags: [react-native, UI, PlantDetailScreen, image-picker]
date: 2026-03-12
screens: [PlantDetailScreen]
---

# Hero photo with gradient overlay and tap-to-update

## Problem

PlantDetailScreen needs a full-width hero photo with the plant name overlaid on it, readable regardless of photo brightness. The hero also needs to be tappable to update the photo.

## Solution

Stack four layers inside a TouchableOpacity:

1. **Image or placeholder** — full-width, `resizeMode="cover"`
2. **Dark overlay** — `rgba(24,30,20,0.35)` with `StyleSheet.absoluteFillObject`
3. **Text container** — positioned absolute at bottom-left with nickname (H1 white uppercase) and species (body, white 85% opacity)
4. **TouchableOpacity wrapper** — the entire hero is tappable

```tsx
<TouchableOpacity style={styles.heroContainer} onPress={handleUpdatePhoto} activeOpacity={0.85}>
  {plant.photoUrl ? (
    <Image source={{uri: plant.photoUrl}} style={styles.heroImage} />
  ) : (
    <View style={styles.heroPlaceholder}>
      <Text style={styles.heroPlaceholderEmoji}>{'\u{1FAB4}'}</Text>
      <Text style={styles.heroPlaceholderText}>Tap to add a photo</Text>
    </View>
  )}
  <View style={styles.heroOverlay} />
  <View style={styles.heroTextContainer}>
    <Text style={styles.heroNickname}>{plant.nickname}</Text>
    <Text style={styles.heroSpecies}>{plant.name}</Text>
  </View>
</TouchableOpacity>
```

### Navigation header integration

The navigation header is set to transparent with a white back arrow so it overlays the hero seamlessly:

```typescript
// App.tsx
<Stack.Screen
  name="PlantDetail"
  component={PlantDetailScreen}
  options={{
    headerTransparent: true,
    headerTitle: '',
    headerTintColor: '#FFFFFF',
  }}
/>
```

## Key decisions

- **Fixed overlay opacity (0.35)** over LinearGradient — simpler, no extra dependency, works well enough for most plant photos. A gradient would be better for photos with bright bottoms, but not worth adding `react-native-linear-gradient` yet.
- **TouchableOpacity on the whole hero** — rather than a small "edit" icon, because tapping the photo to change it is intuitive. The placeholder state says "Tap to add a photo" to make it discoverable.
- **`bounces={false}` on ScrollView** — prevents the hero from bouncing and showing the background color above it on iOS overscroll.
