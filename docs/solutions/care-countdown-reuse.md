---
title: Reusable care countdown logic with getDaysUntilCare
tags: [react-native, components, care-tracking, reuse]
date: 2026-03-12
screens: [HomeScreen, PlantDetailScreen, PlantCard, PlantGridItem]
---

# Reusable care countdown logic with getDaysUntilCare

## Problem

Multiple screens and components need to display "days until next water/fertilize" — HomeScreen (upcoming tasks), PlantCard (compact badges), PlantGridItem (overlay badge), and PlantDetailScreen (full countdown cards). Duplicating this logic across files would create drift and bugs.

## Solution

Export a pure helper `getDaysUntilCare(plant, type)` from `CareCountdown.tsx` alongside the component itself. This keeps the calculation co-located with its primary consumer while making it importable everywhere.

```typescript
// src/components/CareCountdown.tsx
export const getDaysUntilCare = (
  plant: Plant,
  type: 'water' | 'fertilize',
): number => {
  const frequency = type === 'water'
    ? plant.waterFrequencyDays || 7
    : plant.fertilizeFrequencyDays || 30;
  const lastCare = getLastCareDate(plant, type);
  const nextDue = new Date(lastCare);
  nextDue.setDate(nextDue.getDate() + frequency);
  const diffMs = nextDue.getTime() - new Date().getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};
```

**Fallback chain:** If no care events exist for that type, falls back to `plant.createdAt`. If that's also missing, uses `Date.now()`. This means newly added plants show their first countdown immediately without requiring a care event.

## Usage pattern

- `CareCountdown` component uses it internally for display
- `HomeScreen.getUpcomingTasks()` uses it to filter plants needing attention within 3 days
- `PlantGridItem` uses it for the water badge overlay
- `PlantDetailScreen` doesn't call it directly — it uses the `CareCountdown` component in full mode

## Key decision

We export from the component file rather than a separate utils file because the logic is tightly coupled to CareCountdown's display semantics (overdue = ≤0, urgent = ≤1). If the thresholds change, they change together.
