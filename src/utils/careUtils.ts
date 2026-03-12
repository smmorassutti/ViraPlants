import type {Plant, CareEvent} from '../types/plant';

/**
 * Returns the date of the most recent care event of the given type.
 * Falls back to plant.createdAt, then Date.now().
 */
export const getLastCareDate = (
  plant: Plant,
  type: 'water' | 'fertilize',
): Date => {
  const events = plant.careEvents.filter(e => e.type === type);
  if (events.length > 0) {
    const sorted = events.sort(
      (a, b) =>
        new Date(b.occurredAt || b.createdAt || 0).getTime() -
        new Date(a.occurredAt || a.createdAt || 0).getTime(),
    );
    return new Date(sorted[0].occurredAt || sorted[0].createdAt || 0);
  }
  return new Date(plant.createdAt || Date.now());
};

/**
 * Returns the date of the most recent care event, or undefined if none exist.
 * Used by MarkDoneButton for "Last: Xd ago" display.
 */
export const getLastCareDateOrUndefined = (
  plant: Plant,
  type: 'water' | 'fertilize',
): Date | undefined => {
  const events = plant.careEvents.filter(e => e.type === type);
  if (events.length === 0) return undefined;
  const sorted = events.sort(
    (a, b) =>
      new Date(b.occurredAt || b.createdAt || 0).getTime() -
      new Date(a.occurredAt || a.createdAt || 0).getTime(),
  );
  return new Date(sorted[0].occurredAt || sorted[0].createdAt || 0);
};

/**
 * Returns the number of days until the next care event of the given type.
 * Negative values mean overdue.
 */
export const getDaysUntilCare = (
  plant: Plant,
  type: 'water' | 'fertilize',
): number => {
  const frequency =
    type === 'water'
      ? plant.waterFrequencyDays || 7
      : plant.fertilizeFrequencyDays || 30;
  const lastCare = getLastCareDate(plant, type);
  const nextDue = new Date(lastCare);
  nextDue.setDate(nextDue.getDate() + frequency);
  const now = new Date();
  const diffMs = nextDue.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};
