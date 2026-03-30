import type {Plant} from '../types/plant';

// Lazy-require so a missing native module doesn't crash at import time
let notifee: typeof import('@notifee/react-native').default | null = null;
let AuthorizationStatus: typeof import('@notifee/react-native').AuthorizationStatus | null = null;
let TriggerType: typeof import('@notifee/react-native').TriggerType | null = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default;
  AuthorizationStatus = mod.AuthorizationStatus;
  TriggerType = mod.TriggerType;
} catch {
  // Native module not linked yet — all functions will no-op
}

const CHANNEL_ID = 'watering-reminders';

async function ensureChannel(): Promise<void> {
  await notifee!.createChannel({
    id: CHANNEL_ID,
    name: 'Watering Reminders',
    description: 'Notifications when your plants need watering',
  });
}

export async function requestPermission(): Promise<boolean> {
  try {
    if (!notifee || !AuthorizationStatus) return false;
    const settings = await notifee.requestPermission();
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function scheduleWateringNotification(
  plant: Plant,
): Promise<void> {
  try {
    if (!notifee || !TriggerType) return;
    if (plant.waterFrequencyDays === undefined) return;

    await ensureChannel();

    const waterEvents = plant.careEvents.filter((e) => e.type === 'water');
    const lastWaterDate =
      waterEvents.length > 0
        ? waterEvents.reduce((latest, e) => {
            const d = e.createdAt ?? e.occurredAt;
            if (!d) return latest;
            return !latest || d > latest ? d : latest;
          }, '' as string)
        : null;

    const baseDate = lastWaterDate || plant.createdAt;
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + plant.waterFrequencyDays);

    // Set notification for 9 AM on the due date
    dueDate.setHours(9, 0, 0, 0);

    // Don't schedule notifications in the past
    if (dueDate.getTime() <= Date.now()) return;

    const displayName = plant.nickname || plant.name || 'Your plant';

    await notifee.createTriggerNotification(
      {
        id: `watering-${plant.id}`,
        title: `Time to water ${displayName}`,
        body: `${displayName} is ready for a drink today.`,
        android: {channelId: CHANNEL_ID},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: dueDate.getTime(),
      },
    );
  } catch {
    // Silently degrade if native module is unavailable
  }
}

export async function cancelWateringNotification(
  plantId: string,
): Promise<void> {
  try {
    if (!notifee) return;
    await notifee.cancelNotification(`watering-${plantId}`);
  } catch {
    // Silently degrade if native module is unavailable
  }
}
