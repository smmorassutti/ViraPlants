import notifee, {AuthorizationStatus, TriggerType} from '@notifee/react-native';
import type {Plant} from '../types/plant';

const CHANNEL_ID = 'watering-reminders';

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Watering Reminders',
    description: 'Notifications when your plants need watering',
  });
}

export async function requestPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

export async function scheduleWateringNotification(
  plant: Plant,
): Promise<void> {
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
}

export async function cancelWateringNotification(
  plantId: string,
): Promise<void> {
  await notifee.cancelNotification(`watering-${plantId}`);
}
