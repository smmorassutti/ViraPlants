---
title: pickImage null-return pattern for camera/library
tags: [react-native, image-picker, utils, error-handling]
date: 2026-03-12
screens: [AddPlantScreen, PlantDetailScreen]
---

# pickImage null-return pattern for camera/library

## Problem

`react-native-image-picker` has multiple failure modes: user cancels, permission denied, camera unavailable, etc. Each caller would need to handle all these cases, leading to duplicated error handling across AddPlantScreen and PlantDetailScreen.

## Solution

A single utility `src/utils/pickImage.ts` that wraps both `launchCamera` and `launchImageLibrary` behind a unified `Promise<string | null>` interface. Null means "no image was selected" regardless of why.

```typescript
export const pickImage = async (
  source: 'camera' | 'library',
): Promise<string | null> => {
  const options = {
    mediaType: 'photo' as const,
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8 as const,
  };

  const launcher = source === 'camera' ? launchCamera : launchImageLibrary;

  try {
    const response = await launcher(options);
    if (response.didCancel) return null;
    if (response.errorCode) {
      console.warn(`Image picker error: ${response.errorCode}`);
      return null;
    }
    return response.assets?.[0]?.uri ?? null;
  } catch (error) {
    console.warn('Image picker failed:', error);
    return null;
  }
};
```

### Caller pattern

```typescript
const uri = await pickImage('library');
if (uri) setPhotoUri(uri);
// That's it. No error handling needed at the call site.
```

## Key decisions

- **Null over throwing** — callers don't need to distinguish between "user cancelled" and "camera broken". Both mean "no photo to use". If we later need to distinguish, we can return a discriminated union instead.
- **Settings baked in** — 1200x1200 max dimensions and 0.8 quality are consistent across the app. No per-caller configuration needed until upload compression is added (Supabase Storage step).
- **console.warn for errors** — errors are logged for debugging but don't surface to the user. The UI simply stays in the "no photo" state, which is always a valid state.

## Where it's used

- **AddPlantScreen** — Alert chooser ("Take Photo" / "Choose from Library") calls `pickImage('camera')` or `pickImage('library')`, sets `photoUri` state
- **PlantDetailScreen** — Same Alert chooser on hero photo tap, calls `updatePlant({ photoUrl: uri })` directly

## Future: compression

When Supabase Storage upload is added, compression logic should go in a separate `compressImage(uri)` util, not inside `pickImage`. Keep picking and compressing as separate concerns — pick returns raw URI, compress reduces it before upload.
